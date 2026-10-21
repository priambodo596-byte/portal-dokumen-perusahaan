import Dashboard from '@/components/dashboard'
import ClientManager from '@/components/documents/client-manager'
import { requireSession } from '@/lib/session'

export default async function MasterDataPage() {
  const { role } = await requireSession()
  return <Dashboard initialRoute="master-data">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Administrasi / Master Data</div><h1>Master Data</h1><p>Kelola data referensi klien yang digunakan dokumen.</p></div></section>
    <ClientManager role={role} />
  </Dashboard>
}
