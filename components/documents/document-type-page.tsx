import Dashboard from '@/components/dashboard'
import DocumentTypeList from '@/components/documents/document-type-list'
import { requireSession } from '@/lib/session'

/** Halaman untuk satu jenis dokumen. Dipakai oleh rute tiap jenis di sidebar. */
export default async function DocumentTypePage({ type, route, title, description }: { type: string; route: string; title: string; description: string }) {
  const { userId, role } = await requireSession()
  return <Dashboard initialRoute={route}>
    <DocumentTypeList type={type} title={title} description={description} userId={userId} role={role} />
  </Dashboard>
}
