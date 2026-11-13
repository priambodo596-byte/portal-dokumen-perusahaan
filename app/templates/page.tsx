import Dashboard from '@/components/dashboard'
import StandardTemplateCatalog from '@/components/documents/standard-template-catalog'
import TemplateManager from '@/components/documents/template-manager'
import { can } from '@/lib/permissions'
import { listTemplates } from '@/lib/templates/service'
import { requireSession } from '@/lib/session'
import { standardRegistry } from '@/lib/templates/standard-registry'
import { listUploadedStandardTemplateCodes } from '@/lib/templates/standard-files'

export default async function TemplatesPage() {
  const { role, userName } = await requireSession()
  const templates = await listTemplates()
  const standardDocuments = standardRegistry.documents.filter((document) => document.classification === 'internal' || role === 'admin' || role === 'manager')
  const uploadedCodes = await listUploadedStandardTemplateCodes()
  return <Dashboard initialRoute="templates">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Pengaturan Perusahaan / Template</div><h1>Template & Format Dokumen</h1><p>Kelola format kerja, template, dan standar dokumen perusahaan. Pilih template default sesuai jenis dokumen.</p></div></section>
    <StandardTemplateCatalog documents={standardDocuments} canManage={can(role, 'manage-templates')} initialUploadedCodes={uploadedCodes} />
    <TemplateManager initialTemplates={templates.map((t) => ({ ...t, description: t.description ?? null }))} canManage={can(role, 'manage-templates')} userName={userName ?? 'Pengguna'} />
  </Dashboard>
}
