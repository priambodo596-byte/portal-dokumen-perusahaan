import { ApiError, type Ctx } from '@/lib/api'
import { can } from '@/lib/permissions'
import { getDocumentDetail, recordAction } from '@/lib/documents/service'
import { htmlToDocx } from './convert'
import { renderTemplate } from './render'
import { buildTemplateData, resolveTemplateForDocument } from './service'

/** Hasil render template yang siap dikonversi ke DOCX. */
export async function renderDocumentHtml(ctx: Ctx, id: string, overrideTemplateId?: string | null) {
  const d = await getDocumentDetail(id)
  if (!can(ctx.role, 'read')) throw new ApiError(403, 'Anda tidak berhak mengunduh dokumen ini.')
  const template = await resolveTemplateForDocument(d.type, overrideTemplateId ?? d.templateId)
  if (!template) throw new ApiError(409, 'Dokumen ini belum memiliki template. Unggah template default untuk jenis dokumen ini terlebih dahulu.')
  const data = await buildTemplateData(d)
  return {
    detail: d,
    template,
    body: renderTemplate(template.bodyHtml, data),
    header: renderTemplate(template.headerHtml, data),
    footer: renderTemplate(template.footerHtml, data),
    css: template.css,
  }
}

/** Bangun dokumen DOCX dari template yang berlaku untuk dokumen ini. */
export async function buildDocumentDocxFromTemplate(ctx: Ctx, id: string): Promise<{ buffer: Buffer; documentNumber: string; title: string }> {
  const r = await renderDocumentHtml(ctx, id)
  const buffer = await htmlToDocx(r.body, r.css, r.header, r.footer, { title: `${r.detail.documentNumber} — ${r.detail.title}` })
  await recordAction(ctx, 'export', id, { format: 'docx', templateId: r.template.id })
  return { buffer, documentNumber: r.detail.documentNumber, title: r.detail.title }
}
