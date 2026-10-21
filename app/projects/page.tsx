import Dashboard from '@/components/dashboard'
import ProjectList from '@/components/documents/project-list'
import { requireSession } from '@/lib/session'

export default async function ProjectsPage() {
  const { role } = await requireSession()
  return <Dashboard initialRoute="projects"><ProjectList role={role} /></Dashboard>
}
