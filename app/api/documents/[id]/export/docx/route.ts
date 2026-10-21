import { route } from '@/lib/api'
import { exportFileName } from '@/lib/documents/filenames'
import { buildDocumentDocxFromTemplate } from '@/lib/templates/export'

export const runtime = 'nodejs'
export const maxDuration = 60

export const POST = route<{ id: string }>(async (_req, ctx, { id }) => {
  const { buffer, documentNumber, title } = await buildDocumentDocxFromTemplate(ctx, id)
  const name = exportFileName(documentNumber, title, 'docx')
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  })
})
