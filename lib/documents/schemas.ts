import { z } from 'zod'
import { DOCUMENT_STATUS_VALUES, DOCUMENT_TYPE_VALUES } from './constants'

export const itemSchema = z.object({
  description: z.string().trim().min(1, 'Uraian item wajib diisi').max(500),
  unit: z.string().trim().max(30).optional().nullable(),
  quantity: z.number().positive('Kuantitas harus lebih dari 0').max(1e9),
  unitPrice: z.number().int('Harga satuan harus bilangan bulat rupiah').min(0).max(1e13),
})

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')

export const documentInputSchema = z.object({
  type: z.enum(DOCUMENT_TYPE_VALUES),
  title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(200),
  documentDate: isoDate,
  documentNumber: z.string().trim().min(1).max(60).optional(), // kosong = nomor otomatis
  clientId: z.string().min(1).optional().nullable(),
  projectId: z.string().min(1).optional().nullable(),
  templateId: z.string().min(1).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  fields: z.record(z.string(), z.string().max(2000)).default({}),
  discount: z.number().int().min(0).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  items: z.array(itemSchema).max(500).default([]),
})
export type DocumentInput = z.infer<typeof documentInputSchema>

// Skema update sengaja tanpa .default(): field yang tidak dikirim tidak boleh ter-reset.
export const documentUpdateSchema = z.object({
  type: z.enum(DOCUMENT_TYPE_VALUES),
  title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(200),
  documentDate: isoDate,
  documentNumber: z.string().trim().min(1).max(60),
  clientId: z.string().min(1).nullable(),
  projectId: z.string().min(1).nullable(),
  templateId: z.string().min(1).nullable(),
  notes: z.string().trim().max(5000).nullable(),
  fields: z.record(z.string(), z.string().max(2000)),
  discount: z.number().int().min(0),
  taxRate: z.number().min(0).max(100),
  items: z.array(itemSchema).max(500),
}).partial().extend({ changeNote: z.string().trim().max(500).optional(), expectedVersion: z.number().int().optional() })
export type DocumentUpdate = z.infer<typeof documentUpdateSchema>

export const transitionSchema = z.object({
  action: z.enum(['submit', 'review', 'approve', 'reject', 'request-revision', 'publish', 'archive']),
  note: z.string().trim().max(1000).optional().nullable(),
  expectedVersion: z.number().int().optional(),
})
export type TransitionInput = z.infer<typeof transitionSchema>

export const bulkExportSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Pilih minimal satu dokumen').max(50, 'Maksimal 50 dokumen per export massal'),
  format: z.enum(['docx', 'pdf']),
})
export type BulkExportInput = z.infer<typeof bulkExportSchema>

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(DOCUMENT_TYPE_VALUES).optional(),
  status: z.enum(DOCUMENT_STATUS_VALUES).optional(),
  projectId: z.string().optional(),
  createdBy: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  sort: z.enum(['documentNumber', 'title', 'type', 'documentDate', 'status', 'updatedAt']).default('updatedAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
})
export type ListQuery = z.infer<typeof listQuerySchema>

export const clientSchema = z.object({
  name: z.string().trim().min(2).max(150),
  address: z.string().trim().max(500).optional().nullable(),
  contactPerson: z.string().trim().max(150).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(40).optional().nullable(),
})

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().max(40).optional().nullable(),
  clientId: z.string().optional().nullable(),
})

export const vendorSchema = z.object({
  vendorCode: z.string().trim().min(2, 'Kode vendor minimal 2 karakter').max(40).regex(/^[A-Za-z0-9._/-]+$/, 'Format kode vendor tidak valid.'),
  name: z.string().trim().min(2, 'Nama vendor minimal 2 karakter').max(180),
  category: z.string().trim().min(2).max(80).default('Lainnya'),
  npwp: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  contactPerson: z.string().trim().max(150).optional().nullable(),
  email: z.string().trim().email('Format email tidak valid').max(180).optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(40).optional().nullable(),
  bankName: z.string().trim().max(120).optional().nullable(),
  bankAccount: z.string().trim().max(80).optional().nullable(),
  bankAccountName: z.string().trim().max(180).optional().nullable(),
  status: z.enum(['active', 'inactive', 'blacklisted']).default('active'),
  notes: z.string().trim().max(2000).optional().nullable(),
})
