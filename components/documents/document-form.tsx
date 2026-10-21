'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { computeTotals } from '@/lib/documents/calc'
import { DOCUMENT_TYPES, formatRupiah } from '@/lib/documents/constants'
import { api, Toast } from './shared'

type Option = { id: string; name: string; clientId?: string | null }
type ItemState = { description: string; unit: string; quantity: string; unitPrice: string }
export type FormInitial = {
  id: string; type: string; title: string; documentNumber: string; documentDate: string; clientId: string | null; projectId: string | null; notes: string | null
  discount: number; taxRate: string; version: number; items: { description: string; unit: string | null; quantity: string; unitPrice: number }[]
}

const today = () => new Date().toISOString().slice(0, 10)
const emptyItem = (): ItemState => ({ description: '', unit: '', quantity: '1', unitPrice: '0' })

export default function DocumentForm({ initial, defaultType }: { initial?: FormInitial; defaultType?: string }) {
  const router = useRouter(); const editing = !!initial
  const [type, setType] = useState(initial?.type ?? (DOCUMENT_TYPES.some((t) => t.value === defaultType) ? defaultType! : 'quotation'))
  const [title, setTitle] = useState(initial?.title ?? ''); const [number, setNumber] = useState(initial?.documentNumber ?? ''); const [date, setDate] = useState(initial?.documentDate ?? today())
  const [clientId, setClientId] = useState(initial?.clientId ?? ''); const [projectId, setProjectId] = useState(initial?.projectId ?? ''); const [notes, setNotes] = useState(initial?.notes ?? '')
  const [discount, setDiscount] = useState(String(initial?.discount ?? 0)); const [taxRate, setTaxRate] = useState(String(initial ? Number(initial.taxRate) : 11))
  const [items, setItems] = useState<ItemState[]>(initial?.items.length ? initial.items.map((i) => ({ description: i.description, unit: i.unit ?? '', quantity: String(Number(i.quantity)), unitPrice: String(i.unitPrice) })) : [emptyItem()])
  const [clients, setClients] = useState<Option[]>([]); const [projects, setProjects] = useState<Option[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({}); const [formError, setFormError] = useState<string | null>(null); const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null); const [newClient, setNewClient] = useState<string | null>(null); const [newProject, setNewProject] = useState<string | null>(null)

  useEffect(() => { api<Option[]>('/api/clients').then(setClients).catch(() => setFormError('Gagal memuat daftar klien.')); api<Option[]>('/api/projects').then(setProjects).catch(() => setFormError('Gagal memuat daftar proyek.')) }, [])
  const visibleProjects = projects.filter((p) => !clientId || !p.clientId || p.clientId === clientId)

  // Pratinjau saja; angka resmi dihitung ulang di server saat disimpan.
  const parsed = useMemo(() => items.map((i) => ({ quantity: Number(i.quantity.replace(',', '.')) || 0, unitPrice: Number(i.unitPrice) || 0 })), [items])
  const totals = useMemo(() => computeTotals(parsed, Math.max(0, Math.trunc(Number(discount) || 0)), Number(taxRate) || 0), [parsed, discount, taxRate])

  const setItem = (idx: number, patch: Partial<ItemState>) => setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const err = (k: string) => errors[k] ? <div className="field-error" role="alert">{errors[k]}</div> : null
  const cls = (k: string, base: string) => `${base} ${errors[k] ? 'field-invalid' : ''}`

  async function addClient() {
    if (!newClient?.trim()) return
    try { const c = await api<Option>('/api/clients', { method: 'POST', body: JSON.stringify({ name: newClient }) }); setClients((l) => [...l, c].sort((a, b) => a.name.localeCompare(b.name))); setClientId(c.id); setNewClient(null) }
    catch (e) { setErrors((x) => ({ ...x, clientId: (e as Error).message })) }
  }
  async function addProject() {
    if (!newProject?.trim()) return
    try { const p = await api<Option>('/api/projects', { method: 'POST', body: JSON.stringify({ name: newProject, clientId: clientId || null }) }); setProjects((l) => [...l, p].sort((a, b) => a.name.localeCompare(b.name))); setProjectId(p.id); setNewProject(null) }
    catch (e) { setErrors((x) => ({ ...x, projectId: (e as Error).message })) }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErrors({}); setFormError(null)
    const local: Record<string, string> = {}
    if (title.trim().length < 3) local.title = 'Judul minimal 3 karakter.'
    if (editing && !number.trim()) local.documentNumber = 'Nomor dokumen wajib diisi.'
    if (!date) local.documentDate = 'Tanggal wajib diisi.'
    items.forEach((it, i) => { if (!it.description.trim()) local[`items.${i}.description`] = 'Uraian wajib diisi.'; if (!(parsed[i].quantity > 0)) local[`items.${i}.quantity`] = 'Harus > 0.' })
    if (Object.keys(local).length) { setErrors(local); setFormError('Periksa kembali isian yang ditandai.'); return }

    const payload = {
      type, title, documentDate: date, ...(number.trim() ? { documentNumber: number.trim() } : {}), clientId: clientId || null, projectId: projectId || null, notes: notes || null,
      discount: Math.trunc(Number(discount) || 0), taxRate: Number(taxRate) || 0,
      items: items.map((it, i) => ({ description: it.description.trim(), unit: it.unit.trim() || null, quantity: parsed[i].quantity, unitPrice: Math.trunc(parsed[i].unitPrice) })),
    }
    setSaving(true)
    try {
      const res = editing
        ? await api<{ id: string }>(`/api/documents/${initial!.id}`, { method: 'PATCH', body: JSON.stringify({ ...payload, expectedVersion: initial!.version }) })
        : await api<{ id: string }>('/api/documents', { method: 'POST', body: JSON.stringify(payload) })
      setToast(editing ? 'Perubahan disimpan.' : 'Dokumen dibuat sebagai draft.')
      router.push(`/documents/${res.id}`); router.refresh()
    } catch (e2) {
      const ex = e2 as Error & { details?: Record<string, string> }
      if (ex.details && typeof ex.details === 'object') setErrors(ex.details)
      setFormError(ex.message)
    } finally { setSaving(false) }
  }

  return <form onSubmit={submit} noValidate>
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Workspace / Dokumen</div><h1>{editing ? 'Edit Dokumen' : 'Tambah Dokumen'}</h1><p>{editing ? `Mengubah ${initial!.documentNumber}. Perubahan dicatat sebagai versi baru.` : 'Dokumen disimpan sebagai draft. Nomor dibuat otomatis jika dikosongkan.'}</p></div></section>
    {formError && <div className="banner-error" role="alert">{formError}</div>}

    <section className="panel form-section"><h2>Informasi utama</h2><div className="form-grid">
      <div className="form-field"><label htmlFor="type">Jenis dokumen<span className="req">*</span></label><select id="type" className="field-select" value={type} onChange={(e) => setType(e.target.value)} disabled={editing}>{DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
      <div className="form-field"><label htmlFor="number">Nomor dokumen{editing && <span className="req">*</span>}</label><input id="number" className={cls('documentNumber', 'field-input')} value={number} onChange={(e) => setNumber(e.target.value)} placeholder={editing ? '' : 'Otomatis, mis. PENAWARAN-2026-001'} />{err('documentNumber')}</div>
      <div className="form-field span-2"><label htmlFor="title">Judul<span className="req">*</span></label><input id="title" className={cls('title', 'field-input')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />{err('title')}</div>
      <div className="form-field"><label htmlFor="date">Tanggal dokumen<span className="req">*</span></label><input id="date" type="date" className={cls('documentDate', 'field-input')} value={date} onChange={(e) => setDate(e.target.value)} />{err('documentDate')}</div>
      <div className="form-field" />
      <div className="form-field"><label htmlFor="client">Klien</label>
        <select id="client" className={cls('clientId', 'field-select')} value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId('') }}><option value="">— Tanpa klien —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{err('clientId')}
        {newClient === null ? <button type="button" className="activity-link" style={{ marginTop: 6 }} onClick={() => setNewClient('')}><Plus size={12} /> Klien baru</button>
          : <div style={{ display: 'flex', gap: 6, marginTop: 6 }}><input className="field-input" autoFocus placeholder="Nama klien" value={newClient} onChange={(e) => setNewClient(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addClient() } }} /><button type="button" className="secondary-button" onClick={addClient}>Simpan</button><button type="button" className="secondary-button" onClick={() => setNewClient(null)}>Batal</button></div>}</div>
      <div className="form-field"><label htmlFor="project">Proyek</label>
        <select id="project" className={cls('projectId', 'field-select')} value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">— Tanpa proyek —</option>{visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{err('projectId')}
        {newProject === null ? <button type="button" className="activity-link" style={{ marginTop: 6 }} onClick={() => setNewProject('')}><Plus size={12} /> Proyek baru</button>
          : <div style={{ display: 'flex', gap: 6, marginTop: 6 }}><input className="field-input" autoFocus placeholder="Nama proyek" value={newProject} onChange={(e) => setNewProject(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProject() } }} /><button type="button" className="secondary-button" onClick={addProject}>Simpan</button><button type="button" className="secondary-button" onClick={() => setNewProject(null)}>Batal</button></div>}</div>
      <div className="form-field span-2"><label htmlFor="notes">Catatan</label><textarea id="notes" className="field-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} /></div>
    </div></section>

    <section className="panel form-section"><h2>Rincian item</h2>
      <div className="table-scroll"><table className="items-table"><thead><tr><th style={{ width: 34 }}>#</th><th>Uraian</th><th style={{ width: 80 }}>Satuan</th><th style={{ width: 100 }}>Kuantitas</th><th style={{ width: 150 }}>Harga satuan (Rp)</th><th className="num" style={{ width: 140 }}>Jumlah</th><th style={{ width: 40 }}><span className="sr-only">Hapus</span></th></tr></thead>
        <tbody>{items.map((it, i) => <tr key={i}><td>{i + 1}</td>
          <td><input className={cls(`items.${i}.description`, 'field-input')} aria-label={`Uraian item ${i + 1}`} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />{err(`items.${i}.description`)}</td>
          <td><input className="field-input" aria-label={`Satuan item ${i + 1}`} value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} /></td>
          <td><input className={cls(`items.${i}.quantity`, 'field-input')} inputMode="decimal" aria-label={`Kuantitas item ${i + 1}`} value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />{err(`items.${i}.quantity`)}</td>
          <td><input className="field-input" inputMode="numeric" aria-label={`Harga satuan item ${i + 1}`} value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: e.target.value.replace(/[^\d]/g, '') })} /></td>
          <td className="num" style={{ paddingTop: 14 }}>{formatRupiah(totals.lines[i] ?? 0)}</td>
          <td><button type="button" className="icon-button" aria-label={`Hapus item ${i + 1}`} onClick={() => setItems((a) => a.filter((_, k) => k !== i))}><Trash2 /></button></td></tr>)}</tbody></table></div>
      <button type="button" className="secondary-button" style={{ marginTop: 10 }} onClick={() => setItems((a) => [...a, emptyItem()])}><Plus /> Tambah item</button>
      <div className="totals">
        <div><span>Subtotal</span><span>{formatRupiah(totals.subtotal)}</span></div>
        <div><span>Diskon (Rp)</span><input className="field-input" style={{ width: 150, textAlign: 'right' }} inputMode="numeric" aria-label="Diskon" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ''))} /></div>
        <div><span>Pajak (%)</span><input className="field-input" style={{ width: 150, textAlign: 'right' }} inputMode="decimal" aria-label="Tarif pajak" value={taxRate} onChange={(e) => setTaxRate(e.target.value.replace(',', '.'))} /></div>
        <div><span>Pajak</span><span>{formatRupiah(totals.taxAmount)}</span></div>
        <div className="grand"><span>Total</span><span>{formatRupiah(totals.total)}</span></div>
        <small style={{ color: 'var(--muted)', fontSize: 10 }}>Perhitungan resmi dilakukan ulang oleh server saat disimpan.</small>
      </div></section>

    <div className="form-actions"><Link href={editing ? `/documents/${initial!.id}` : '/documents'} className="secondary-button">Batal</Link><button className="primary-button" disabled={saving}>{saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Simpan sebagai Draft'}</button></div>
    <Toast message={toast} />
  </form>
}
