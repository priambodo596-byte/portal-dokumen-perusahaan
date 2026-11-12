import Dashboard from '@/components/dashboard'
import StandardTemplateCatalog from '@/components/documents/standard-template-catalog'
import { requireSession } from '@/lib/session'
import { standardRegistry } from '@/lib/templates/standard-registry'
import { listUploadedStandardTemplateCodes } from '@/lib/templates/standard-files'
import { can } from '@/lib/permissions'

export default async function StandardTemplatesPage() {
  const { role } = await requireSession()
  const documents = standardRegistry.documents.filter((document) => document.classification === 'internal' || role === 'admin' || role === 'manager')
  const uploadedCodes = await listUploadedStandardTemplateCodes()
  return <Dashboard initialRoute="templates/standar">
    <section className="page-heading">
      <div>
        <div className="eyebrow"><span className="eyebrow-dot" /> Administrasi / Standar PT.Palos</div>
        <h1>Pustaka Dokumen Standar</h1>
        <p>Referensi metadata {documents.length} dokumen yang dapat diakses akun Anda, skema isian untuk agent, klasifikasi akses, dan jalur persetujuan. File DOCX master belum dihosting oleh portal.</p>
      </div>
    </section>
    <StandardTemplateCatalog documents={documents} canManage={can(role, 'manage-templates')} initialUploadedCodes={uploadedCodes} />
  </Dashboard>
}
