/**
 * 文档解析端口（RAG）：文件 → Markdown + 资源。
 * 实现：自建解析微服务（改造 knowledge_doc_converter），内部 OCR 走线上 API。
 * 职责到 Markdown 为止；切块/向量化由主应用负责。
 */

export interface ParsedAsset {
  /** 资源在对象存储中的 key（如抽取出的图片） */
  key: string
  contentType: string
}

export interface ParseInput {
  buffer: Buffer
  ext: string
  fileName: string
}

export interface ParseResult {
  markdown: string
  assets: ParsedAsset[]
  /** 仅得到文件名/降级内容（解析失败兜底）时为 true */
  degraded: boolean
}

export interface ParserPort {
  toMarkdown(input: ParseInput): Promise<ParseResult>
}
