import { json, readJson, route } from '@/lib/api'
import { createDocument, listDocuments } from '@/lib/documents/service'
import { documentInputSchema, listQuerySchema } from '@/lib/documents/schemas'

export const GET = route(async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams)
  for (const k of Object.keys(params)) if (params[k] === '') delete params[k]
  return json(await listDocuments(listQuerySchema.parse(params)))
})

export const POST = route(async (req, ctx) => {
  const input = documentInputSchema.parse(await readJson(req))
  return json(await createDocument(ctx, input), 201)
})
