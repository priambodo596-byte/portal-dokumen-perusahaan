import { json, readJson, route } from '@/lib/api'
import { transitionDocument } from '@/lib/documents/service'
import { transitionSchema } from '@/lib/documents/schemas'

export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const input = transitionSchema.parse(await readJson(req))
  return json(await transitionDocument(ctx, id, input))
})
