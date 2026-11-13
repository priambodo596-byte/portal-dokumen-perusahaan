import Dashboard from '@/components/dashboard'
import TokenLibrary from '@/components/documents/token-library'
import { requireSession } from '@/lib/session'
import { can } from '@/lib/permissions'

export default async function TemplateVariablesPage() {
  const { role } = await requireSession()
  return <Dashboard initialRoute="templates/variables">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Pengaturan Perusahaan / Template</div><h1>Field & Placeholder</h1><p>Referensi field dan token yang dipakai pada template dokumen. Cari, salin, lalu gunakan token saat menyusun format dokumen.</p></div></section>
    <TokenLibrary canManage={can(role, 'manage-templates')} />
  </Dashboard>
}
