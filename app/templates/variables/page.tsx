import Dashboard from '@/components/dashboard'
import TokenLibrary from '@/components/documents/token-library'
import { requireSession } from '@/lib/session'
import { can } from '@/lib/permissions'

export default async function TemplateVariablesPage() {
  const { role } = await requireSession()
  return <Dashboard initialRoute="templates/variables">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Administrasi / Template Dokumen</div><h1>Variabel & Placeholder</h1><p>Referensi semua placeholder yang dapat dipakai pada template surat dan dokumen. Cari, salin, lalu tempel token ke template; placeholder waktu diisi otomatis saat dokumen dirender.</p></div></section>
    <TokenLibrary canManage={can(role, 'manage-templates')} />
  </Dashboard>
}
