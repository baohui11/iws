/**
 * 预览转换端口（给人看）：Office/各类格式 → 可在浏览器渲染的 PDF。
 * 实现：Gotenberg 现成容器。敏感文件可烧录水印。
 */

export interface WatermarkSpec {
  /** 水印文本，如「中大咨询-张三-2026-06-22」 */
  text: string
}

export interface ToPdfInput {
  buffer: Buffer
  ext: string
  watermark?: WatermarkSpec
}

export interface PreviewPort {
  toPdf(input: ToPdfInput): Promise<Buffer>
}
