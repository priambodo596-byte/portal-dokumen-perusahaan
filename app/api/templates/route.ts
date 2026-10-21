import { ApiError, json, readJson, route } from '@/lib/api'
import { can } from '@/lib/permissions'
import { templateInputSchema } from '@/lib/templates/schemas'
import { createTemplate, listTemplates } from '@/lib/templates/service'

export const runtime = 'nodejs'

export const GET = route(async () => json(await listTemplates()))

export const POST = route(async (req, ctx) => {
  if (!can(ctx.role, 'manage-templates')) throw new ApiError(403, 'Hanya admin yang dapat mengelola template.')
  const input = templateInputSchema.parse(await readJson(req))
  return json(await createTemplate(ctx.userId, input, ctx.userName), 201)
})
