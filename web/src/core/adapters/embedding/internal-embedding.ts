export async function embedQueryText(text: string): Promise<number[] | null> {
  const baseUrl = process.env.EMBEDDING_SERVICE_URL?.trim()
  if (!baseUrl) return null

  const q = text.trim()
  if (!q) return null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = process.env.EMBEDDING_SERVICE_TOKEN?.trim()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/embed`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ texts: [q], text_type: 'query' }),
    cache: 'no-store',
  })

  if (!res.ok) return null
  const payload = (await res.json()) as {
    embeddings?: unknown
    dim?: unknown
  }
  const rows = payload.embeddings
  if (!Array.isArray(rows) || !Array.isArray(rows[0])) return null
  const vector = rows[0]
  if (!vector.every((v) => typeof v === 'number')) return null
  return vector
}
