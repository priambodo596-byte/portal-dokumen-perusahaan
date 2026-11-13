import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Dashboard from '@/components/dashboard'
import StandardDocumentForm from '@/components/documents/standard-document-form'
import { can } from '@/lib/permissions'
import { requireSession } from '@/lib/session'
import { findStandardDocument, standardDocumentIsVisible } from '@/lib/templates/standard-registry'
import { getStandardTemplateFile } from '@/lib/templates/standard-files'

export default async function NewStandardDocumentPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { role, userName } = await requireSession()
  if (!can(role, 'create')) redirect('/documents')
  const { code = '' } = await searchParams
  const document = findStandardDocument(code)
  if (!document || !standardDocumentIsVisible(document, role)) notFound()
  const source = await getStandardTemplateFile(document.code)

  return <Dashboard initialRoute="documents">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Standar Dokumen PT.Palos / {document.code}</div><h1>Buat Draf {document.name}</h1><p>Draf ini memakai salinan master DOCX privat. Data belum terpetakan harus dikonfirmasi; draf tetap menunggu persetujuan manusia.</p></div></section>
    {source
      ? <StandardDocumentForm document={document} userName={userName ?? 'Pengguna'} />
      : <section className="panel"><h2>Master DOCX belum diunggah</h2><p>Admin perlu mengunggah file master yang cocok dari halaman standar sebelum draf dapat dibuat.</p><Link className="secondary-button" href="/templates">Kembali ke katalog</Link></section>}
  </Dashboard>
}
