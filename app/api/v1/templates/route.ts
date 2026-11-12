import { json, route } from '@/lib/api'
import { standardDocumentIsVisible, standardDocumentSummary, standardRegistry } from '@/lib/templates/standard-registry'
import { listUploadedStandardTemplateCodes } from '@/lib/templates/standard-files'

/** Daftar standar internal. Akses tetap memerlukan sesi portal. */
export const GET = route(async (request, ctx) => {
  const query = new URL(request.url).searchParams
  const search = query.get('q')?.trim().toLocaleLowerCase('id-ID') ?? ''
  const category = query.get('category') ?? ''
  const uploadedCodes = await listUploadedStandardTemplateCodes()
  const documents = standardRegistry.documents.filter((document) => {
    if (!standardDocumentIsVisible(document, ctx.role)) return false
    const matchesSearch = !search || `${document.code} ${document.name} ${document.category} ${document.agent_role}`.toLocaleLowerCase('id-ID').includes(search)
    return matchesSearch && (!category || document.category === category)
  })
  return json({
    registry_status: standardRegistry.status,
    document_count: documents.length,
    categories: [...new Set(standardRegistry.documents.filter((document) => standardDocumentIsVisible(document, ctx.role)).map((document) => document.category))],
    documents: documents.map((document) => ({ ...standardDocumentSummary(document), master_docx_available: !!uploadedCodes[document.code] })),
  })
})
