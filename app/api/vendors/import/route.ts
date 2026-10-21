import { randomUUID } from 'crypto'
import { ApiError, json, readJson, route } from '@/lib/api'
import { db } from '@/lib/db'
import { auditLogs, vendors } from '@/lib/db/schema'
import { can } from '@/lib/permissions'
import { vendorSchema } from '@/lib/documents/schemas'

export const runtime = 'nodejs'

export const POST = route(async (req, ctx) => {
  if (!can(ctx.role, 'create')) throw new ApiError(403, 'Anda tidak berhak mengimpor data vendor.')
  const body = await readJson(req) as { items?: unknown[] }
  if (!Array.isArray(body?.items) || body.items.length === 0) throw new ApiError(400, 'File tidak berisi baris data untuk diimpor.')
  if (body.items.length > 500) throw new ApiError(400, 'Maksimal 500 baris per proses import.')

  let imported = 0
  const errors: { row: number; vendorCode?: string; field?: string; message: string }[] = []
  for (let i = 0; i < body.items.length; i++) {
    const parsed = vendorSchema.safeParse(body.items[i])
    const rowNumber = i + 2
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      errors.push({ row: rowNumber, field: firstIssue?.path.join('.') || 'data', message: parsed.error.issues.map((issue) => `${issue.path.length ? `${issue.path.join('.')}: ` : ''}${issue.message}`).join('; ') })
      continue
    }
    const input = parsed.data
    try {
      // Simpan vendor dan audit dalam satu transaksi agar status hasil import selalu akurat.
      await db.transaction(async (tx) => {
        const [row] = await tx.insert(vendors).values({
          id: randomUUID(), ...input,
          npwp: input.npwp?.trim() || null, address: input.address?.trim() || null,
          contactPerson: input.contactPerson?.trim() || null, email: input.email?.trim() || null,
          phone: input.phone?.trim() || null, bankName: input.bankName?.trim() || null,
          bankAccount: input.bankAccount?.trim() || null, bankAccountName: input.bankAccountName?.trim() || null,
          notes: input.notes?.trim() || null, createdBy: ctx.userId,
        }).returning()
        await tx.insert(auditLogs).values({
          id: randomUUID(), userId: ctx.userId, action: 'create', entityType: 'vendor',
          entityId: row.id, detail: { vendorCode: row.vendorCode, name: row.name, source: 'csv_import', row: rowNumber },
        })
      })
      imported++
    } catch (e) {
      const error = e as { code?: string; cause?: { code?: string; constraint?: string }; constraint?: string }
      const code = error.code ?? error.cause?.code
      if (code === '23505') errors.push({ row: rowNumber, vendorCode: input.vendorCode, field: error.constraint?.includes('npwp') || error.cause?.constraint?.includes('npwp') ? 'npwp' : 'vendorCode', message: 'Kode vendor atau NPWP sudah digunakan. Periksa duplikat di file atau data yang sudah tersimpan.' })
      else {
        console.error(`[vendors/import] Gagal pada baris ${rowNumber} (${input.vendorCode}):`, e)
        errors.push({ row: rowNumber, vendorCode: input.vendorCode, message: code === '23502' ? 'Ada kolom wajib yang kosong.' : code === '22001' ? 'Ada nilai yang melebihi batas panjang kolom.' : 'Gagal menyimpan data. Periksa koneksi database dan log server.' })
      }
    }
  }
  return json({ imported, failed: errors.length, errors })
})
