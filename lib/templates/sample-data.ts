import { COMPANY } from '@/lib/company'
import { typeLabel } from '@/lib/documents/constants'
import type { TemplateData } from './tokens'

/** Data contoh pratinjau. Modul ini sengaja tidak mengimpor service/database. */
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
  }
}
