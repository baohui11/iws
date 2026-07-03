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

function makeNormalizer(map: Record<string, string>) {
  return (cell: string) => {
    const t = cell.trim()
    return map[t.toLowerCase()] ?? map[t] ?? t.toLowerCase()
  }
}

function parseRows(
  text: string,
  normalize: (c: string) => string
): Record<string, string>[] {
  const normalized = text.replace(/^\uFEFF/, '')
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map(normalize)
  const out: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const map: Record<string, string> = {}
    headers.forEach((h, j) => {
      map[h] = (values[j] ?? '').trim()
    })
    out.push(map)
  }
  return out
}

// ---- 成果清单 ----
const DELIVERABLE_HEADER: Record<string, string> = {
  project_no: 'project_no', 项目编号: 'project_no',
  name: 'name', 成果名称: 'name', 成果文件名称: 'name', 名称: 'name',
  description: 'description', 描述: 'description',
}

export interface ParsedProjectDeliverableRow {
  project_no: string
  name: string
  description: string
}

export function parseProjectDeliverablesCsv(
  text: string
): ParsedProjectDeliverableRow[] {
  const normalize = makeNormalizer(DELIVERABLE_HEADER)
  return parseRows(text, normalize).map((m) => ({
    project_no: m.project_no ?? '',
    name: m.name ?? '',
    description: m.description ?? '',
  }))
}
