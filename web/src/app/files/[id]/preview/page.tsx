import { notFound } from 'next/navigation'
import FilePreviewPageClient from '@/modules/files/components/preview/file-preview-page-client'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function safeReturnTo(value: string | string[] | undefined): string | undefined {
  const path = typeof value === 'string' ? value : value?.[0]
  return path?.startsWith('/files/search') ? path : undefined
}

export default async function FilePreviewPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  if (!id?.trim()) notFound()
  return <FilePreviewPageClient fileId={id.trim()} returnTo={safeReturnTo(sp.returnTo)} />
}
