import { notFound, redirect } from 'next/navigation'
import Dashboard from '@/components/dashboard'
import DocumentForm from '@/components/documents/document-form'
import { ApiError } from '@/lib/api'
import { EDITABLE_STATUSES } from '@/lib/documents/constants'
import { getDocumentDetail } from '@/lib/documents/service'
import { can } from '@/lib/permissions'
import { requireSession } from '@/lib/session'

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, role } = await requireSession()
  const { id } = await params
  const doc = await getDocumentDetail(id).catch((e) => { if (e instanceof ApiError && e.status === 404) notFound(); throw e })
  if (!EDITABLE_STATUSES.includes(doc.status) || !can(role, 'edit', { userId, ownerId: doc.createdBy })) redirect(`/documents/${id}`)
  return <Dashboard initialRoute="documents"><DocumentForm initial={{
    id: doc.id, type: doc.type, title: doc.title, documentNumber: doc.documentNumber, documentDate: doc.documentDate, clientId: doc.clientId, projectId: doc.projectId,
    notes: doc.notes, discount: doc.discount, taxRate: doc.taxRate, version: doc.version, items: doc.items.map((i) => ({ description: i.description, unit: i.unit, quantity: i.quantity, unitPrice: i.unitPrice })),
  }} /></Dashboard>
}
