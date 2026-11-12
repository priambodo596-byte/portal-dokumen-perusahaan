import { ApiError, json, route } from '@/lib/api'
import { findStandardDocument, sourceRequiresConfirmation, standardDocumentIsVisible } from '@/lib/templates/standard-registry'
import { getStandardTemplateFile } from '@/lib/templates/standard-files'

/** Skema satu dokumen standar, untuk form dan agent yang masuk ke portal. */
export const GET = route(async (_request, ctx, params: { code: string }) => {
  const document = findStandardDocument(params.code)
  if (!document) throw new ApiError(404, 'Kode template standar tidak ditemukan.')
  if (!standardDocumentIsVisible(document, ctx.role)) throw new ApiError(404, 'Kode template standar tidak ditemukan.')
  const source = await getStandardTemplateFile(document.code)
  return json({
    ...document,
    agent_may_publish: false,
    human_approval_required: true,
    master_docx_available: !!source,
    fields: document.fields.map((field) => ({
      ...field,
      required: field.required,
      needs_source_confirmation: sourceRequiresConfirmation(field),
    })),
  })
})
