'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UploadCloud, FileText, X, AlertTriangle } from 'lucide-react'
import { DOCUMENT_TYPES, formatRupiah } from '@/lib/documents/constants'
import { computeTotals } from '@/lib/documents/calc'
import { api, postForm, Toast } from './shared'

type Option = { id: string; name: string; clientId?: string | null }
type ItemState = { description: string; unit: string; quantity: string; unitPrice: string }
type Extraction = { kind: string; fileName: string; size: number; mimeType: string; parsed: boolean; ocr?: boolean; text: string; message?: string; title?: string; documentNumber?: string; documentDate?: string; client?: string; project?: string; total?: number; notes?: string }

const today = () => new Date().toISOString().slice(0, 10)
const emptyItem = (): ItemState => ({ description: '', unit: '', quantity: '1', unitPrice: '0' })

export default function DocumentImport({ defaultType }: { defaultType?: string }) {
  const router = useRouter()
  const fileRef = useRef<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [extraction, setExtraction] = useState<Extraction | null>(null)
  const [type, setType] = useState(DOCUMENT_TYPES.some((t) => t.value === defaultType) ? defaultType! : 'quotation')
  const [title, setTitle] = useState(''); const [number, setNumber] = useState(''); const [date, setDate] = useState(today())
  const [clientId, setClientId] = useState(''); const [projectId, setProjectId] = useState(''); const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState('0'); const [taxRate, setTaxRate] = useState('11')
  const [items, setItems] = useState<ItemState[]>([emptyItem()])
  const [clients, setClients] = useState<Option[]>([]); const [projects, setProjects] = useState<Option[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({}); const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false); const [toast, setToast] = useState({ m: '', k: 'ok' as 'ok' | 'error' })

  useEffect(() => { api<Option[]>('/api/clients').then(setClients).catch(() => {}); api<Option[]>('/api/projects').then(setProjects).catch(() => {}) }, [])
  const visibleProjects = projects.filter((p) => !clientId || !p.clientId || p.clientId === clientId)

  const parsedItems = useMemo(() => items.map((i) => ({ quantity: Number(i.quantity.replace(',', '.')) || 0, unitPrice: Number(i.unitPrice) || 0 })), [items])
  const totals = useMemo(() => computeTotals(parsedItems, Math.max(0, Math.trunc(Number(discount) || 0)), Number(taxRate) || 0), [parsedItems, discount, taxRate])

  const setItem = (idx: number, patch: Partial<ItemState>) => setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const err = (k: string) => errors[k] ? <div className="field-error" role="alert">{errors[k]}</div> : null
  const cls = (k: string, base: string) => `${base} ${errors[k] ? 'field-invalid' : ''}`

  async function handleFile(file: File) {
    fileRef.current = file
    setParsing(true); setErrors({}); setFormError(null); setExtraction(null)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await postForm<Extraction>('/api/documents/import', fd)
      setExtraction(res)
      if (res.title) setTitle(res.title.slice(0, 200))
      if (res.documentNumber) setNumber(res.documentNumber)
      if (res.documentDate) setDate(res.documentDate)
      if (res.notes) setNotes(res.notes.slice(0, 5000))
      else if (res.text) setNotes(res.text.slice(0, 2000))
      if (!res.parsed) setFormError(res.message ?? 'Tidak ada teks yang dapat diekstrak.')
    } catch (e) {
      const ex = e as Error & { details?: Record<string, string> }
      setFormError(ex.message); if (ex.details) setErrors(ex.details)
      fileRef.current = null
    } finally { setParsing(false) }
  }

  function clearFile() { fileRef.current = null; setExtraction(null); setFormError(null); setErrors({}) }

  async function confirm(e: React.FormEvent) {
    e.preventDefault(); setErrors({}); setFormError(null)
    if (!fileRef.current) { setFormError('Silakan pilih file yang akan diimpor.'); return }
    const local: Record<string, string> = {}
    if (title.trim().length < 3) local.title = 'Judul minimal 3 karakter.'
    if (!date) local.documentDate = 'Tanggal wajib diisi.'
    // Rincian item hanya divalidasi bila file berhasil diekstrak; file scan tanpa teks disimpan sebagai lampiran.
    if (extraction?.parsed) items.forEach((it, i) => { if (!it.description.trim()) local[`items.${i}.description`] = 'Uraian wajib diisi.'; if (!(parsedItems[i].quantity > 0)) local[`items.${i}.quantity`] = 'Harus > 0.' })
    if (Object.keys(local).length) { setErrors(local); setFormError('Periksa kembali isian yang ditandai.'); return }

    const payload = {
      type, title, documentDate: date, ...(number.trim() ? { documentNumber: number.trim() } : {}), clientId: clientId || null, projectId: projectId || null, notes: notes || null,
      discount: Math.trunc(Number(discount) || 0), taxRate: Number(taxRate) || 0,
      items: extraction?.parsed ? items.map((it, i) => ({ description: it.description.trim(), unit: it.unit.trim() || null, quantity: parsedItems[i].quantity, unitPrice: Math.trunc(parsedItems[i].unitPrice) })) : [],
    }
    const fd = new FormData(); fd.append('file', fileRef.current); fd.append('data', JSON.stringify(payload))
    setSaving(true)
    try {
      const res = await postForm<{ id: string; documentNumber: string }>('/api/documents/import/confirm', fd)
      setToast({ m: `Dokumen ${res.documentNumber} dibuat dari import.`, k: 'ok' })
      router.push(`/documents/${res.id}`); router.refresh()
    } catch (e2) {
      const ex = e2 as Error & { details?: Record<string, string> }
      if (ex.details) setErrors(ex.details); setFormError(ex.message)
    } finally { setSaving(false) }
  }

  return <form onSubmit={confirm} noValidate>
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Workspace / Dokumen</div><h1>Impor Dokumen</h1><p>Unggah file .docx atau .pdf. Sistem mengekstrak isi sebanyak mungkin untuk Anda periksa sebelum disimpan sebagai draft.</p></div></section>
    {formError && <div className="banner-error" role="alert">{formError}</div>}

    <section className="panel form-section"><h2>Sumber file</h2>
      {!extraction ? <div
        className="dropzone" style={{ borderColor: dragging ? 'var(--blue)' : undefined, background: dragging ? 'var(--hover)' : undefined }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}>
        <UploadCloud size={34} aria-hidden />
        <p><strong>Seret &amp; lepas file di sini</strong></p>
        <p style={{ color: 'var(--muted)' }}>atau</p>
        <button type="button" className="secondary-button" onClick={() => fileRef.current === null && document.getElementById('import-file')?.click()} disabled={parsing}>{parsing ? 'Mengekstrak…' : 'Pilih file'}</button>
        <input id="import-file" type="file" accept=".docx,.pdf,.doc" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 8 }}>Maksimal 8 MB. Format didukung: .docx, .pdf (dan .doc sebagai lampiran).</p>
      </div>
        : <div className="import-file-row">
          <FileText size={20} aria-hidden />
          <div style={{ flex: 1, minWidth: 0 }}><strong>{extraction.fileName}</strong><span style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>{(extraction.size / 1024).toFixed(1)} KB · {extraction.ocr ? 'teks dibaca via OCR' : extraction.parsed ? 'berhasil diekstrak' : 'tanpa ekstraksi (lampiran)'}</span></div>
          <button type="button" className="icon-button" onClick={clearFile} aria-label="Ganti file"><X /></button>
        </div>}
      {extraction && extraction.ocr && <div className="banner-warn" role="status"><AlertTriangle size={14} /> {extraction.message}</div>}
      {extraction && !extraction.parsed && <div className="banner-warn" role="status"><AlertTriangle size={14} /> {extraction.message}</div>}
    </section>

    {extraction && <>
      <section className="panel form-section"><h2>Informasi utama</h2><div className="form-grid">
        <div className="form-field"><label htmlFor="i-type">Jenis dokumen<span className="req">*</span></label><select id="i-type" className="field-select" value={type} onChange={(e) => setType(e.target.value)}>{DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div className="form-field"><label htmlFor="i-number">Nomor dokumen</label><input id="i-number" className="field-input" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Otomatis bila kosong" />{err('documentNumber')}</div>
        <div className="form-field span-2"><label htmlFor="i-title">Judul<span className="req">*</span></label><input id="i-title" className={cls('title', 'field-input')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />{err('title')}</div>
        <div className="form-field"><label htmlFor="i-date">Tanggal dokumen<span className="req">*</span></label><input id="i-date" type="date" className={cls('documentDate', 'field-input')} value={date} onChange={(e) => setDate(e.target.value)} />{err('documentDate')}</div>
        <div className="form-field" />
        <div className="form-field"><label htmlFor="i-client">Klien</label><select id="i-client" className="field-select" value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId('') }}><option value="">— Tanpa klien —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{err('clientId')}
          {extraction.client && <small style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4, display: 'block' }}>Terdeteksi: {extraction.client}</small>}</div>
        <div className="form-field"><label htmlFor="i-project">Proyek</label><select id="i-project" className="field-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">— Tanpa proyek —</option>{visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{err('projectId')}
          {extraction.project && <small style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4, display: 'block' }}>Terdeteksi: {extraction.project}</small>}</div>
        <div className="form-field span-2"><label htmlFor="i-notes">Catatan</label><textarea id="i-notes" className="field-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} /></div>
      </div></section>

      {extraction.parsed ? <section className="panel form-section"><h2>Rincian item</h2>
        {extraction.total ? <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>Total terdeteksi pada file: <strong>{formatRupiah(extraction.total)}</strong>. Sesuaikan rincian di bawah agar cocok.</p> : null}
        <div className="table-scroll"><table className="items-table"><thead><tr><th style={{ width: 34 }}>#</th><th>Uraian</th><th style={{ width: 80 }}>Satuan</th><th style={{ width: 100 }}>Kuantitas</th><th style={{ width: 150 }}>Harga satuan (Rp)</th><th className="num" style={{ width: 140 }}>Jumlah</th><th style={{ width: 40 }}><span className="sr-only">Hapus</span></th></tr></thead>
          <tbody>{items.map((it, i) => <tr key={i}><td>{i + 1}</td>
            <td><input className={cls(`items.${i}.description`, 'field-input')} aria-label={`Uraian item ${i + 1}`} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />{err(`items.${i}.description`)}</td>
            <td><input className="field-input" aria-label={`Satuan item ${i + 1}`} value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} /></td>
            <td><input className={cls(`items.${i}.quantity`, 'field-input')} inputMode="decimal" aria-label={`Kuantitas item ${i + 1}`} value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />{err(`items.${i}.quantity`)}</td>
            <td><input className="field-input" inputMode="numeric" aria-label={`Harga satuan item ${i + 1}`} value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: e.target.value.replace(/[^\d]/g, '') })} /></td>
            <td className="num" style={{ paddingTop: 14 }}>{formatRupiah(totals.lines[i] ?? 0)}</td>
            <td><button type="button" className="icon-button" aria-label={`Hapus item ${i + 1}`} onClick={() => setItems((a) => a.filter((_, k) => k !== i))}><X /></button></td></tr>)}</tbody></table></div>
        <button type="button" className="secondary-button" style={{ marginTop: 10 }} onClick={() => setItems((a) => [...a, emptyItem()])}>Tambah item</button>
        <div className="totals">
          <div><span>Subtotal</span><span>{formatRupiah(totals.subtotal)}</span></div>
          <div><span>Diskon (Rp)</span><input className="field-input" style={{ width: 150, textAlign: 'right' }} inputMode="numeric" aria-label="Diskon" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ''))} /></div>
          <div><span>Pajak (%)</span><input className="field-input" style={{ width: 150, textAlign: 'right' }} inputMode="decimal" aria-label="Tarif pajak" value={taxRate} onChange={(e) => setTaxRate(e.target.value.replace(',', '.'))} /></div>
          <div><span>Pajak</span><span>{formatRupiah(totals.taxAmount)}</span></div>
          <div className="grand"><span>Total</span><span>{formatRupiah(totals.total)}</span></div>
          <small style={{ color: 'var(--muted)', fontSize: 10 }}>Perhitungan resmi dilakukan ulang oleh server saat disimpan.</small>
        </div></section>
        : <section className="panel form-section"><h2>Rincian item</h2>
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>Tidak ada teks yang berhasil dibaca dari file ini (mis. scan tanpa hasil OCR). Dokumen akan disimpan sebagai <strong>draft</strong> dengan file scan sebagai lampiran. Isi rincian item dapat ditambahkan setelahnya melalui menu Edit.</p>
        </section>}
    </>}

    <div className="form-actions"><Link href="/documents" className="secondary-button">Batal</Link><button className="primary-button" disabled={saving || !extraction}>{saving ? 'Menyimpan…' : extraction?.parsed ? 'Simpan sebagai Draft' : 'Simpan sebagai Lampiran'}</button></div>
    <Toast message={toast.m} kind={toast.k} />
  </form>
}
