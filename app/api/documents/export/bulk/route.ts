import JSZip from 'jszip'
import { ApiError, readJson, route } from '@/lib/api'
import { buildDocumentPdf } from '@/lib/documents/export-pdf'
import { exportFileName } from '@/lib/documents/filenames'
import { auditExport, loadForExport } from '@/lib/documents/export-service'
import { buildDocumentDocxFromTemplate } from '@/lib/templates/export'
import { bulkExportSchema } from '@/lib/documents/schemas'

export const runtime = 'nodejs'
export const maxDuration = 300

export const POST = route(async (req, ctx) => {
  const { ids, format } = bulkExportSchema.parse(await readJson(req))
  const zip = new JSZip()
  const failures: string[] = []
  let ok = 0

  for (const id of ids) {
    try {
      if (format === 'docx') {
        const { buffer, documentNumber, title } = await buildDocumentDocxFromTemplate(ctx, id)
        zip.file(exportFileName(documentNumber, title, 'docx'), buffer)
      } else {
        const data = await loadForExport(ctx, id)
        const buf = await buildDocumentPdf(data)
        zip.file(exportFileName(data.documentNumber, data.title, 'pdf'), buf)
        await auditExport(ctx, id, 'bulk-pdf')
      }
      ok++
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Gagal membuat file.'
      failures.push(`${id}: ${msg}`)
    }
  }

  if (ok === 0) throw new ApiError(422, `Tidak ada dokumen yang berhasil di-export. ${failures.slice(0, 5).join(' | ')}`)
  if (failures.length) zip.file('_gagal.txt', `Dokumen yang gagal di-export (${failures.length}):\n${failures.join('\n')}`)

  const out = await zip.generateAsync({ type: 'nodebuffer' })
  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(new Uint8Array(out), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="export-${format}-${stamp}.zip"`,
      'Content-Length': String(out.length),
      'X-Export-Success': String(ok),
      'X-Export-Failed': String(failures.length),
      'Cache-Control': 'no-store',
    },
  })
})
