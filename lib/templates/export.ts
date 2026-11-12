import { ApiError, type Ctx } from '@/lib/api'
import { can } from '@/lib/permissions'
import { getDocumentDetail, recordAction } from '@/lib/documents/service'
import { htmlToDocx } from './convert'
import { renderTemplate } from './render'
import { buildTemplateData, resolveTemplateForDocument } from './service'
import { findStandardDocument, standardDocumentIsVisible } from './standard-registry'
import { getStandardTemplateFile } from './standard-files'
import { renderStandardDocx } from './standard-docx'

/** Hasil render template yang siap dikonversi ke DOCX. */
export async function renderDocumentHtml(ctx: Ctx, id: string, overrideTemplateId?: string | null) {
  const d = await getDocumentDetail(id, ctx.role)
  if (!can(ctx.role, 'read')) throw new ApiError(403, 'Anda tidak berhak mengunduh dokumen ini.')
  if (d.templateId?.startsWith('standard:')) throw new ApiError(409, 'Template standar menggunakan file DOCX master. PDF belum diaktifkan di server ini; ekspor Word tersedia.')
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
  const d = await getDocumentDetail(id, ctx.role)
  if (d.templateId?.startsWith('standard:')) {
    const code = d.templateId.slice('standard:'.length)
    const standard = findStandardDocument(code)
    if (!standard || !standardDocumentIsVisible(standard, ctx.role)) throw new ApiError(404, 'Template standar tidak ditemukan.')
    const source = await getStandardTemplateFile(code)
    if (!source) throw new ApiError(409, 'Master DOCX standar tidak tersedia.')
    if (d.fields._standard_template_sha256 !== source.sha256) throw new ApiError(409, 'Master DOCX berubah setelah draf dibuat. Buat draf baru agar memakai versi master yang benar.')
    const standardData = await buildTemplateData(d)
    const rendered = await renderStandardDocx(source.content, d, standard, standardData.company as unknown as Record<string, unknown>)
    await recordAction(ctx, 'export', id, { format: 'docx', templateCode: code, missingFields: rendered.missingFields })
    return { buffer: rendered.buffer, documentNumber: d.documentNumber, title: d.title }
  }
  const r = await renderDocumentHtml(ctx, id)
  const buffer = await htmlToDocx(r.body, r.css, r.header, r.footer, { title: `${r.detail.documentNumber} — ${r.detail.title}` })
  await recordAction(ctx, 'export', id, { format: 'docx', templateId: r.template.id })
  return { buffer, documentNumber: r.detail.documentNumber, title: r.detail.title }
}
