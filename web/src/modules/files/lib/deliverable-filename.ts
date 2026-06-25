import { getBasenameOnly } from '@/modules/files/lib/safe-upload-filename'

/**
 * 成果文件名规则：`{名称}-v{主.次}-{YYYYMMDD}.{后缀}`
 * 例如 `十五战略规划大纲-v1.0-20260101.pdf`
 */
export const DELIVERABLE_FILENAME_RULE_HINT =
  '成果文件名需符合「名称-v主.次-YYYYMMDD.后缀」，例如：十五战略规划大纲-v1.0-20260101.pdf'

export interface ParsedDeliverableFilename {
  /** 不含「-v版本-日期」与后缀的逻辑名，用于匹配合同成果 */
  baseName: string
  /** 如 V1.0（入库统一大写 V） */
  versionLabel: string
  /** 文件名中的 8 位日期 YYYYMMDD */
  dateYyyymmdd: string
  /** 小写后缀，不含点 */
  ext: string
}

function isValidCalendarYyyymmdd(s: string): boolean {
  if (!/^\d{8}$/.test(s)) return false
  const y = Number(s.slice(0, 4))
  const mo = Number(s.slice(4, 6)) - 1
  const d = Number(s.slice(6, 8))
  const dt = new Date(Date.UTC(y, mo, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo &&
    dt.getUTCDate() === d
  )
}

export function parseDeliverableFilename(basename: string): ParsedDeliverableFilename | null {
  const name = basename.replace(/\\/g, '/').split('/').pop()?.trim() ?? ''
  if (!name) return null
  const m = name.match(/^(.+?)-v([\d.]+)-(\d{8})\.([^.]+)$/i)
  if (!m) return null
  const baseName = m[1].trim()
  const ver = m[2].trim()
  const dateYyyymmdd = m[3]
  const ext = m[4].toLowerCase()
  if (!baseName || !ver || !ext) return null
  if (!isValidCalendarYyyymmdd(dateYyyymmdd)) return null
  return {
    baseName,
    versionLabel: `V${ver}`,
    dateYyyymmdd,
    ext,
  }
}

/**
 * 从已入库的成果 `file_name` 取出逻辑名，用于与本次上传文件名解析出的 `baseName` 对比。
 * 符合规则时取解析出的 `baseName`；历史数据若为纯名称（无「-v版本-日期」）则退化为整段 basename。
 */
export function getDeliverableLogicalBaseFromStoredName(
  fileName: string
): string | null {
  const bn = getBasenameOnly(fileName)
  const p = parseDeliverableFilename(bn)
  if (p) return p.baseName.trim()
  const t = bn.trim()
  return t ? t : null
}
