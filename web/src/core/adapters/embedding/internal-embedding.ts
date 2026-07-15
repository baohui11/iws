const QUERY_TIMEOUT_MS = Math.max(
  100,
  Number(process.env.EMBEDDING_QUERY_TIMEOUT_MS ?? 2500)
)
const CACHE_TTL_MS = Math.max(
  0,
  Number(process.env.EMBEDDING_QUERY_CACHE_TTL_MS ?? 60_000)
)
const MAX_QUERY_CHARS = Math.max(
  1,
  Number(process.env.EMBEDDING_QUERY_MAX_CHARS ?? 2_000)
)
const cache = new Map<string, { expiresAt: number; vector: number[] }>()

export type QueryEmbeddingResult =
  | { vector: number[]; cacheHit: boolean }
  | { vector: null; cacheHit: false; reason: 'disabled' | 'empty' | 'too_long' | 'unavailable' }

export async function embedQueryText(text: string): Promise<QueryEmbeddingResult> {
  const baseUrl = process.env.EMBEDDING_SERVICE_URL?.trim()
  if (!baseUrl) return { vector: null, cacheHit: false, reason: 'disabled' }

  const q = text.trim()
  if (!q) return { vector: null, cacheHit: false, reason: 'empty' }
  if (q.length > MAX_QUERY_CHARS) {
    return { vector: null, cacheHit: false, reason: 'too_long' }
  }

  const cached = cache.get(q)
  if (cached && cached.expiresAt > Date.now()) {
    return { vector: cached.vector, cacheHit: true }
  }
  if (cached) cache.delete(q)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = process.env.EMBEDDING_SERVICE_TOKEN?.trim()
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/embed`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ texts: [q], text_type: 'query' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    })
    if (!res.ok) return { vector: null, cacheHit: false, reason: 'unavailable' }
    const payload = (await res.json()) as {
      embeddings?: unknown
      dim?: unknown
    }
    const rows = payload.embeddings
    if (!Array.isArray(rows) || !Array.isArray(rows[0])) {
      return { vector: null, cacheHit: false, reason: 'unavailable' }
    }
    const vector = rows[0]
    if (!vector.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      return { vector: null, cacheHit: false, reason: 'unavailable' }
    }
    const normalized = vector as number[]
    if (CACHE_TTL_MS > 0) {
      cache.set(q, { vector: normalized, expiresAt: Date.now() + CACHE_TTL_MS })
    }
    return { vector: normalized, cacheHit: false }
  } catch {
    return { vector: null, cacheHit: false, reason: 'unavailable' }
  }
}
