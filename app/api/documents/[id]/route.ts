import { json, readJson, route } from '@/lib/api'
import { deleteDocument, getDocumentDetail, updateDocument } from '@/lib/documents/service'
import { documentUpdateSchema } from '@/lib/documents/schemas'

type P = { id: string }

export const GET = route<P>(async (_req, _ctx, { id }) => json(await getDocumentDetail(id)))

export const PATCH = route<P>(async (req, ctx, { id }) => {
  const { expectedVersion, ...input } = documentUpdateSchema.parse(await readJson(req))
  return json(await updateDocument(ctx, id, input, expectedVersion))
})

export const DELETE = route<P>(async (_req, ctx, { id }) => json(await deleteDocument(ctx, id)))
