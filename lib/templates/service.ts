import { randomUUID } from 'crypto'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { systemSettings, templates, templateVersions } from '@/lib/db/schema'
import { ApiError } from '@/lib/api'
import { COMPANY } from '@/lib/company'
import { typeLabel } from '@/lib/documents/constants'
import { sanitizeTemplateHtml } from './sanitize'
import type { TemplateData } from './tokens'

export type TemplateRow = typeof templates.$inferSelect
export type TemplateInput = {
  name: string; type: string; description?: string | null
  bodyHtml: string; css?: string; headerHtml?: string; footerHtml?: string
  mode?: 'html' | 'docx'; sourceFileName?: string | null; isDefault?: boolean
}

const newId = () => randomUUID()

export async function listTemplates() {
  return db.select().from(templates).where(isNull(templates.deletedAt)).orderBy(desc(templates.isDefault), desc(templates.updatedAt))
}

export async function getTemplate(id: string): Promise<TemplateRow> {
  const [row] = await db.select().from(templates).where(and(eq(templates.id, id), isNull(templates.deletedAt))).limit(1)
  if (!row) throw new ApiError(404, 'Template tidak ditemukan.')
  return row
}

export async function getDefaultTemplateForType(type: string): Promise<TemplateRow | null> {
  const [row] = await db.select().from(templates).where(and(eq(templates.type, type), eq(templates.isDefault, true), isNull(templates.deletedAt))).limit(1)
  return row ?? null
}

/** Resolusi template untuk dokumen: override dokumen → default jenis → null. */
export async function resolveTemplateForDocument(type: string, templateId: string | null): Promise<TemplateRow | null> {
  if (templateId) {
    const [row] = await db.select().from(templates).where(and(eq(templates.id, templateId), isNull(templates.deletedAt))).limit(1)
    if (row) return row
  }
  return getDefaultTemplateForType(type)
}

function cleanHtml(html: string | undefined): string {
  return sanitizeTemplateHtml(html ?? '')
}

export type Actor = { userId: string; userName?: string | null }
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Simpan snapshot isi template sebagai versi berikutnya. */
async function snapshotVersion(tx: Tx, t: Pick<TemplateRow, 'id' | 'name' | 'bodyHtml' | 'css' | 'headerHtml' | 'footerHtml'>, actor: Actor) {
  const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${templateVersions.version}), 0) + 1` }).from(templateVersions).where(eq(templateVersions.templateId, t.id))
  await tx.insert(templateVersions).values({
    id: newId(), templateId: t.id, version: Number(next), name: t.name, bodyHtml: t.bodyHtml, css: t.css,
    headerHtml: t.headerHtml, footerHtml: t.footerHtml, savedBy: actor.userId, savedByName: actor.userName ?? null,
  })
}

export async function createTemplate(userId: string, input: TemplateInput, userName?: string | null): Promise<TemplateRow> {
  const id = newId()
  await db.transaction(async (tx) => {
    if (input.isDefault) await tx.update(templates).set({ isDefault: false }).where(and(eq(templates.type, input.type), eq(templates.isDefault, true)))
    const values = {
      id, name: input.name, type: input.type, description: input.description ?? null,
      bodyHtml: cleanHtml(input.bodyHtml), css: input.css ?? '', headerHtml: cleanHtml(input.headerHtml), footerHtml: cleanHtml(input.footerHtml),
      mode: input.mode ?? 'html', sourceFileName: input.sourceFileName ?? null, isDefault: input.isDefault ?? false, uploadedBy: userId,
    }
    await tx.insert(templates).values(values)
    await snapshotVersion(tx, values, { userId, userName })
  })
  return getTemplate(id)
}

export async function updateTemplate(id: string, input: Partial<TemplateInput>, actor?: Actor): Promise<TemplateRow> {
  const current = await getTemplate(id)
  const next = {
    id, name: input.name ?? current.name,
    bodyHtml: input.bodyHtml !== undefined ? cleanHtml(input.bodyHtml) : current.bodyHtml,
    css: input.css ?? current.css,
    headerHtml: input.headerHtml !== undefined ? cleanHtml(input.headerHtml) : current.headerHtml,
    footerHtml: input.footerHtml !== undefined ? cleanHtml(input.footerHtml) : current.footerHtml,
  }
  const contentChanged = next.name !== current.name || next.bodyHtml !== current.bodyHtml || next.css !== current.css || next.headerHtml !== current.headerHtml || next.footerHtml !== current.footerHtml
  await db.transaction(async (tx) => {
    if (input.isDefault) await tx.update(templates).set({ isDefault: false }).where(and(eq(templates.type, current.type), eq(templates.isDefault, true)))
    if (contentChanged && actor) {
      // Template lama (dibuat sebelum fitur riwayat) belum punya versi: simpan kondisi sebelumnya dulu.
      const [{ n }] = await tx.select({ n: sql<number>`count(*)` }).from(templateVersions).where(eq(templateVersions.templateId, id))
      if (Number(n) === 0) await snapshotVersion(tx, current, { userId: current.uploadedBy, userName: null })
      await snapshotVersion(tx, next, actor)
    }
    await tx.update(templates).set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.bodyHtml !== undefined ? { bodyHtml: cleanHtml(input.bodyHtml) } : {}),
      ...(input.css !== undefined ? { css: input.css } : {}),
      ...(input.headerHtml !== undefined ? { headerHtml: cleanHtml(input.headerHtml) } : {}),
      ...(input.footerHtml !== undefined ? { footerHtml: cleanHtml(input.footerHtml) } : {}),
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.sourceFileName !== undefined ? { sourceFileName: input.sourceFileName } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      updatedAt: new Date(),
    }).where(eq(templates.id, id))
  })
  return getTemplate(id)
}

export async function listTemplateVersions(templateId: string) {
  await getTemplate(templateId)
  return db.select({
    id: templateVersions.id, version: templateVersions.version, name: templateVersions.name,
    savedByName: templateVersions.savedByName, createdAt: templateVersions.createdAt,
  }).from(templateVersions).where(eq(templateVersions.templateId, templateId)).orderBy(desc(templateVersions.version))
}

/** Pulihkan isi template dari sebuah versi; pemulihan dicatat sebagai versi baru. */
export async function restoreTemplateVersion(templateId: string, versionId: string, actor: Actor): Promise<TemplateRow> {
  await getTemplate(templateId)
  const [v] = await db.select().from(templateVersions).where(and(eq(templateVersions.id, versionId), eq(templateVersions.templateId, templateId))).limit(1)
  if (!v) throw new ApiError(404, 'Versi template tidak ditemukan.')
  return updateTemplate(templateId, { name: v.name, bodyHtml: v.bodyHtml, css: v.css, headerHtml: v.headerHtml, footerHtml: v.footerHtml }, actor)
}

export async function deleteTemplate(id: string): Promise<void> {
  await getTemplate(id)
  await db.update(templates).set({ deletedAt: new Date(), isDefault: false }).where(eq(templates.id, id))
}

export async function setDefaultTemplate(id: string): Promise<TemplateRow> {
  const current = await getTemplate(id)
  await db.transaction(async (tx) => {
    await tx.update(templates).set({ isDefault: false }).where(and(eq(templates.type, current.type), eq(templates.isDefault, true)))
    await tx.update(templates).set({ isDefault: true, updatedAt: new Date() }).where(eq(templates.id, id))
  })
  return getTemplate(id)
}

/** Bangun data render dari detail dokumen. */
export async function getConfiguredLetterhead(): Promise<string> {
  const [row] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.id, 'global')).limit(1)
  const value = (row?.value ?? {}) as Record<string, unknown>
  return typeof value.letterheadHtml === 'string' ? value.letterheadHtml : ''
}

export async function buildTemplateData(d: {
  documentNumber: string; title: string; type: string; status: string; documentDate: string; notes: string | null
  subtotal: number; discount: number; taxRate: string; taxAmount: number; total: number; creatorName: string | null
  client: { name: string; address: string | null; contactPerson: string | null; email: string | null; phone: string | null } | null
  project: { name: string; code: string | null } | null
  items: { position: number; description: string; unit: string | null; quantity: string; unitPrice: number; amount: number }[]
  fields?: Record<string, string>
}): Promise<TemplateData> {
  const [settingsRow] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.id, 'global')).limit(1)
  const settings = (settingsRow?.value ?? {}) as Record<string, unknown>
  const company = { ...COMPANY, name: String(settings.companyLegalName || settings.companyName || COMPANY.name), address: String(settings.companyAddress || COMPANY.address), phone: String(settings.companyPhone || COMPANY.phone), email: String(settings.companyEmail || COMPANY.email), website: String(settings.companyWebsite || COMPANY.website), npwp: String(settings.companyTaxId || COMPANY.npwp), leaderName: String(settings.leaderName || ''), leaderTitle: String(settings.leaderTitle || '') }
  return {
    documentNumber: d.documentNumber, title: d.title, type: d.type, typeLabel: typeLabel(d.type), status: d.status,
    documentDate: d.documentDate, company, creatorName: d.creatorName ?? '', notes: d.notes ?? '',
    subtotal: d.subtotal, discount: d.discount, taxRate: d.taxRate, taxAmount: d.taxAmount, total: d.total,
    client: d.client ? { name: d.client.name, address: d.client.address ?? '', contactPerson: d.client.contactPerson ?? '', email: d.client.email ?? '', phone: d.client.phone ?? '' } : null,
    project: d.project ? { name: d.project.name, code: d.project.code ?? '' } : null,
    items: d.items.map((i) => ({ position: i.position, description: i.description, unit: i.unit ?? '', quantity: i.quantity, unitPrice: i.unitPrice, amount: i.amount })),
    fields: d.fields ?? {},
    ...Object.fromEntries(['nomor_urut','kode_klasifikasi','kode_unit','tahun','tanggal_surat','jumlah_lampiran','perihal','nama_perusahaan','alamat_perusahaan','jenis_pekerjaan','batas_tanggal','batas_jam','zona_waktu','alamat_pengiriman','email_vendor','telepon','team_leader'].map((key) => [key, d.fields?.[key]])),
    kelengkapan: (() => {
      const raw = d.fields?.kelengkapan
      if (!raw) return undefined
      try {
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return undefined
        return parsed.filter((x): x is { no: number; nama: string } => !!x && typeof x === 'object' && typeof (x as { nama?: unknown }).nama === 'string')
          .map((x, index) => ({ no: Number.isFinite(Number(x.no)) ? Number(x.no) : index + 1, nama: x.nama }))
      } catch { return undefined }
    })(),
  }
}

/** Data contoh untuk preview saat menyusun template. */
export function sampleTemplateData(type: string): TemplateData {
  return {
    documentNumber: 'PENAWARAN-2026-001', title: 'Contoh Judul Dokumen', type, typeLabel: typeLabel(type), status: 'draft', documentDate: '2026-01-15',
    company: { ...COMPANY }, creatorName: 'Nama Pembuat', notes: 'Catatan contoh untuk pratinjau.',
    subtotal: 10000000, discount: 500000, taxRate: '11', taxAmount: 1045000, total: 10545000,
    client: { name: 'PT Contoh Sejahtera', address: 'Jl. Contoh No. 1, Jakarta', contactPerson: 'Budi', email: 'budi@contoh.co.id', phone: '021-1234567' },
    project: { name: 'Proyek Contoh', code: 'PRJ-001' },
    items: [
      { position: 1, description: 'Pekerjaan persiapan', unit: 'ls', quantity: '1', unitPrice: 2500000, amount: 2500000 },
      { position: 2, description: 'Pekerjaan struktur', unit: 'm2', quantity: '50', unitPrice: 150000, amount: 7500000 },
    ],
    fields: {
      nomor_urut: '001', kode_klasifikasi: 'PBJ', kode_unit: 'UPDL-PLG', tahun: '2026',
      tanggal_surat: 'Senin, 01 Desember 2026', jumlah_lampiran: '5', perihal: 'Undangan Penawaran Pekerjaan Konstruksi',
      nama_perusahaan: 'PT ABC', alamat_perusahaan: 'Jl. Merdeka No. 1, Palembang',
      jenis_pekerjaan: 'Pekerjaan Konstruksi Gedung', batas_tanggal: 'Rabu, 10 Desember 2026',
      batas_jam: '14:00', zona_waktu: 'WIB', alamat_pengiriman: 'Jl. Merdeka No. 1, Palembang',
      email_vendor: 'vendor@email.com', telepon: '0812xxxx', team_leader: 'Budi Santoso',
    },
    kelengkapan: [
      { no: 1, nama: 'Persyaratan KAK' }, { no: 2, nama: 'Formulir IDD' },
      { no: 3, nama: 'Sertifikat CSMS' }, { no: 4, nama: 'Komitmen Anti Gratifikasi' },
      { no: 5, nama: 'Komitmen TKDN' },
    ],
  }
}
