import { json, route } from '@/lib/api'
import { duplicateDocument } from '@/lib/documents/service'

export const POST = route<{ id: string }>(async (_req, ctx, { id }) => json(await duplicateDocument(ctx, id), 201))
