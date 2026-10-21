import { redirect } from 'next/navigation'
import Dashboard from '@/components/dashboard'
import DocumentForm from '@/components/documents/document-form'
import { can } from '@/lib/permissions'
import { requireSession } from '@/lib/session'

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { role } = await requireSession()
  if (!can(role, 'create')) redirect('/documents')
  const { type } = await searchParams
  return <Dashboard initialRoute="documents"><DocumentForm defaultType={type} /></Dashboard>
}
