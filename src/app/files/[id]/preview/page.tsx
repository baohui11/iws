import { notFound } from 'next/navigation'
import FilePreviewPageClient from '@/components/file-preview/file-preview-page-client'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function FilePreviewPage({ params }: PageProps) {
  const { id } = await params
  if (!id?.trim()) notFound()
  return <FilePreviewPageClient fileId={id.trim()} />
}
