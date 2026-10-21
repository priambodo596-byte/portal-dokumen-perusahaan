import Dashboard from '@/components/dashboard'
import TemplateManager from '@/components/documents/template-manager'
import { can } from '@/lib/permissions'
import { listTemplates } from '@/lib/templates/service'
import { requireSession } from '@/lib/session'

export default async function TemplatesPage() {
  const { role, userName } = await requireSession()
  const templates = await listTemplates()
  return <Dashboard initialRoute="templates">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Administrasi / Template</div><h1>Template Dokumen</h1><p>Susun template dengan editor visual atau impor DOCX, lihat pratinjau langsung, unduh contoh DOCX/PDF, dan tetapkan template default per jenis dokumen.</p></div></section>
    <TemplateManager initialTemplates={templates.map((t) => ({ ...t, description: t.description ?? null }))} canManage={can(role, 'manage-templates')} userName={userName ?? 'Pengguna'} />
  </Dashboard>
}
