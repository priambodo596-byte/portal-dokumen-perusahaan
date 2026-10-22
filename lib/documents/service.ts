import { randomUUID } from 'crypto'
import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLogs, clients, documentCounters, documentFiles, documentItems, documents, documentVersions, projects, user } from '@/lib/db/schema'
import { ApiError, type Ctx } from '@/lib/api'
import { can } from '@/lib/permissions'
import { computeTotals } from './calc'
import { DELETABLE_STATUSES, DOCUMENT_TYPES, EDITABLE_STATUSES, statusMeta, transitionByAction, type DocumentStatus } from './constants'
import type { DocumentInput, DocumentUpdate, ListQuery, TransitionInput } from './schemas'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
const newId = () => randomUUID()

async function audit(tx: Tx, ctx: Ctx, action: string, entityId: string, detail?: Record<string, unknown>) {
  await tx.insert(auditLogs).values({ id: newId(), userId: ctx.userId, action, entityType: 'document', entityId, detail: detail ?? null })
}

async function nextNumber(tx: Tx, type: string, year: number) {
  const prefix = DOCUMENT_TYPES.find((t) => t.value === type)?.prefix ?? 'DOK'
  const [row] = await tx
    .insert(documentCounters)
    .values({ type, year, lastNumber: 1 })
    .onConflictDoUpdate({ target: [documentCounters.type, documentCounters.year], set: { lastNumber: sql`${documentCounters.lastNumber} + 1` } })
    .returning({ n: documentCounters.lastNumber })
  return `${prefix}-${year}-${String(row.n).padStart(3, '0')}`
}

async function assertRefs(tx: Tx, clientId?: string | null, projectId?: string | null) {
  if (clientId) {
    const [c] = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
    if (!c) throw new ApiError(422, 'Data tidak valid.', { clientId: 'Klien tidak ditemukan.' })
  }
  if (projectId) {
    const [p] = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    if (!p) throw new ApiError(422, 'Data tidak valid.', { projectId: 'Proyek tidak ditemukan.' })
  }
}

async function loadRow(tx: Tx | typeof db, id: string) {
  const [row] = await tx.select().from(documents).where(and(eq(documents.id, id), isNull(documents.deletedAt))).limit(1)
  if (!row) throw new ApiError(404, 'Dokumen tidak ditemukan.')
  return row
}

async function writeItems(tx: Tx, documentId: string, items: DocumentInput['items'], lines: number[]) {
  await tx.delete(documentItems).where(eq(documentItems.documentId, documentId))
  if (!items.length) return
  await tx.insert(documentItems).values(
    items.map((it, i) => ({ id: newId(), documentId, position: i + 1, description: it.description, unit: it.unit ?? null, quantity: String(it.quantity), unitPrice: it.unitPrice, amount: lines[i] })),
  )
}

async function snapshot(tx: Tx, documentId: string) {
  const row = await loadRow(tx, documentId)
  const items = await tx.select().from(documentItems).where(eq(documentItems.documentId, documentId)).orderBy(asc(documentItems.position))
  return { document: row, items }
}

async function saveVersion(tx: Tx, ctx: Ctx, documentId: string, version: number, changeNote?: string) {
  await tx.insert(documentVersions).values({ id: newId(), documentId, version, snapshot: await snapshot(tx, documentId), changeNote: changeNote ?? null, createdBy: ctx.userId })
}

export async function createDocument(ctx: Ctx, input: DocumentInput) {
  if (!can(ctx.role, 'create')) throw new ApiError(403, 'Anda tidak berhak membuat dokumen.')
  return db.transaction(async (tx) => {
    await assertRefs(tx, input.clientId, input.projectId)
    const year = Number(input.documentDate.slice(0, 4))
    const documentNumber = input.documentNumber ?? (await nextNumber(tx, input.type, year))
    const t = computeTotals(input.items, input.discount, input.taxRate)
    const id = newId()
    await tx.insert(documents).values({
      id, documentNumber, title: input.title, type: input.type, status: 'draft', clientId: input.clientId ?? null, projectId: input.projectId ?? null,
      templateId: input.templateId ?? null,
      documentDate: input.documentDate, notes: input.notes ?? null, fields: input.fields, subtotal: t.subtotal, discount: t.discount,
      taxRate: String(input.taxRate), taxAmount: t.taxAmount, total: t.total, version: 1, createdBy: ctx.userId,
    })
    await writeItems(tx, id, input.items, t.lines)
    await saveVersion(tx, ctx, id, 1, 'Dokumen dibuat')
    await audit(tx, ctx, 'create', id, { documentNumber })
    return { id, documentNumber }
  })
}

export async function updateDocument(ctx: Ctx, id: string, input: DocumentUpdate, expectedVersion?: number) {
  return db.transaction(async (tx) => {
    const cur = await loadRow(tx, id)
    if (!can(ctx.role, 'edit', { userId: ctx.userId, ownerId: cur.createdBy })) throw new ApiError(403, 'Anda tidak berhak mengubah dokumen ini.')
    if (!EDITABLE_STATUSES.includes(cur.status)) throw new ApiError(409, 'Dokumen yang sudah diajukan, disetujui, atau diterbitkan tidak dapat diubah. Gunakan revisi.')
    if (expectedVersion !== undefined && expectedVersion !== cur.version) throw new ApiError(409, 'Dokumen sudah diubah pengguna lain. Muat ulang halaman lalu coba lagi.')
    await assertRefs(tx, input.clientId, input.projectId)

    const items = input.items ?? (await tx.select().from(documentItems).where(eq(documentItems.documentId, id)).orderBy(asc(documentItems.position))).map((r) => ({ description: r.description, unit: r.unit, quantity: Number(r.quantity), unitPrice: r.unitPrice }))
    const discount = input.discount ?? cur.discount
    const taxRate = input.taxRate ?? Number(cur.taxRate)
    const t = computeTotals(items, discount, taxRate)
    const version = cur.version + 1

    await tx.update(documents).set({
      title: input.title ?? cur.title, type: input.type ?? cur.type, documentNumber: input.documentNumber ?? cur.documentNumber,
      documentDate: input.documentDate ?? cur.documentDate, notes: input.notes === undefined ? cur.notes : input.notes,
      clientId: input.clientId === undefined ? cur.clientId : input.clientId, projectId: input.projectId === undefined ? cur.projectId : input.projectId,
      templateId: input.templateId === undefined ? cur.templateId : input.templateId,
      fields: input.fields ?? cur.fields, subtotal: t.subtotal, discount: t.discount, taxRate: String(taxRate), taxAmount: t.taxAmount, total: t.total,
      version, updatedAt: new Date(),
    }).where(eq(documents.id, id))
    if (input.items) await writeItems(tx, id, items, t.lines)
    await saveVersion(tx, ctx, id, version, input.changeNote)
    await audit(tx, ctx, 'update', id, { version, changed: Object.keys(input).filter((k) => k !== 'changeNote') })
    return { id, version }
  })
}

export async function deleteDocument(ctx: Ctx, id: string) {
  return db.transaction(async (tx) => {
    const cur = await loadRow(tx, id)
    if (!can(ctx.role, 'delete', { userId: ctx.userId, ownerId: cur.createdBy })) throw new ApiError(403, 'Anda tidak berhak menghapus dokumen ini.')
    if (!DELETABLE_STATUSES.includes(cur.status)) throw new ApiError(409, 'Dokumen yang sedang diproses persetujuan atau sudah diterbitkan tidak dapat dihapus.')
    await tx.update(documents).set({ deletedAt: new Date(), deletedBy: ctx.userId }).where(eq(documents.id, id))
    await audit(tx, ctx, 'delete', id, { documentNumber: cur.documentNumber, title: cur.title })
    return { id }
  })
}

/** Mengubah status dokumen mengikuti alur persetujuan. Semua aturan transisi & hak akses divalidasi di server. */
export async function transitionDocument(ctx: Ctx, id: string, input: TransitionInput) {
  const def = transitionByAction(input.action)
  if (!def) throw new ApiError(422, 'Aksi alur persetujuan tidak dikenal.')
  if (def.requiresNote && !input.note?.trim()) throw new ApiError(422, 'Catatan wajib diisi untuk aksi ini.', { note: 'Catatan wajib diisi.' })
  return db.transaction(async (tx) => {
    const cur = await loadRow(tx, id)
    if (expectedMismatch(input.expectedVersion, cur.version)) throw new ApiError(409, 'Dokumen sudah diubah pengguna lain. Muat ulang halaman lalu coba lagi.')
    if (!def.from.includes(cur.status as DocumentStatus))
      throw new ApiError(409, `Tidak dapat "${def.label}" dari status "${statusMeta(cur.status).label}".`)
    if (!can(ctx.role, def.permission, { userId: ctx.userId, ownerId: cur.createdBy }))
      throw new ApiError(403, 'Anda tidak berhak melakukan aksi ini.')

    const version = cur.version + 1
    await tx.update(documents).set({ status: def.to, version, updatedAt: new Date() }).where(eq(documents.id, id))
    // Snapshot keputusan penting (persetujuan/penerbitan) agar versi yang disetujui terekam.
    if (def.to === 'approved' || def.to === 'published') await saveVersion(tx, ctx, id, version, input.note ?? def.label)
    await audit(tx, ctx, `approval:${def.action}`, id, { from: cur.status, to: def.to, note: input.note ?? null, version })
    return { id, status: def.to, version }
  })
}

const expectedMismatch = (expected: number | undefined, current: number) => expected !== undefined && expected !== current

/** Draft baru dari dokumen lama. Nomor, status, dan keputusan persetujuan tidak disalin. */
export async function duplicateDocument(ctx: Ctx, id: string) {
  if (!can(ctx.role, 'create')) throw new ApiError(403, 'Anda tidak berhak membuat dokumen.')
  return db.transaction(async (tx) => {
    const src = await snapshot(tx, id)
    const today = new Date().toISOString().slice(0, 10)
    const newDocId = newId()
    const documentNumber = await nextNumber(tx, src.document.type, Number(today.slice(0, 4)))
    const items = src.items.map((r) => ({ description: r.description, unit: r.unit, quantity: Number(r.quantity), unitPrice: r.unitPrice }))
    const t = computeTotals(items, src.document.discount, Number(src.document.taxRate))
    await tx.insert(documents).values({
      id: newDocId, documentNumber, title: `${src.document.title} (salinan)`, type: src.document.type, status: 'draft', clientId: src.document.clientId,
      projectId: src.document.projectId, documentDate: today, notes: src.document.notes, fields: src.document.fields, subtotal: t.subtotal, discount: t.discount,
      taxRate: src.document.taxRate, taxAmount: t.taxAmount, total: t.total, version: 1, createdBy: ctx.userId,
    })
    await writeItems(tx, newDocId, items, t.lines)
    await saveVersion(tx, ctx, newDocId, 1, `Disalin dari ${src.document.documentNumber}`)
    await audit(tx, ctx, 'duplicate', newDocId, { from: id, documentNumber })
    return { id: newDocId, documentNumber }
  })
}

export async function listDocuments(q: ListQuery) {
  const conds: SQL[] = [isNull(documents.deletedAt)]
  if (q.q) {
    const like = `%${q.q.replace(/[%_\\]/g, '\\$&')}%`
    const typeHits = DOCUMENT_TYPES.filter((t) => t.label.toLowerCase().includes(q.q!.toLowerCase())).map((t) => t.value)
    conds.push(or(ilike(documents.documentNumber, like), ilike(documents.title, like), ilike(clients.name, like), ilike(projects.name, like), ...(typeHits.length ? [sql`${documents.type} in ${typeHits}`] : []))!)
  }
  if (q.type) conds.push(eq(documents.type, q.type))
  if (q.status) conds.push(eq(documents.status, q.status))
  if (q.projectId) conds.push(eq(documents.projectId, q.projectId))
  if (q.createdBy) conds.push(eq(documents.createdBy, q.createdBy))
  if (q.from) conds.push(gte(documents.documentDate, q.from))
  if (q.to) conds.push(lte(documents.documentDate, q.to))
  const where = and(...conds)

  const sortCol = { documentNumber: documents.documentNumber, title: documents.title, type: documents.type, documentDate: documents.documentDate, status: documents.status, updatedAt: documents.updatedAt }[q.sort]
  const order = q.dir === 'asc' ? asc(sortCol) : desc(sortCol)
  const base = db.select({
    id: documents.id, documentNumber: documents.documentNumber, title: documents.title, type: documents.type, status: documents.status,
    documentDate: documents.documentDate, total: documents.total, updatedAt: documents.updatedAt, createdBy: documents.createdBy,
    clientName: clients.name, projectName: projects.name, creatorName: user.name,
  }).from(documents)
    .leftJoin(clients, eq(documents.clientId, clients.id)).leftJoin(projects, eq(documents.projectId, projects.id)).leftJoin(user, eq(documents.createdBy, user.id))

  const [rows, [{ total }]] = await Promise.all([
    base.where(where).orderBy(order, desc(documents.id)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(documents).leftJoin(clients, eq(documents.clientId, clients.id)).leftJoin(projects, eq(documents.projectId, projects.id)).where(where),
  ])
  return { rows, total, page: q.page, pageSize: q.pageSize, pageCount: Math.max(1, Math.ceil(total / q.pageSize)) }
}

/** Daftar proyek beserta jumlah dokumen dan total nilainya (server-side). */
export async function listProjectsWithStats() {
  const rows = await db.select({
    id: projects.id, code: projects.code, name: projects.name, clientId: projects.clientId, createdAt: projects.createdAt, clientName: clients.name,
    documentCount: sql<number>`count(${documents.id})::int`,
    totalValue: sql<number>`coalesce(sum(${documents.total}), 0)::bigint`,
  }).from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(documents, and(eq(documents.projectId, projects.id), isNull(documents.deletedAt)))
    .where(isNull(projects.deletedAt))
    .groupBy(projects.id, clients.name)
    .orderBy(asc(projects.name))
  return rows
}

/** Data dashboard utama, dihitung langsung dari dokumen yang tersimpan. */
export async function getDashboardSummary() {
  const [total, pending, published, value, recent, activity] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(documents).where(isNull(documents.deletedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(documents).where(and(isNull(documents.deletedAt), or(eq(documents.status, 'pending'), eq(documents.status, 'review')))),
    db.select({ count: sql<number>`count(*)::int` }).from(documents).where(and(isNull(documents.deletedAt), or(eq(documents.status, 'published'), eq(documents.status, 'approved')))),
    db.select({ total: sql<number>`coalesce(sum(${documents.total}), 0)::bigint` }).from(documents).where(and(isNull(documents.deletedAt), or(eq(documents.status, 'approved'), eq(documents.status, 'published')))),
    db.select({ documentNumber: documents.documentNumber, title: documents.title, type: documents.type, status: documents.status })
      .from(documents).where(isNull(documents.deletedAt)).orderBy(desc(documents.updatedAt), desc(documents.id)).limit(5),
    db.select({ month: sql<string>`to_char(date_trunc('month', ${documents.createdAt}), 'YYYY-MM')`, count: sql<number>`count(*)::int` })
      .from(documents).where(and(isNull(documents.deletedAt), gte(documents.createdAt, sql`now() - interval '11 months'`))).groupBy(sql`date_trunc('month', ${documents.createdAt})`).orderBy(sql`date_trunc('month', ${documents.createdAt})`),
  ])
  return { total: total[0]?.count ?? 0, pending: pending[0]?.count ?? 0, published: published[0]?.count ?? 0, value: Number(value[0]?.total ?? 0), recent, activity }
}

/** Ringkasan operasional untuk halaman laporan. */
export async function getReportsSummary() {
  const [byStatus, byType, totals] = await Promise.all([
    db.select({ status: documents.status, n: sql<number>`count(*)::int`, value: sql<number>`coalesce(sum(${documents.total}), 0)::bigint` })
      .from(documents).where(isNull(documents.deletedAt)).groupBy(documents.status),
    db.select({ type: documents.type, n: sql<number>`count(*)::int`, value: sql<number>`coalesce(sum(${documents.total}), 0)::bigint` })
      .from(documents).where(isNull(documents.deletedAt)).groupBy(documents.type),
    db.select({
      documentCount: sql<number>`count(*)::int`,
      totalValue: sql<number>`coalesce(sum(${documents.total}), 0)::bigint`,
    }).from(documents).where(isNull(documents.deletedAt)),
  ])
  return { byStatus, byType, ...totals[0] }
}

/** Catat aksi export/import ke audit log (tanpa transaksi berat). */
export async function recordAction(ctx: Ctx, action: string, id: string, detail?: Record<string, unknown>) {
  await db.insert(auditLogs).values({ id: newId(), userId: ctx.userId, action, entityType: 'document', entityId: id, detail: detail ?? null })
}

export type StoredFile = { id: string; fileName: string; mimeType: string; size: number; kind: string; version: number | null; createdAt: Date; uploadedBy: string; uploaderName: string | null }

export async function listDocumentFiles(documentId: string): Promise<StoredFile[]> {
  return db.select({
    id: documentFiles.id, fileName: documentFiles.fileName, mimeType: documentFiles.mimeType, size: documentFiles.size,
    kind: documentFiles.kind, version: documentFiles.version, createdAt: documentFiles.createdAt, uploadedBy: documentFiles.uploadedBy, uploaderName: user.name,
  }).from(documentFiles).leftJoin(user, eq(documentFiles.uploadedBy, user.id)).where(eq(documentFiles.documentId, documentId)).orderBy(desc(documentFiles.createdAt))
}

export async function getFileForDownload(fileId: string) {
  const [row] = await db.select().from(documentFiles).where(eq(documentFiles.id, fileId)).limit(1)
  if (!row) throw new ApiError(404, 'File tidak ditemukan.')
  const doc = await loadRow(db, row.documentId)
  return { file: row, documentId: doc.id, createdBy: doc.createdBy }
}

/** Simpan lampiran / file hasil generate untuk sebuah dokumen (privat di database). */
export async function storeDocumentFile(ctx: Ctx, documentId: string, input: { kind: string; fileName: string; mimeType: string; content: Buffer; version?: number | null }) {
  await loadRow(db, documentId) // pastikan dokumen ada & belum dihapus
  const id = newId()
  await db.insert(documentFiles).values({ id, documentId, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, size: input.content.length, version: input.version ?? null, content: input.content, uploadedBy: ctx.userId })
  return { id }
}

/** Buat dokumen dari hasil import. Selalu berstatus draft (import lama tidak dianggap disetujui). */
export async function createImportedDocument(ctx: Ctx, input: DocumentInput, source: { fileName: string; mimeType: string; content: Buffer }) {
  if (!can(ctx.role, 'create')) throw new ApiError(403, 'Anda tidak berhak membuat dokumen.')
  return db.transaction(async (tx) => {
    await assertRefs(tx, input.clientId, input.projectId)
    const year = Number(input.documentDate.slice(0, 4))
    const documentNumber = input.documentNumber ?? (await nextNumber(tx, input.type, year))
    const t = computeTotals(input.items, input.discount, input.taxRate)
    const id = newId()
    await tx.insert(documents).values({
      id, documentNumber, title: input.title, type: input.type, status: 'draft', clientId: input.clientId ?? null, projectId: input.projectId ?? null,
      documentDate: input.documentDate, notes: input.notes ?? null, fields: input.fields, subtotal: t.subtotal, discount: t.discount,
      taxRate: String(input.taxRate), taxAmount: t.taxAmount, total: t.total, version: 1, createdBy: ctx.userId,
    })
    await writeItems(tx, id, input.items, t.lines)
    await tx.insert(documentFiles).values({ id: newId(), documentId: id, kind: 'import-source', fileName: source.fileName, mimeType: source.mimeType, size: source.content.length, content: source.content, uploadedBy: ctx.userId })
    await saveVersion(tx, ctx, id, 1, `Diimpor dari ${source.fileName}`)
    await audit(tx, ctx, 'import', id, { documentNumber, fileName: source.fileName })
    return { id, documentNumber }
  })
}

export async function getDocumentDetail(id: string) {
  const row = await loadRow(db, id)
  const [items, versions, logs, client, project, creator, files] = await Promise.all([
    db.select().from(documentItems).where(eq(documentItems.documentId, id)).orderBy(asc(documentItems.position)),
    db.select({ version: documentVersions.version, changeNote: documentVersions.changeNote, createdAt: documentVersions.createdAt, createdBy: documentVersions.createdBy, userName: user.name })
      .from(documentVersions).leftJoin(user, eq(documentVersions.createdBy, user.id)).where(eq(documentVersions.documentId, id)).orderBy(desc(documentVersions.version)),
    db.select({ action: auditLogs.action, createdAt: auditLogs.createdAt, userName: user.name }).from(auditLogs).leftJoin(user, eq(auditLogs.userId, user.id))
      .where(and(eq(auditLogs.entityType, 'document'), eq(auditLogs.entityId, id))).orderBy(desc(auditLogs.createdAt)).limit(50),
    row.clientId ? db.select().from(clients).where(eq(clients.id, row.clientId)).then((r) => r[0] ?? null) : null,
    row.projectId ? db.select().from(projects).where(eq(projects.id, row.projectId)).then((r) => r[0] ?? null) : null,
    db.select({ name: user.name }).from(user).where(eq(user.id, row.createdBy)).then((r) => r[0]?.name ?? null),
    listDocumentFiles(id),
  ])
  return { ...row, items, versions, logs, client, project, creatorName: creator, files }
}
