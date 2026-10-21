import { z } from 'zod'
import { ApiError, json, readJson, route } from '@/lib/api'
import { can } from '@/lib/permissions'
import { listTemplateVersions, restoreTemplateVersion } from '@/lib/templates/service'

export const runtime = 'nodejs'
type P = { id: string }

/** Riwayat versi template (terbaru lebih dulu). */
export const GET = route<P>(async (_req, _ctx, { id }) => json(await listTemplateVersions(id)))

const restoreSchema = z.object({ versionId: z.string().min(1) })

/** Pulihkan template ke versi tertentu; hasilnya dicatat sebagai versi baru. */
export const POST = route<P>(async (req, ctx, { id }) => {
  if (!can(ctx.role, 'manage-templates')) throw new ApiError(403, 'Hanya admin yang dapat mengelola template.')
  const { versionId } = restoreSchema.parse(await readJson(req))
  return json(await restoreTemplateVersion(id, versionId, { userId: ctx.userId, userName: ctx.userName }))
})
