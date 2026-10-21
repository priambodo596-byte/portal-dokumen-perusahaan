import { Suspense } from 'react'
import Dashboard from '@/components/dashboard'
import DocumentList from '@/components/documents/document-list'
import { LoadingSkeleton } from '@/components/documents/shared'
import { requireSession } from '@/lib/session'

export default async function DocumentsPage() {
  const { userId, role } = await requireSession()
  return <Dashboard initialRoute="documents"><Suspense fallback={<LoadingSkeleton />}><DocumentList userId={userId} role={role} /></Suspense></Dashboard>
}
