import { loadMigrationEnv, writeReport } from './config.mjs'
import { closeDb, connectLegacy, connectTarget, tableCount } from './db.mjs'
import {
  assertTargetBuckets,
  createTargetS3,
} from './storage.mjs'

const PROJECT_STATUS_MAP = {
  active: '进行中',
  preparing: '进行中',
  completed: '已结项',
  archived: '已关闭',
  suspended: '终止',
}

const SALES_PREFIX_RE = /^(XS-|XS－|销售-|销售－)\s*/i

function stripSalesPrefix(value) {
  const text = value?.trim() || ''
  return text.replace(SALES_PREFIX_RE, '').trim()
}

function hasSalesPrefix(value) {
  return SALES_PREFIX_RE.test(value?.trim() || '')
}

function normalizeProjectIdentity(project) {
  const sales = hasSalesPrefix(project.project_no) || hasSalesPrefix(project.project_name)
  const projectNo = sales ? stripSalesPrefix(project.project_no) : project.project_no?.trim()
  const projectName = sales ? stripSalesPrefix(project.project_name) : project.project_name?.trim()
  const stage = sales ? '销售阶段' : (project.project_stage || '实施阶段')
  const key = (projectNo || projectName || project.id).trim()
  return {
    sales,
    stage,
    projectNo: projectNo || null,
    projectName: projectName || null,
    key,
  }
}

function targetStatus(oldStatus) {
  return PROJECT_STATUS_MAP[oldStatus] || '进行中'
}

function sqlValue(v) {
  if (v === undefined) return null
  return v
}

function requiredDate(...values) {
  for (const value of values) {
    if (value) return value
  }
  return new Date()
}

async function insertRows(sql, table, columns, rows, { dryRun, conflict = 'id' } = {}) {
  if (!rows.length) return { inserted: 0 }
  if (dryRun) return { inserted: rows.length }

  const colSql = columns.map((c) => `"${c}"`).join(', ')
  const updateColumns = columns.filter((c) => c !== conflict)
  const updateSql = updateColumns.map((c) => `"${c}" = excluded."${c}"`).join(', ')

  for (const row of rows) {
    const values = columns.map((c) => row[c])
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
    await sql.unsafe(
      `insert into "${table}" (${colSql}) values (${placeholders})
       on conflict ("${conflict}") do update set ${updateSql}`,
      values
    )
  }
  return { inserted: rows.length }
}

async function upsertUsers(target, rows, { dryRun }) {
  const userIdMap = new Map(rows.map((row) => [row.id, row.id]))
  if (dryRun) return { inserted: rows.length, reused: 0, userIdMap }
  let inserted = 0
  let reused = 0
  for (const row of rows) {
    const existing = await target`
      select id from users
      where id = ${row.id}::uuid
         or (${row.email}::text is not null and email = ${row.email})
         or (${row.employee_no}::text is not null and employee_no = ${row.employee_no})
      limit 1
    `
    const id = existing[0]?.id || row.id
    userIdMap.set(row.id, id)
    if (existing[0]) reused += 1
    else inserted += 1
    await target.unsafe(
      `insert into users (
        id, created_at, password_hash, name, employee_no, email, gender, position,
        department_id, avatar_url, deleted_at, role, is_active, is_dept_leader, tags, invite_sent_at
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
      )
      on conflict (id) do update set
        password_hash = excluded.password_hash,
        name = excluded.name,
        employee_no = excluded.employee_no,
        email = excluded.email,
        gender = excluded.gender,
        position = excluded.position,
        department_id = excluded.department_id,
        avatar_url = excluded.avatar_url,
        deleted_at = excluded.deleted_at,
        role = excluded.role,
        is_active = excluded.is_active,
        is_dept_leader = excluded.is_dept_leader,
        tags = excluded.tags`,
      [
        id,
        row.created_at,
        row.password_hash,
        row.name,
        row.employee_no,
        row.email,
        row.gender,
        row.position,
        row.department_id,
        row.avatar_url,
        row.deleted_at,
        row.role,
        row.is_active,
        row.is_dept_leader,
        row.tags,
        row.invite_sent_at,
      ]
    )
  }
  return { inserted, reused, userIdMap }
}

async function buildProjectPlan(legacy) {
  const rows = await legacy`
    select *
    from projects
    order by created_at, id
  `
  const groups = new Map()
  const projectIdMap = new Map()

  for (const project of rows) {
    const normalized = normalizeProjectIdentity(project)
    const list = groups.get(normalized.key) || []
    list.push({ project, normalized })
    groups.set(normalized.key, list)
  }

  const targetProjects = []
  const mergeGroups = []

  for (const [key, list] of groups) {
    const implementation = list.find((item) => item.normalized.stage === '实施阶段')
    const canonical = implementation || list[0]
    const canonicalId = canonical.project.id
    const hasImplementation = list.some((item) => item.normalized.stage === '实施阶段')
    const stage = hasImplementation ? '实施阶段' : '销售阶段'
    const bestNo = canonical.normalized.projectNo || list.find((i) => i.normalized.projectNo)?.normalized.projectNo || null
    const bestName = canonical.normalized.projectName || list.find((i) => i.normalized.projectName)?.normalized.projectName || null

    targetProjects.push({
      id: canonicalId,
      created_at: canonical.project.created_at,
      deleted_at: canonical.project.deleted_at,
      project_no: bestNo,
      project_name: bestName,
      project_status: targetStatus(canonical.project.project_status),
      project_stage: stage,
      department_id: canonical.project.department_id,
      start_date: canonical.project.start_date,
      end_date: canonical.project.end_date,
      contract_no: canonical.project.contract_no,
      fiscal_year: canonical.project.fiscal_year,
      project_type: null,
      is_active: true,
    })

    for (const item of list) {
      projectIdMap.set(item.project.id, {
        targetProjectId: canonicalId,
        projectStage: item.normalized.stage,
        legacyProjectNo: item.project.project_no,
        legacyProjectName: item.project.project_name,
        targetProjectNo: bestNo,
        targetProjectName: bestName,
      })
    }

    if (list.length > 1) {
      mergeGroups.push({
        key,
        targetProjectId: canonicalId,
        targetProjectNo: bestNo,
        targetProjectName: bestName,
        legacyProjects: list.map((item) => ({
          id: item.project.id,
          projectNo: item.project.project_no,
          projectName: item.project.project_name,
          stage: item.normalized.stage,
        })),
      })
    }
  }

  return { legacyProjects: rows, targetProjects, projectIdMap, mergeGroups }
}

function remapProjectId(projectIdMap, legacyProjectId) {
  const mapped = projectIdMap.get(legacyProjectId)
  if (!mapped) throw new Error(`Missing project mapping for ${legacyProjectId}`)
  return mapped
}

async function enqueueInitialTasks(target, fileId, { dryRun }) {
  if (dryRun) return
  for (const stage of ['preview', 'parse']) {
    const taskRows = await target`
      insert into file_process_tasks (file_id, stage, status, priority, input)
      values (
        ${fileId}::uuid,
        ${stage},
        'pending',
        ${stage === 'preview' ? 100 : 50},
        '{"version":1}'::jsonb
      )
      on conflict (file_id, stage) do nothing
      returning id
    `
    const taskId = taskRows[0]?.id
    if (!taskId) continue
    const payload = JSON.stringify({ version: 1, taskId, fileId, stage })
    const msgRows = await target`
      select * from pgmq.send('file_processing'::text, ${payload}::jsonb, 0)
    `
    const first = msgRows[0] || {}
    const msgId = first.msg_id || first.send || Object.values(first)[0]
    if (msgId != null) {
      await target`
        update file_process_tasks
        set pgmq_message_id = ${BigInt(msgId)}::bigint, updated_at = now()
        where id = ${taskId}::uuid
      `
    }
  }
}

async function main() {
  const config = loadMigrationEnv()
  const legacy = connectLegacy(config)
  const target = connectTarget(config)
  const s3 = createTargetS3(config)
  const startedAt = new Date().toISOString()
  const report = {
    startedAt,
    dryRun: config.dryRun,
    config: {
      batchSize: config.batchSize,
      enqueueFileJobs: config.enqueueFileJobs,
      migrate: config.migrate,
    },
    counts: {},
    warnings: [],
    projectMerges: [],
    skipped: {},
  }
  let userIdMap = new Map()

  try {
    await assertTargetBuckets(config, s3)
    console.log(`Migration mode: ${config.dryRun ? 'DRY-RUN' : 'WRITE'}`)
    console.log(`File processing enqueue: ${config.enqueueFileJobs ? 'enabled' : 'disabled'}`)

    for (const table of [
      'departments',
      'users',
      'projects',
      'project_members',
      'contract_deliverables',
      'files',
      'file_reference_links',
      'file_interactions',
      'file_comments',
      'file_download_record',
      'weekly_reports',
      'weekly_report_items',
      'weekly_report_file_links',
      'weekly_report_approvals',
    ]) {
      report.counts[`legacy.${table}`] = await tableCount(legacy, 'public', table).catch(() => null)
    }

    const projectPlan = await buildProjectPlan(legacy)
    report.projectMerges = projectPlan.mergeGroups
    report.counts['legacy.projects.raw'] = projectPlan.legacyProjects.length
    report.counts['target.projects.planned'] = projectPlan.targetProjects.length
    console.log(`Projects: raw=${projectPlan.legacyProjects.length}, planned=${projectPlan.targetProjects.length}, merges=${projectPlan.mergeGroups.length}`)

    const weeklyConflictRows = await legacy`select id, user_id, project_id, week_code from weekly_reports`
    const weeklyConflictMap = new Map()
    for (const row of weeklyConflictRows) {
      const mapped = remapProjectId(projectPlan.projectIdMap, row.project_id)
      const key = `${row.user_id}:${mapped.targetProjectId}:${row.week_code}:${mapped.projectStage}`
      const list = weeklyConflictMap.get(key) || []
      list.push(row.id)
      weeklyConflictMap.set(key, list)
    }
    const weeklyConflicts = [...weeklyConflictMap.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([key, ids]) => ({ key, reportIds: ids }))
    report.weeklyReportUniqueConflicts = weeklyConflicts
    if (weeklyConflicts.length > 0) {
      report.warnings.push({
        type: 'weekly_report_unique_conflicts',
        count: weeklyConflicts.length,
      })
      console.log(`WARNING weekly report unique conflicts after merge: ${weeklyConflicts.length}`)
    }

    if (config.migrate.departments) {
      const departments = await legacy`select * from departments order by level nulls first, code`
      const rows = departments.map((d) => ({
        id: d.id,
        created_at: d.created_at,
        name: d.name,
        code: d.code,
        parent_id: d.parent_id,
        level: d.level,
        deleted_at: d.deleted_at,
        is_active: d.deleted_at == null,
      }))
      await insertRows(
        target,
        'departments',
        ['id', 'created_at', 'name', 'code', 'parent_id', 'level', 'deleted_at', 'is_active'],
        rows,
        { dryRun: config.dryRun }
      )
      report.counts['migrated.departments'] = rows.length
      console.log(`Departments: ${rows.length}`)
    }

    const authRows = await legacy`select id, encrypted_password from auth.users`
    const passwordByAuthId = new Map(authRows.map((r) => [r.id, r.encrypted_password || null]))

    if (config.migrate.users) {
      const users = await legacy`select * from users order by created_at, id`
      const rows = users.map((u) => ({
        id: u.id,
        created_at: u.created_at,
        password_hash: u.auth_id ? passwordByAuthId.get(u.auth_id) || null : null,
        name: u.name,
        employee_no: u.employee_no,
        email: u.email,
        gender: u.gender,
        position: u.position,
        department_id: u.department_id,
        avatar_url: u.avatar_url,
        deleted_at: u.deleted_at,
        role: u.role || 'user',
        is_active: u.deleted_at == null,
        is_dept_leader: false,
        tags: null,
        invite_sent_at: null,
      }))
      const result = await upsertUsers(target, rows, { dryRun: config.dryRun })
      userIdMap = result.userIdMap
      report.counts['migrated.users'] = rows.length
      report.counts['migrated.users.withPassword'] = rows.filter((u) => u.password_hash).length
      report.counts['migrated.users.withoutPassword'] = rows.filter((u) => !u.password_hash).length
      report.counts['migrated.users.reusedTarget'] = result.reused
      console.log(`Users: ${rows.length}, withPassword=${report.counts['migrated.users.withPassword']}, reused=${result.reused}`)
    }

    if (config.migrate.projects) {
      await insertRows(
        target,
        'projects',
        [
          'id',
          'created_at',
          'deleted_at',
          'project_no',
          'project_name',
          'project_status',
          'project_stage',
          'department_id',
          'start_date',
          'end_date',
          'contract_no',
          'fiscal_year',
          'project_type',
          'is_active',
        ],
        projectPlan.targetProjects,
        { dryRun: config.dryRun }
      )
      report.counts['migrated.projects'] = projectPlan.targetProjects.length
      console.log(`Projects migrated/planned: ${projectPlan.targetProjects.length}`)
    }

    if (config.migrate.projects) {
      const deliverables = await legacy`select * from contract_deliverables order by created_at, id`
      const rows = deliverables
        .map((d) => {
          const mapped = d.project_id ? remapProjectId(projectPlan.projectIdMap, d.project_id) : null
          return {
            id: d.id,
            created_at: d.created_at,
            project_id: mapped?.targetProjectId || null,
            name: d.name,
            description: d.description,
          }
        })
        .filter((d) => d.project_id && d.name)
      await insertRows(
        target,
        'contract_deliverables',
        ['id', 'created_at', 'project_id', 'name', 'description'],
        rows,
        { dryRun: config.dryRun }
      )
      report.counts['migrated.contractDeliverables'] = rows.length
      console.log(`Contract deliverables: ${rows.length}`)
    }

    if (config.migrate.projectMembers) {
      const members = await legacy`select * from project_members order by created_at, id`
      const dedupe = new Set()
      const rows = []
      for (const m of members) {
        if (!m.project_id || !m.user_id) continue
        const mapped = remapProjectId(projectPlan.projectIdMap, m.project_id)
        const key = `${mapped.targetProjectId}:${m.user_id}:${m.project_role || 'member'}:${mapped.projectStage}`
        if (dedupe.has(key)) continue
        dedupe.add(key)
        rows.push({
          id: m.id,
          created_at: m.created_at,
          deleted_at: m.deleted_at,
        project_id: mapped.targetProjectId,
          user_id: userIdMap.get(m.user_id) || m.user_id,
          project_role: m.project_role || 'member',
          project_stage: mapped.projectStage,
          is_active: m.deleted_at == null,
        })
      }
      await insertRows(
        target,
        'project_members',
        ['id', 'created_at', 'deleted_at', 'project_id', 'user_id', 'project_role', 'project_stage', 'is_active'],
        rows,
        { dryRun: config.dryRun }
      )
      report.counts['migrated.projectMembers'] = rows.length
      report.counts['skipped.projectMembers.duplicateAfterMerge'] = members.length - rows.length
      console.log(`Project members: ${rows.length}, skippedDuplicateAfterMerge=${members.length - rows.length}`)
    }

    const fileRows = await legacy`select * from files order by created_at, id`
    const fileIdSet = new Set(fileRows.map((f) => f.id))
    const projectStageByTargetProject = new Map(projectPlan.targetProjects.map((p) => [p.id, p.project_stage]))

    if (config.migrate.files) {
      const rows = fileRows.map((f) => {
        const mapped = remapProjectId(projectPlan.projectIdMap, f.project_id)
        const project = projectPlan.targetProjects.find((p) => p.id === mapped.targetProjectId)
        return {
          id: f.id,
          project_id: mapped.targetProjectId,
          department_id: project?.department_id || null,
          file_name: f.file_name,
          original_file_name: f.file_name,
          file_size: f.file_size,
          file_ext: f.file_ext,
          mime_type: f.mime_type,
          source_storage_key: f.source_storage_key,
          file_hash: null,
          preview_storage_key: null,
          preview_status: 'pending',
          preview_error: null,
          parsed_storage_key: null,
          parse_status: 'pending',
          parse_error: null,
          index_status: 'pending',
          index_error: null,
          processing_updated_at: null,
          uploader_id: userIdMap.get(f.uploader_id) || f.uploader_id,
          version_group_id: f.version_group_id || f.id,
          version_no: f.version_no || 1,
          version_label: f.version_label,
          is_latest: f.is_latest,
          is_deliverable: f.is_deliverable,
          business_type: null,
          contract_deliverable_id: f.contract_deliverable_id,
          project_stage: mapped.projectStage || projectStageByTargetProject.get(mapped.targetProjectId) || '实施阶段',
          sales_file_tag: null,
          file_source: f.file_source,
          created_at: requiredDate(f.created_at, f.updated_at),
          updated_at: requiredDate(f.updated_at, f.created_at),
          is_confidential: f.is_confidential,
          embedding_status: 'pending',
          embedding_error: null,
          embedding_model: null,
          embedding_dim: null,
          deleted_at: null,
        }
      })
      await insertRows(
        target,
        'files',
        [
          'id',
          'project_id',
          'department_id',
          'file_name',
          'original_file_name',
          'file_size',
          'file_ext',
          'mime_type',
          'source_storage_key',
          'file_hash',
          'preview_storage_key',
          'preview_status',
          'preview_error',
          'parsed_storage_key',
          'parse_status',
          'parse_error',
          'index_status',
          'index_error',
          'processing_updated_at',
          'uploader_id',
          'version_group_id',
          'version_no',
          'version_label',
          'is_latest',
          'is_deliverable',
          'business_type',
          'contract_deliverable_id',
          'project_stage',
          'sales_file_tag',
          'file_source',
          'created_at',
          'updated_at',
          'is_confidential',
          'embedding_status',
          'embedding_error',
          'embedding_model',
          'embedding_dim',
          'deleted_at',
        ],
        rows,
        { dryRun: config.dryRun }
      )
      report.counts['migrated.files'] = rows.length
      console.log(`Files metadata: ${rows.length}`)

      if (config.enqueueFileJobs) {
        for (const f of rows) {
          await enqueueInitialTasks(target, f.id, { dryRun: config.dryRun })
        }
        report.counts['enqueued.fileJobs.files'] = rows.length
        console.log(`File jobs enqueued/planned for files: ${rows.length}`)
      }
    }

    if (config.migrate.files) {
      const refLinks = await legacy`select * from file_reference_links order by id`
      const rows = refLinks.filter((r) => fileIdSet.has(r.reference_file_id) && fileIdSet.has(r.deliverable_file_id))
      await insertRows(
        target,
        'file_reference_links',
        ['id', 'reference_file_id', 'deliverable_file_id'],
        rows,
        { dryRun: config.dryRun }
      )
      report.counts['migrated.fileReferenceLinks'] = rows.length

      const interactions = await legacy`select * from file_interactions order by created_at, id`
      await insertRows(
        target,
        'file_interactions',
        ['id', 'created_at', 'file_id', 'user_id', 'user_role_at_time', 'interaction_type'],
        interactions.map((row) => ({
          ...row,
          user_id: userIdMap.get(row.user_id) || row.user_id,
        })),
        { dryRun: config.dryRun }
      )
      report.counts['migrated.fileInteractions'] = interactions.length

      const comments = await legacy`select * from file_comments order by created_at, id`
      await insertRows(
        target,
        'file_comments',
        ['id', 'file_id', 'user_id', 'parent_id', 'content', 'is_public', 'deleted_at', 'deleted_by', 'created_at', 'updated_at'],
        comments.map((row) => ({
          ...row,
          user_id: userIdMap.get(row.user_id) || row.user_id,
          deleted_by: row.deleted_by ? userIdMap.get(row.deleted_by) || row.deleted_by : null,
        })),
        { dryRun: config.dryRun }
      )
      report.counts['migrated.fileComments'] = comments.length

      const downloads = await legacy`select * from file_download_record order by created_at, id`
      await insertRows(
        target,
        'file_download_record',
        ['id', 'created_at', 'user_id', 'file_id', 'downloaded_at', 'ip_address'],
        downloads.map((row) => ({
          ...row,
          user_id: row.user_id ? userIdMap.get(row.user_id) || row.user_id : null,
        })),
        { dryRun: config.dryRun }
      )
      report.counts['migrated.fileDownloadRecord'] = downloads.length
    }

    if (config.migrate.weeklyReports) {
      const weeklyReports = await legacy`select * from weekly_reports order by created_at, id`
      const reportRows = weeklyReports.map((r) => {
        const mapped = remapProjectId(projectPlan.projectIdMap, r.project_id)
        return {
          id: r.id,
          created_at: r.created_at,
          updated_at: r.updated_at,
          user_id: userIdMap.get(r.user_id) || r.user_id,
          project_id: mapped.targetProjectId,
          week_code: r.week_code,
          project_stage: mapped.projectStage,
          status: r.status,
          submit_time: r.submit_time,
          is_overdue: r.is_overdue,
        }
      })
      await insertRows(
        target,
        'weekly_reports',
        ['id', 'created_at', 'updated_at', 'user_id', 'project_id', 'week_code', 'project_stage', 'status', 'submit_time', 'is_overdue'],
        reportRows,
        { dryRun: config.dryRun }
      )
      report.counts['migrated.weeklyReports'] = reportRows.length

      const items = await legacy`select * from weekly_report_items order by created_at, id`
      await insertRows(
        target,
        'weekly_report_items',
        ['id', 'created_at', 'updated_at', 'report_id', 'item_type', 'item_desc', 'work_days', 'work_dates', 'sort_order'],
        items,
        { dryRun: config.dryRun }
      )
      report.counts['migrated.weeklyReportItems'] = items.length

      const links = await legacy`select * from weekly_report_file_links order by created_at, id`
      await insertRows(
        target,
        'weekly_report_file_links',
        ['id', 'created_at', 'report_item_id', 'file_id'],
        links,
        { dryRun: config.dryRun }
      )
      report.counts['migrated.weeklyReportFileLinks'] = links.length

      const approvals = await legacy`select * from weekly_report_approvals order by created_at, id`
      await insertRows(
        target,
        'weekly_report_approvals',
        ['id', 'created_at', 'report_id', 'approver_id', 'action', 'reject_reason', 'approved_at', 'is_overdue'],
        approvals.map((row) => ({
          ...row,
          approver_id: userIdMap.get(row.approver_id) || row.approver_id,
        })),
        { dryRun: config.dryRun }
      )
      report.counts['migrated.weeklyReportApprovals'] = approvals.length
      console.log(`Weekly reports: reports=${reportRows.length}, items=${items.length}, links=${links.length}, approvals=${approvals.length}`)
    }

    const reportFile = writeReport(config, 'migrate-all', report)
    console.log(`Report written: ${reportFile}`)
  } finally {
    await closeDb(legacy)
    await closeDb(target)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
