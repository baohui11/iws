/**
 * 向量化端口。实现：中文 embedding 模型（如 bge-m3），本地服务或 OpenAI 兼容 API。
 */

export interface EmbeddingPort {
  /** 向量维度（建表 / 校验用） */
  readonly dimensions: number
  embed(texts: string[]): Promise<number[][]>
}
