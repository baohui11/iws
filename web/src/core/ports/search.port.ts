/**
 * 检索端口（RAG 混合检索）。实现：目标 PG（pgvector + BM25/全文 + RRF），
 * 经此接口保留切回 Meilisearch / 专用向量库的能力。
 */

export interface SearchChunk {
  /** 分块全局唯一 id */
  id: string
  content: string
  /** 向量（由 EmbeddingPort 产出）；缺省表示仅做关键词索引 */
  embedding?: number[]
  metadata?: Record<string, unknown>
}

export interface SearchFilters {
  projectId?: string
  departmentId?: string
  uploaderId?: string
  fileType?: string
  fileExt?: string
}

export interface SearchHit {
  id: string
  docId: string
  content: string
  /** 融合后排序分（RRF / rerank） */
  score: number
  highlights?: { content?: string; fileName?: string }
  metadata?: Record<string, unknown>
}

export interface SearchResult {
  hits: SearchHit[]
  total: number | null
  tookMs?: number
}

export interface HybridSearchQuery {
  query: string
  filters?: SearchFilters
  topK?: number
}

export interface SearchPort {
  upsertChunks(docId: string, chunks: SearchChunk[]): Promise<void>
  removeDoc(docId: string): Promise<void>
  hybridSearch(q: HybridSearchQuery): Promise<SearchResult>
}
