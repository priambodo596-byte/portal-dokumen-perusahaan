import { randomUUID } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, json, readJson, route } from '@/lib/api'
import { db } from '@/lib/db'
import { templateVariables } from '@/lib/db/schema'
import { can } from '@/lib/permissions'

export const runtime = 'nodejs'
const schema = z.object({
  token: z.string().trim().min(2).max(80),
  label: z.string().trim().min(2).max(120),
  group: z.string().trim().min(2).max(80).default('Variabel Kustom'),
  description: z.string().trim().max(300).default('Placeholder bawaan sistem'),
  sampleValue: z.string().trim().max(500).default(''),
})

export const POST = route(async (req, ctx) => {
  if (!can(ctx.role, 'manage-templates')) throw new ApiError(403, 'Hanya admin yang dapat mengelola variabel placeholder.')
  const input = schema.parse(await readJson(req))
  const [existing] = await db.select({ id: templateVariables.id }).from(templateVariables).where(and(eq(templateVariables.token, input.token), isNull(templateVariables.deletedAt))).limit(1)
  if (existing) {
    const [updated] = await db.update(templateVariables).set({ label: input.label, group: input.group, description: input.description, sampleValue: input.sampleValue, updatedAt: new Date() }).where(eq(templateVariables.id, existing.id)).returning()
    return json(updated)
  }
  const [created] = await db.insert(templateVariables).values({ id: randomUUID(), ...input, createdBy: ctx.userId }).returning()
  return json(created, 201)
})
