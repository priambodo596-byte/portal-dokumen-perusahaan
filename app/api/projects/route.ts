import { asc, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { ApiError, json, readJson, route } from '@/lib/api'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { can } from '@/lib/permissions'
import { projectSchema } from '@/lib/documents/schemas'

export const GET = route(async () => json(await db.select().from(projects).where(isNull(projects.deletedAt)).orderBy(asc(projects.name))))

export const POST = route(async (req, ctx) => {
  if (!can(ctx.role, 'create')) throw new ApiError(403, 'Anda tidak berhak menambah proyek.')
  const input = projectSchema.parse(await readJson(req))
  const [row] = await db.insert(projects).values({ id: randomUUID(), ...input }).returning()
  return json(row, 201)
})
