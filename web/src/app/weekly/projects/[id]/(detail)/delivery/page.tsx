import { PROJECT_STAGE_IMPLEMENTATION } from '@/constants/project-stage'
import ProjectStageWorkspace from '@/modules/weekly/components/projects/project-stage-workspace'

export default function ProjectDeliveryStagePage() {
  return <ProjectStageWorkspace stage={PROJECT_STAGE_IMPLEMENTATION} />
}
