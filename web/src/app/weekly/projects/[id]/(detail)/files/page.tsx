import ProjectFilesTab from '@/modules/files/components/project-files/project-files-tab'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ProjectFilesPage({ params }: PageProps) {
  const { id } = await params
  return <ProjectFilesTab projectId={id} />
}
