import { randomUUID } from 'crypto'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, json, readJson, route } from '@/lib/api'
import { db } from '@/lib/db'
import { templateVariables } from '@/lib/db/schema'
import { can } from '@/lib/permissions'

export const runtime = 'nodejs'
const schema = z.object({
  token: z.string().trim().min(2).max(80).regex(/^[A-Za-z][A-Za-z0-9_.-]*$/, 'Token harus diawali huruf dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.'),
  label: z.string().trim().min(2).max(120),
  group: z.string().trim().min(2).max(80).default('Variabel Kustom'),
  description: z.string().trim().max(300).default(''),
  sampleValue: z.string().trim().max(500).default(''),
})

export const GET = route(async () => json(await db.select().from(templateVariables).where(isNull(templateVariables.deletedAt)).orderBy(asc(templateVariables.group), asc(templateVariables.label))))

export const POST = route(async (req, ctx) => {
  if (!can(ctx.role, 'manage-templates')) throw new ApiError(403, 'Hanya admin yang dapat mengelola variabel placeholder.')
  const input = schema.parse(await readJson(req))
  const [duplicate] = await db.select({ id: templateVariables.id }).from(templateVariables).where(and(eq(templateVariables.token, input.token), isNull(templateVariables.deletedAt))).limit(1)
  if (duplicate) throw new ApiError(409, 'Token sudah digunakan. Gunakan nama token yang berbeda.')
  const [created] = await db.insert(templateVariables).values({ id: randomUUID(), ...input, createdBy: ctx.userId }).returning()
  return json(created, 201)
})
