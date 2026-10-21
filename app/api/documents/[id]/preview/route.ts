import { json, route } from '@/lib/api'
import { renderTemplate } from '@/lib/templates/render'
import { sanitizeTemplateHtml } from '@/lib/templates/sanitize'
import { buildTemplateData, resolveTemplateForDocument } from '@/lib/templates/service'
import { getDocumentDetail } from '@/lib/documents/service'

export const runtime = 'nodejs'
type P = { id: string }

/** Pratinjau dokumen memakai template yang berlaku (override dokumen atau default jenis). */
export const GET = route<P>(async (req, _ctx, { id }) => {
  const url = new URL(req.url)
  const override = url.searchParams.get('templateId')
  const d = await getDocumentDetail(id)
  const template = await resolveTemplateForDocument(d.type, override ?? d.templateId)
  if (!template) {
    return json({ template: null, body: '', header: '', footer: '', css: '' })
  }
  const data = await buildTemplateData(d)
  return json({
    template: { id: template.id, name: template.name, type: template.type, mode: template.mode },
    body: sanitizeTemplateHtml(renderTemplate(template.bodyHtml, data)),
    header: sanitizeTemplateHtml(renderTemplate(template.headerHtml, data)),
    footer: sanitizeTemplateHtml(renderTemplate(template.footerHtml, data)),
    css: template.css,
  })
})
