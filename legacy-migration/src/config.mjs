import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function loadMigrationEnv() {
  const envFile = path.resolve('legacy-migration/.env')
  if (!fs.existsSync(envFile)) {
    throw new Error(`Missing env file: ${envFile}`)
  }

  const env = {}
  const text = fs.readFileSync(envFile, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index < 0) continue
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1)
  }

  const required = [
    'LEGACY_DATABASE_URL',
    'TARGET_DATABASE_URL',
    'TARGET_S3_ENDPOINT',
    'TARGET_S3_ACCESS_KEY',
    'TARGET_S3_SECRET_KEY',
    'TARGET_S3_PROJECT_FILES_BUCKET',
    'TARGET_S3_AVATAR_BUCKET',
  ]
  for (const key of required) {
    if (!env[key]?.trim()) throw new Error(`Missing required env: ${key}`)
  }

  const tmpDir = env.MIGRATION_TMP_DIR?.trim() || path.join(os.tmpdir(), 'iws-legacy-migration')
  const logDir = env.MIGRATION_LOG_DIR?.trim() || 'legacy-migration/logs'
  const reportDir = env.MIGRATION_REPORT_DIR?.trim() || 'legacy-migration/reports'
  const localStorageRoot =
    env.LEGACY_SUPABASE_STORAGE_LOCAL_ROOT?.trim() || 'temp/storage/stub/stub'

  return {
    legacyDatabaseUrl: env.LEGACY_DATABASE_URL.trim(),
    targetDatabaseUrl: env.TARGET_DATABASE_URL.trim(),
    targetS3: {
      endpoint: env.TARGET_S3_ENDPOINT.trim(),
      publicEndpoint: env.TARGET_S3_PUBLIC_ENDPOINT?.trim() || env.TARGET_S3_ENDPOINT.trim(),
      region: env.TARGET_S3_REGION?.trim() || 'us-east-1',
      accessKeyId: env.TARGET_S3_ACCESS_KEY.trim(),
      secretAccessKey: env.TARGET_S3_SECRET_KEY.trim(),
      forcePathStyle: String(env.TARGET_S3_FORCE_PATH_STYLE ?? 'true').toLowerCase() !== 'false',
      projectFilesBucket: env.TARGET_S3_PROJECT_FILES_BUCKET.trim(),
      avatarBucket: env.TARGET_S3_AVATAR_BUCKET.trim(),
    },
    dryRun: String(env.MIGRATION_DRY_RUN ?? 'true').toLowerCase() !== 'false',
    batchSize: Math.max(1, Number(env.MIGRATION_BATCH_SIZE || 100)),
    tmpDir,
    logDir,
    reportDir,
    localStorageRoot,
    migrate: {
      departments: flag(env.MIGRATE_DEPARTMENTS, true),
      users: flag(env.MIGRATE_USERS, true),
      projects: flag(env.MIGRATE_PROJECTS, true),
      projectMembers: flag(env.MIGRATE_PROJECT_MEMBERS, true),
      weeklyReports: flag(env.MIGRATE_WEEKLY_REPORTS, true),
      files: flag(env.MIGRATE_FILES, true),
      avatars: flag(env.MIGRATE_AVATARS, true),
    },
    enqueueFileJobs: flag(env.MIGRATION_ENQUEUE_FILE_JOBS, false),
  }
}

function flag(value, defaultValue) {
  if (value == null || value === '') return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

export function ensureMigrationDirs(config) {
  for (const dir of [config.tmpDir, config.logDir, config.reportDir]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function writeReport(config, name, data) {
  ensureMigrationDirs(config)
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(config.reportDir, `${ts}-${name}.json`)
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
  return file
}
