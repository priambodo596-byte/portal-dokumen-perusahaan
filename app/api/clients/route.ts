import { asc, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { ApiError, json, readJson, route } from '@/lib/api'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { can } from '@/lib/permissions'
import { clientSchema } from '@/lib/documents/schemas'

export const GET = route(async () => json(await db.select().from(clients).where(isNull(clients.deletedAt)).orderBy(asc(clients.name))))

export const POST = route(async (req, ctx) => {
  if (!can(ctx.role, 'create')) throw new ApiError(403, 'Anda tidak berhak menambah klien.')
  const input = clientSchema.parse(await readJson(req))
  const [row] = await db.insert(clients).values({ id: randomUUID(), ...input, email: input.email || null }).returning()
  return json(row, 201)
})
