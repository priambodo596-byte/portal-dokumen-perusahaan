export const DOCUMENT_TYPES = [
  { value: 'rab', label: 'RAB & BoQ', prefix: 'RAB' },
  { value: 'quotation', label: 'Surat Penawaran', prefix: 'PENAWARAN' },
  { value: 'spk-pj', label: 'SPK PJ', prefix: 'SPK' },
  { value: 'contract', label: 'Kontrak', prefix: 'KONTRAK' },
  { value: 'invoice', label: 'Invoice & Pembayaran', prefix: 'INV' },
  { value: 'minutes', label: 'Berita Acara & BAST', prefix: 'BA' },
  { value: 'surat-undangan', label: 'Surat Undangan Penawaran', prefix: 'SUP' },
  { value: 'other', label: 'Lainnya', prefix: 'DOK' },
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]['value']
export const DOCUMENT_TYPE_VALUES = DOCUMENT_TYPES.map((t) => t.value) as [DocumentType, ...DocumentType[]]

export const DOCUMENT_STATUSES = [
  { value: 'draft', label: 'Draft', tone: 'slate' },
  { value: 'pending', label: 'Menunggu Persetujuan', tone: 'amber' },
  { value: 'review', label: 'Dalam Review', tone: 'blue' },
  { value: 'revision', label: 'Perlu Revisi', tone: 'purple' },
  { value: 'approved', label: 'Disetujui', tone: 'green' },
  { value: 'rejected', label: 'Ditolak', tone: 'amber' },
  { value: 'published', label: 'Diterbitkan', tone: 'green' },
  { value: 'archived', label: 'Diarsipkan', tone: 'slate' },
] as const

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]['value']
export const DOCUMENT_STATUS_VALUES = DOCUMENT_STATUSES.map((s) => s.value) as [DocumentStatus, ...DocumentStatus[]]

/** Status di mana isi dokumen boleh diubah. Selain ini, perubahan harus lewat revisi. */
export const EDITABLE_STATUSES: string[] = ['draft', 'revision']
/** Status di mana dokumen boleh dihapus (soft delete). */
export const DELETABLE_STATUSES: string[] = ['draft', 'rejected', 'revision']
/** Status yang dianggap masih dalam proses persetujuan (muncul di halaman Persetujuan). */
export const IN_REVIEW_STATUSES: string[] = ['pending', 'review']
/** Status final yang tidak boleh diubah tanpa revisi. */
export const LOCKED_STATUSES: string[] = ['pending', 'review', 'approved', 'rejected', 'published', 'archived']

/** Aksi alur persetujuan yang tersedia untuk pengguna. */
export type TransitionAction = 'submit' | 'review' | 'approve' | 'reject' | 'request-revision' | 'publish' | 'archive'

/** Aturan transisi status: dari status apa ke status apa, dengan label tombol dan hak akses yang dibutuhkan. */
export const STATUS_TRANSITIONS: {
  action: TransitionAction; label: string; from: DocumentStatus[]; to: DocumentStatus; permission: 'submit' | 'approve' | 'publish'; requiresNote: boolean; destructive?: boolean
}[] = [
  { action: 'submit', label: 'Ajukan Persetujuan', from: ['draft', 'revision'], to: 'pending', permission: 'submit', requiresNote: false },
  { action: 'review', label: 'Mulai Review', from: ['pending'], to: 'review', permission: 'approve', requiresNote: false },
  { action: 'approve', label: 'Setujui', from: ['pending', 'review'], to: 'approved', permission: 'approve', requiresNote: false },
  { action: 'reject', label: 'Tolak', from: ['pending', 'review'], to: 'rejected', permission: 'approve', requiresNote: true, destructive: true },
  { action: 'request-revision', label: 'Minta Revisi', from: ['pending', 'review', 'approved'], to: 'revision', permission: 'approve', requiresNote: true, destructive: true },
  { action: 'publish', label: 'Terbitkan', from: ['approved'], to: 'published', permission: 'publish', requiresNote: false },
  { action: 'archive', label: 'Arsipkan', from: ['published'], to: 'archived', permission: 'publish', requiresNote: false },
]

export const transitionsFor = (status: string) => STATUS_TRANSITIONS.filter((t) => t.from.includes(status as DocumentStatus))
export const transitionByAction = (action: string) => STATUS_TRANSITIONS.find((t) => t.action === action)

export const typeLabel = (v: string) => DOCUMENT_TYPES.find((t) => t.value === v)?.label ?? v
export const statusMeta = (v: string) => DOCUMENT_STATUSES.find((s) => s.value === v) ?? { value: v, label: v, tone: 'slate' }

export const formatRupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
