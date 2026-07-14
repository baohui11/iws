import { loadMigrationEnv, writeReport } from './config.mjs'
import { closeDb, connectLegacy, connectTarget, tableCount } from './db.mjs'

async function main() {
  const config = loadMigrationEnv()
  const legacy = connectLegacy(config)
  const target = connectTarget(config)
  try {
    const report = {
      generatedAt: new Date().toISOString(),
      legacy: { counts: {}, enums: {}, storage: {} },
      target: { counts: {} },
    }
    for (const table of [
      'departments',
      'users',
      'projects',
      'project_members',
      'contract_deliverables',
      'files',
      'weekly_reports',
      'weekly_report_items',
      'weekly_report_file_links',
      'weekly_report_approvals',
    ]) {
      report.legacy.counts[table] = await tableCount(legacy, 'public', table).catch(() => null)
      report.target.counts[table] = await tableCount(target, 'public', table).catch(() => null)
    }
    report.legacy.counts['auth.users'] = await tableCount(legacy, 'auth', 'users').catch(() => null)
    report.legacy.counts['storage.objects'] = await tableCount(legacy, 'storage', 'objects').catch(() => null)

    const enumRows = await legacy`
      select t.typname as enum_name, e.enumlabel as value
      from pg_type t
      join pg_enum e on e.enumtypid=t.oid
      join pg_namespace n on n.oid=t.typnamespace
      where n.nspname='public'
      order by t.typname, e.enumsortorder
    `
    for (const row of enumRows) {
      report.legacy.enums[row.enum_name] ||= []
      report.legacy.enums[row.enum_name].push(row.value)
    }

    const buckets = await legacy`
      select bucket_id, count(*)::int as count
      from storage.objects
      group by bucket_id
      order by bucket_id
    `
    report.legacy.storage.objectsByBucket = buckets

    const reportFile = writeReport(config, 'inspect', report)
    console.log(`Inspect report written: ${reportFile}`)
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await closeDb(legacy)
    await closeDb(target)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
