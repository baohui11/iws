/**
 * 批量导入项目成果清单：项目编号、成果名称、描述
 */

const HEADER_MAP: Record<string, string> = {
  project_no: 'project_no',
  项目编号: 'project_no',
  name: 'name',
  成果名称: 'name',
  成果文件名称: 'name',
  名称: 'name',
  description: 'description',
  描述: 'description',
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

export interface ParsedProjectDeliverableRow {
  project_no: string
  name: string
  description: string
}

export function parseProjectDeliverablesCsv(text: string): ParsedProjectDeliverableRow[] {
  const normalized = text.replace(/^\uFEFF/, '')
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  const rows: ParsedProjectDeliverableRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const map: Record<string, string> = {}
    headers.forEach((h, j) => {
      map[h] = (values[j] ?? '').trim()
    })
    rows.push({
      project_no: map.project_no ?? '',
      name: map.name ?? '',
      description: map.description ?? '',
    })
  }

  return rows
}
