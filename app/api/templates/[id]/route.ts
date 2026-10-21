import { ApiError, json, readJson, route } from '@/lib/api'
import { can } from '@/lib/permissions'
import { templateUpdateSchema } from '@/lib/templates/schemas'
import { deleteTemplate, getTemplate, setDefaultTemplate, updateTemplate } from '@/lib/templates/service'

export const runtime = 'nodejs'
type P = { id: string }

export const GET = route<P>(async (_req, _ctx, { id }) => json(await getTemplate(id)))

export const PATCH = route<P>(async (req, ctx, { id }) => {
  if (!can(ctx.role, 'manage-templates')) throw new ApiError(403, 'Hanya admin yang dapat mengelola template.')
  const input = templateUpdateSchema.parse(await readJson(req))
  const updated = await updateTemplate(id, input, { userId: ctx.userId, userName: ctx.userName })
  // Menandai default sekaligus memperbarui nilai default-nya.
  if (input.isDefault === true) return json(await setDefaultTemplate(id))
  return json(updated)
})

export const DELETE = route<P>(async (_req, ctx, { id }) => {
  if (!can(ctx.role, 'manage-templates')) throw new ApiError(403, 'Hanya admin yang dapat mengelola template.')
  await deleteTemplate(id)
  return json({ ok: true })
})
