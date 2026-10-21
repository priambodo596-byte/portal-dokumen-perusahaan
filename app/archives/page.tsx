import Dashboard from '@/components/dashboard'
import StatusDocumentList from '@/components/documents/status-document-list'
import { requireSession } from '@/lib/session'

const STATUSES = ['published', 'archived']

export default async function ArchivesPage() {
  await requireSession()
  return <Dashboard initialRoute="archives">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Proses / Arsip</div><h1>Arsip Dokumen</h1><p>Dokumen final yang telah diterbitkan atau diarsipkan.</p></div></section>
    <StatusDocumentList statuses={STATUSES} emptyTitle="Belum ada dokumen diarsipkan" emptyDescription="Dokumen yang diterbitkan akan muncul di sini." />
  </Dashboard>
}
