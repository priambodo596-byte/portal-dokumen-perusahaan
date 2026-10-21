import Dashboard from '@/components/dashboard'
import StatusDocumentList from '@/components/documents/status-document-list'
import { requireSession } from '@/lib/session'

const STATUSES = ['pending', 'review']

export default async function ApprovalsPage() {
  const { userId, role } = await requireSession()
  return <Dashboard initialRoute="approvals">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Proses / Persetujuan</div><h1>Persetujuan</h1><p>Dokumen yang menunggu persetujuan atau sedang dalam review.</p></div></section>
    <StatusDocumentList statuses={STATUSES} userId={userId} role={role} emptyTitle="Tidak ada dokumen menunggu" emptyDescription="Semua dokumen sudah ditindaklanjuti." />
  </Dashboard>
}
