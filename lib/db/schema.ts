import { bigint, boolean, customType, date, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const sqlNotDeleted = sql`"deletedAt" IS NULL`

// Kolom biner (bytea) untuk menyimpan isi file secara privat di database.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() { return 'bytea' },
})

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})


// ───────────────────────── Portal Dokumen ─────────────────────────

export const userRole = pgTable('user_role', {
  userId: text('userId').primaryKey(),
  role: text('role').notNull().default('staff'), // admin | manager | staff | viewer
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const clients = pgTable('clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address'),
  contactPerson: text('contactPerson'),
  email: text('email'),
  phone: text('phone'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  deletedAt: timestamp('deletedAt'),
}, (t) => [uniqueIndex('clients_name_uq').on(t.name)])

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  code: text('code'),
  name: text('name').notNull(),
  clientId: text('clientId').references(() => clients.id),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  deletedAt: timestamp('deletedAt'),
}, (t) => [index('projects_client_idx').on(t.clientId)])

export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  documentNumber: text('documentNumber').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(), // rab | quotation | spk-pj | contract | invoice | minutes | other
  status: text('status').notNull().default('draft'),
  clientId: text('clientId').references(() => clients.id),
  projectId: text('projectId').references(() => projects.id),
  templateId: text('templateId'), // override template default jenis; null = pakai default jenis
  documentDate: date('documentDate').notNull(),
  notes: text('notes'),
  fields: jsonb('fields').$type<Record<string, string>>().notNull().default({}),
  // Nilai uang dalam rupiah utuh; dihitung di server.
  subtotal: bigint('subtotal', { mode: 'number' }).notNull().default(0),
  discount: bigint('discount', { mode: 'number' }).notNull().default(0),
  taxRate: numeric('taxRate', { precision: 5, scale: 2 }).notNull().default('0'),
  taxAmount: bigint('taxAmount', { mode: 'number' }).notNull().default(0),
  total: bigint('total', { mode: 'number' }).notNull().default(0),
  version: integer('version').notNull().default(1),
  createdBy: text('createdBy').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  deletedAt: timestamp('deletedAt'),
  deletedBy: text('deletedBy'),
}, (t) => [
  // Nomor unik di antara dokumen yang belum dihapus.
  uniqueIndex('documents_number_uq').on(t.documentNumber).where(sqlNotDeleted),
  index('documents_type_idx').on(t.type),
  index('documents_status_idx').on(t.status),
  index('documents_project_idx').on(t.projectId),
  index('documents_created_idx').on(t.createdAt),
])

export const documentItems = pgTable('document_items', {
  id: text('id').primaryKey(),
  documentId: text('documentId').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  description: text('description').notNull(),
  unit: text('unit'),
  quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull().default('1'),
  unitPrice: bigint('unitPrice', { mode: 'number' }).notNull().default(0),
  amount: bigint('amount', { mode: 'number' }).notNull().default(0),
}, (t) => [index('document_items_doc_idx').on(t.documentId)])

// Snapshot isi dokumen setiap kali berubah; dasar riwayat versi dan export final.
export const documentVersions = pgTable('document_versions', {
  id: text('id').primaryKey(),
  documentId: text('documentId').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  snapshot: jsonb('snapshot').notNull(),
  changeNote: text('changeNote'),
  createdBy: text('createdBy').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (t) => [uniqueIndex('document_versions_uq').on(t.documentId, t.version)])

export const documentCounters = pgTable('document_counters', {
  type: text('type').notNull(),
  year: integer('year').notNull(),
  lastNumber: integer('lastNumber').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.type, t.year] })])

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  action: text('action').notNull(), // create | update | delete | duplicate | import | export | ...
  entityType: text('entityType').notNull(),
  entityId: text('entityId').notNull(),
  detail: jsonb('detail').$type<Record<string, unknown>>(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (t) => [index('audit_entity_idx').on(t.entityType, t.entityId)])

// Lampiran & file hasil generate per dokumen. Disimpan privat di database (bukan direktori publik).
export const documentFiles = pgTable('document_files', {
  id: text('id').primaryKey(),
  documentId: text('documentId').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // attachment | export-docx | export-pdf | import-source
  fileName: text('fileName').notNull(),
  mimeType: text('mimeType').notNull(),
  size: integer('size').notNull(),
  version: integer('version'),
  content: bytea('content').notNull(),
  uploadedBy: text('uploadedBy').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (t) => [index('document_files_doc_idx').on(t.documentId)])

// Template dokumen: sumber kebenaran berupa HTML + CSS, opsional berasal dari file DOCX.
// Dipakai menggantikan generator export bawaan; dokumen memakai template default per jenis,
// dapat diganti per dokumen.
export const templates = pgTable('templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // jenis dokumen target
  description: text('description'),
  bodyHtml: text('bodyHtml').notNull().default(''),
  css: text('css').notNull().default(''),
  headerHtml: text('headerHtml').notNull().default(''),
  footerHtml: text('footerHtml').notNull().default(''),
  mode: text('mode').notNull().default('html'), // html | docx : format sumber saat diedit
  sourceFileName: text('sourceFileName'), // nama file DOCX asli (bila mode docx)
  isDefault: boolean('isDefault').notNull().default(false),
  uploadedBy: text('uploadedBy').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  deletedAt: timestamp('deletedAt'),
}, (t) => [
  index('templates_type_idx').on(t.type),
  // Hanya boleh satu template default per jenis di antara yang belum dihapus.
  uniqueIndex('templates_default_uq').on(t.type).where(sql`"isDefault" AND "deletedAt" IS NULL`),
])

// Placeholder kustom yang dapat dikelola melalui halaman Variabel & Placeholder.
export const templateVariables = pgTable('template_variables', {
  id: text('id').primaryKey(),
  token: text('token').notNull(),
  label: text('label').notNull(),
  group: text('group').notNull().default('Variabel Kustom'),
  description: text('description').notNull().default(''),
  sampleValue: text('sampleValue').notNull().default(''),
  createdBy: text('createdBy').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  deletedAt: timestamp('deletedAt'),
}, (t) => [
  uniqueIndex('template_variables_token_uq').on(t.token).where(sql`\"deletedAt\" IS NULL`),
  index('template_variables_group_idx').on(t.group),
])

// Master data vendor untuk kebutuhan pengadaan dan dokumen perusahaan.
export const systemSettings = pgTable('system_settings', {
  id: text('id').primaryKey(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  updatedBy: text('updatedBy').notNull(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const vendors = pgTable('vendors', {
  id: text('id').primaryKey(),
  vendorCode: text('vendorCode').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull().default('Lainnya'),
  npwp: text('npwp'),
  address: text('address'),
  contactPerson: text('contactPerson'),
  email: text('email'),
  phone: text('phone'),
  bankName: text('bankName'),
  bankAccount: text('bankAccount'),
  bankAccountName: text('bankAccountName'),
  status: text('status').notNull().default('active'),
  notes: text('notes'),
  createdBy: text('createdBy').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  deletedAt: timestamp('deletedAt'),
}, (t) => [
  uniqueIndex('vendors_code_uq').on(t.vendorCode).where(sql`\"deletedAt\" IS NULL`),
  uniqueIndex('vendors_npwp_uq').on(t.npwp).where(sql`\"npwp\" IS NOT NULL AND \"deletedAt\" IS NULL`),
  index('vendors_name_idx').on(t.name),
  index('vendors_status_idx').on(t.status),
])

// Riwayat versi template: snapshot isi setiap kali template dibuat atau berubah, dapat dipulihkan.
export const templateVersions = pgTable('template_versions', {
  id: text('id').primaryKey(),
  templateId: text('templateId').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  name: text('name').notNull(),
  bodyHtml: text('bodyHtml').notNull().default(''),
  css: text('css').notNull().default(''),
  headerHtml: text('headerHtml').notNull().default(''),
  footerHtml: text('footerHtml').notNull().default(''),
  savedBy: text('savedBy').notNull(),
  savedByName: text('savedByName'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (t) => [
  index('template_versions_tpl_idx').on(t.templateId),
  uniqueIndex('template_versions_tpl_ver_uq').on(t.templateId, t.version),
])
