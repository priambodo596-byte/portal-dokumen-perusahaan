import { and, asc, eq, ilike, isNull, or } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { ApiError, json, readJson, route } from '@/lib/api'
import { db } from '@/lib/db'
import { auditLogs, vendors } from '@/lib/db/schema'
import { can } from '@/lib/permissions'
import { vendorSchema } from '@/lib/documents/schemas'

export const runtime = 'nodejs'

export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams
  const q = params.get('q')?.trim()
  const status = params.get('status')
  const category = params.get('category')
  const rows = await db.select().from(vendors).where(and(
    isNull(vendors.deletedAt),
    q ? or(ilike(vendors.vendorCode, `%${q}%`), ilike(vendors.name, `%${q}%`), ilike(vendors.contactPerson, `%${q}%`), ilike(vendors.email, `%${q}%`), ilike(vendors.npwp, `%${q}%`)) : undefined,
    status && ['active', 'inactive', 'blacklisted'].includes(status) ? eq(vendors.status, status) : undefined,
    category ? eq(vendors.category, category) : undefined,
  )).orderBy(asc(vendors.name))
  return json(rows)
})

export const POST = route(async (req, ctx) => {
  if (!can(ctx.role, 'create')) throw new ApiError(403, 'Anda tidak berhak menambahkan vendor.')
  const input = vendorSchema.parse(await readJson(req))
  try {
    const [row] = await db.insert(vendors).values({
      id: randomUUID(), ...input,
      npwp: input.npwp || null, address: input.address || null,
      contactPerson: input.contactPerson || null, email: input.email || null,
      phone: input.phone || null, bankName: input.bankName || null,
      bankAccount: input.bankAccount || null, bankAccountName: input.bankAccountName || null,
      notes: input.notes || null, createdBy: ctx.userId,
    }).returning()
    await db.insert(auditLogs).values({ id: randomUUID(), userId: ctx.userId, action: 'create', entityType: 'vendor', entityId: row.id, detail: { vendorCode: row.vendorCode, name: row.name } })
    return json(row, 201)
  } catch (e) {
    if ((e as { code?: string })?.code === '23505') throw new ApiError(409, 'Kode vendor atau NPWP sudah digunakan oleh vendor lain.')
    throw e
  }
})
