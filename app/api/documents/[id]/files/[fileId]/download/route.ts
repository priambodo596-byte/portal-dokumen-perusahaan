import { NextResponse } from 'next/server'
import { ApiError, route } from '@/lib/api'
import { getFileForDownload } from '@/lib/documents/service'
import { can } from '@/lib/permissions'
import { safeFileName } from '@/lib/documents/filenames'

export const runtime = 'nodejs'

export const GET = route<{ id: string; fileId: string }>(async (_req, ctx, { id, fileId }) => {
  const { file, documentId, createdBy } = await getFileForDownload(fileId)
  if (documentId !== id) throw new ApiError(404, 'File tidak ditemukan pada dokumen ini.')
  if (!can(ctx.role, 'read', { userId: ctx.userId, ownerId: createdBy })) throw new ApiError(403, 'Anda tidak berhak mengunduh file ini.')
  const name = safeFileName(file.fileName, 'file')
  return new NextResponse(new Uint8Array(file.content), {
    status: 200,
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(file.size),
      'Cache-Control': 'private, no-store',
    },
  })
})
