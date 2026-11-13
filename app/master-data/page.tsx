import Dashboard from '@/components/dashboard'
import ClientManager from '@/components/documents/client-manager'
import { requireSession } from '@/lib/session'

export default async function MasterDataPage() {
  const { role } = await requireSession()
  return <Dashboard initialRoute="master-data">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Operasional / Klien</div><h1>Klien & Pelanggan</h1><p>Kelola data klien yang digunakan pada dokumen dan proyek perusahaan.</p></div></section>
    <ClientManager role={role} />
  </Dashboard>
}
