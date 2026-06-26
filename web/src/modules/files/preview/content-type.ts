import { normalizeExt } from '@/modules/files/lib/file-preview-kind'

export { normalizeExt }

export function previewContentUrl(
  fileId: string,
  variant?: 'preview'
): string {
  const base = `/api/files/${encodeURIComponent(fileId)}/content`
  if (variant === 'preview') {
    return `${base}?variant=preview`
  }
  return base
}

export function resolvePreviewContentType(params: {
  ext: string
  mimeType: string | null
  variant: string | null
}): string {
  const { ext, mimeType, variant } = params
  const mime = mimeType?.trim()

  if (variant === 'preview') return 'application/pdf'

  if (mime?.startsWith('image/')) return mime
  if (mime?.startsWith('video/')) return mime
  if (mime?.startsWith('audio/')) return mime
  if (mime === 'application/pdf') return mime

  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'bmp':
      return 'image/bmp'
    case 'svg':
      return 'image/svg+xml'
    case 'pdf':
      return 'application/pdf'
    case 'mp4':
      return 'video/mp4'
    case 'webm':
      return 'video/webm'
    case 'mov':
      return 'video/quicktime'
    case 'mp3':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/wav'
    case 'aac':
      return 'audio/aac'
    case 'm4a':
      return 'audio/mp4'
    case 'flac':
      return 'audio/flac'
    case 'ogg':
      return 'audio/ogg'
    default:
      return mime || 'application/octet-stream'
  }
}
