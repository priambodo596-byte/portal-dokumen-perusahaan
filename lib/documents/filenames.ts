/** Bersihkan nama file agar aman dipakai di header Content-Disposition dan filesystem. */
export function safeFileName(input: string, fallback = 'dokumen'): string {
  const cleaned = input
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '') // buang karakter non-aman (termasuk path separator & unicode kontrol)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '')
    .slice(0, 120)
  return cleaned || fallback
}

/** Nama file export konsisten, mis. PENAWARAN-2026-001.docx */
export function exportFileName(documentNumber: string, title: string, ext: 'docx' | 'pdf'): string {
  const base = safeFileName(`${documentNumber}-${title}`, documentNumber)
  return `${base}.${ext}`
}
