/**
 * 批量导入项目成员：项目编号、用户工号、项目角色
 */

const HEADER_MAP: Record<string, string> = {
  project_no: 'project_no',
  项目编号: 'project_no',
  employee_no: 'employee_no',
  工号: 'employee_no',
  用户工号: 'employee_no',
  project_role: 'project_role',
  项目角色: 'project_role',
}

function normalizeHeader(cell: string): string {
  const t = cell.trim()
  const lower = t.toLowerCase()
  return HEADER_MAP[lower] ?? HEADER_MAP[t] ?? lower
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur)
  return result
}

export interface ParsedProjectMemberRow {
  project_no: string
  employee_no: string
  project_role: string
}

export function parseProjectMembersCsv(text: string): ParsedProjectMemberRow[] {
  const normalized = text.replace(/^\uFEFF/, '')
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  const rows: ParsedProjectMemberRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const map: Record<string, string> = {}
    headers.forEach((h, j) => {
      map[h] = (values[j] ?? '').trim()
    })
    rows.push({
      project_no: map.project_no ?? '',
      employee_no: map.employee_no ?? '',
      project_role: map.project_role ?? '',
    })
  }

  return rows
}
