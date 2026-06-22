import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** 进入项目详情默认落在「项目周报」Tab */
export default async function WeeklyProjectDetailRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const q = new URLSearchParams()
  for (const [key, val] of Object.entries(sp)) {
    if (typeof val === 'string') q.set(key, val)
    else if (Array.isArray(val)) {
      for (const v of val) q.append(key, v)
    }
  }
  const suffix = q.toString() ? `?${q.toString()}` : ''
  redirect(`/weekly/projects/${id}/reports${suffix}`)
}
