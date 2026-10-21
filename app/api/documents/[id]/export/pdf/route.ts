import { route } from '@/lib/api'
import { htmlToPdf } from '@/lib/templates/pdf'
import { renderDocumentHtml } from '@/lib/templates/export'
import { exportFileName } from '@/lib/documents/filenames'
import { auditExport, loadForExport } from '@/lib/documents/export-service'

export const runtime = 'nodejs'

export const POST = route<{ id: string }>(async (_req, ctx, { id }) => {
  const data = await loadForExport(ctx, id)
  const rendered = await renderDocumentHtml(ctx, id)
  const buf = await htmlToPdf(rendered.body, {
    title: data.documentNumber + ' - ' + data.title,
    header: rendered.header,
    footer: rendered.footer,
  })
  await auditExport(ctx, id, 'pdf')
  const name = exportFileName(data.documentNumber, data.title, 'pdf')
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store',
    },
  })
})
