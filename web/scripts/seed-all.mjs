import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

for (const script of ['seed-admin.mjs', 'seed-weeks.mjs']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
