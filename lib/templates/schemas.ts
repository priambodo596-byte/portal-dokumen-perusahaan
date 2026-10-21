import { z } from 'zod'
import { DOCUMENT_TYPE_VALUES } from '@/lib/documents/constants'

export const templateInputSchema = z.object({
  name: z.string().trim().min(3, 'Nama minimal 3 karakter.').max(150),
  type: z.enum(DOCUMENT_TYPE_VALUES),
  description: z.string().trim().max(500).optional().nullable(),
  bodyHtml: z.string().max(500_000).default(''),
  css: z.string().max(100_000).default(''),
  headerHtml: z.string().max(100_000).default(''),
  footerHtml: z.string().max(100_000).default(''),
  mode: z.enum(['html', 'docx']).default('html'),
  sourceFileName: z.string().max(255).optional().nullable(),
  isDefault: z.boolean().default(false),
})

// Semua opsional: field yang tidak dikirim tidak direset.
// PENTING: jangan memakai `templateInputSchema.partial()` — di Zod 4 nilai `.default()` tetap diterapkan pada
// field yang tidak dikirim, sehingga PATCH parsial (mis. "Jadikan default") akan mengosongkan body/header/footer/css.
export const templateUpdateSchema = z.object({
  name: z.string().trim().min(3, 'Nama minimal 3 karakter.').max(150).optional(),
  type: z.enum(DOCUMENT_TYPE_VALUES).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  bodyHtml: z.string().max(500_000).optional(),
  css: z.string().max(100_000).optional(),
  headerHtml: z.string().max(100_000).optional(),
  footerHtml: z.string().max(100_000).optional(),
  mode: z.enum(['html', 'docx']).optional(),
  sourceFileName: z.string().max(255).optional().nullable(),
  isDefault: z.boolean().optional(),
})
