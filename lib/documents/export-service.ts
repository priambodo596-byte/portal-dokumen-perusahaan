import { ApiError, type Ctx } from '@/lib/api'
import { can } from '@/lib/permissions'
import { getDocumentDetail, recordAction } from './service'

// Bentuk minimal data dokumen untuk export (dipakai generator PDF).
export type ExportData = {
  documentNumber: string; title: string; type: string; status: string; documentDate: string; notes: string | null
  version: number; subtotal: number; discount: number; taxRate: string; taxAmount: number; total: number
  client: { name: string; address: string | null; contactPerson: string | null; email: string | null; phone: string | null } | null
  project: { name: string; code: string | null } | null
  creatorName: string | null
  items: { position: number; description: string; unit: string | null; quantity: string; unitPrice: number; amount: number }[]
}

/** Ambil & validasi dokumen untuk export sesuai hak akses pembaca. */
export async function loadForExport(ctx: Ctx, id: string): Promise<ExportData & { id: string }> {
  const d = await getDocumentDetail(id)
  if (!can(ctx.role, 'read')) throw new ApiError(403, 'Anda tidak berhak mengunduh dokumen ini.')
  const { db } = await import('@/lib/db')
  const { systemSettings } = await import('@/lib/db/schema')
  const { eq } = await import('drizzle-orm')
  const [settingsRow] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.id, 'global')).limit(1)
  const policy = (settingsRow?.value ?? {}) as Record<string, unknown>
  if (policy.requireApprovalBeforeExport !== false && !['approved', 'published', 'archived'].includes(d.status)) throw new ApiError(409, 'Ekspor dokumen final belum diizinkan. Selesaikan alur persetujuan terlebih dahulu.')
  return {
    id: d.id, documentNumber: d.documentNumber, title: d.title, type: d.type, status: d.status, documentDate: d.documentDate,
    notes: d.notes, version: d.version, subtotal: d.subtotal, discount: d.discount, taxRate: d.taxRate, taxAmount: d.taxAmount, total: d.total,
    client: d.client ? { name: d.client.name, address: d.client.address, contactPerson: d.client.contactPerson, email: d.client.email, phone: d.client.phone } : null,
    project: d.project ? { name: d.project.name, code: d.project.code } : null,
    creatorName: d.creatorName,
    items: d.items.map((i) => ({ position: i.position, description: i.description, unit: i.unit, quantity: i.quantity, unitPrice: i.unitPrice, amount: i.amount })),
  }
}

export async function auditExport(ctx: Ctx, id: string, format: string) {
  await recordAction(ctx, 'export', id, { format })
}
