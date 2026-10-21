'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Download, Edit3, FileUp, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { can, type Role } from '@/lib/permissions-client'
import { api, EmptyState, ErrorState, LoadingSkeleton, Toast } from './shared'

type Vendor = {
  id: string; vendorCode: string; name: string; category: string; npwp: string | null
  address: string | null; contactPerson: string | null; email: string | null; phone: string | null
  bankName: string | null; bankAccount: string | null; bankAccountName: string | null
  status: 'active' | 'inactive' | 'blacklisted'; notes: string | null; createdAt: string; updatedAt: string; createdBy: string
}
type FormData = {
  vendorCode: string; name: string; category: string; npwp: string; address: string
  contactPerson: string; email: string; phone: string; bankName: string
  bankAccount: string; bankAccountName: string; status: 'active' | 'inactive' | 'blacklisted'; notes: string
}
const blank: FormData = {
  vendorCode: '', name: '', category: 'Lainnya', npwp: '', address: '', contactPerson: '',
  email: '', phone: '', bankName: '', bankAccount: '', bankAccountName: '', status: 'active', notes: '',
}
const categories = ['Lainnya', 'Material', 'Jasa Konstruksi', 'Konsultan', 'Teknologi Informasi', 'Peralatan', 'Logistik', 'ATK', 'Pemeliharaan']
const statusLabel: Record<Vendor['status'], string> = { active: 'Aktif', inactive: 'Nonaktif', blacklisted: 'Blacklist' }
const importColumns = ['vendorCode', 'name', 'category', 'npwp', 'address', 'contactPerson', 'email', 'phone', 'bankName', 'bankAccount', 'bankAccountName', 'status', 'notes'] as const
const headerAliases: Record<string, string> = {
  vendorcode: 'vendorCode', kodevendor: 'vendorCode', kode: 'vendorCode',
  name: 'name', namavendor: 'name', namaperusahaan: 'name', perusahaan: 'name',
  category: 'category', kategori: 'category', npwp: 'npwp', address: 'address', alamat: 'address',
  contactperson: 'contactPerson', narahubung: 'contactPerson', pic: 'contactPerson',
  email: 'email', phone: 'phone', telepon: 'phone', whatsapp: 'phone',
  bankname: 'bankName', namabank: 'bankName', bankaccount: 'bankAccount', nomorrekening: 'bankAccount',
  bankaccountname: 'bankAccountName', namapemilikrekening: 'bankAccountName',
  status: 'status', catatan: 'notes', notes: 'notes',
}
function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  const firstLine = source.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(cell.trim()); if (row.some((v) => v !== '')) rows.push(row)
      row = []; cell = ''
    } else cell += char
  }
  row.push(cell.trim()); if (row.some((v) => v !== '')) rows.push(row)
  return rows
}
const inputFields: { key: keyof FormData; label: string; type?: string; max?: number }[] = [
  { key: 'vendorCode', label: 'Kode vendor *', max: 40 }, { key: 'name', label: 'Nama perusahaan/vendor *', max: 180 },
  { key: 'npwp', label: 'NPWP', max: 40 }, { key: 'contactPerson', label: 'Nama narahubung', max: 150 },
  { key: 'email', label: 'Email', type: 'email', max: 180 }, { key: 'phone', label: 'Telepon/WhatsApp', max: 40 },
  { key: 'bankName', label: 'Nama bank', max: 120 }, { key: 'bankAccount', label: 'Nomor rekening', max: 80 },
  { key: 'bankAccountName', label: 'Nama pemilik rekening', max: 180 },
]

export default function VendorManager({ role }: { role: Role }) {
  const [rows, setRows] = useState<Vendor[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [form, setForm] = useState<FormData | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toast, setToast] = useState<{ m: string; k: 'ok' | 'error' } | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importReport, setImportReport] = useState<{ imported: number; failed: number; errors: { row: number; vendorCode?: string; field?: string; message: string }[] } | null>(null)
  const importInput = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    api<Vendor[]>('/api/vendors').then((data) => { setRows(data); setLoading(false) }).catch((e) => { setError((e as Error).message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 3500); return () => clearTimeout(timer) }, [toast])

  const filtered = useMemo(() => (rows ?? []).filter((v) => {
    const haystack = [v.vendorCode, v.name, v.category, v.npwp, v.contactPerson, v.email, v.phone].join(' ').toLowerCase()
    return haystack.includes(query.toLowerCase()) && (statusFilter === 'all' || v.status === statusFilter) && (categoryFilter === 'all' || v.category === categoryFilter)
  }), [rows, query, statusFilter, categoryFilter])
  const categoryOptions = useMemo(() => Array.from(new Set([ ...categories, ...(rows ?? []).map((v) => v.category) ])), [rows])

  function openCreate() { setEditing(null); setForm({ ...blank }); setFieldError(null) }
  function openEdit(v: Vendor) {
    setEditing(v.id)
    setForm({
      vendorCode: v.vendorCode, name: v.name, category: v.category, npwp: v.npwp ?? '', address: v.address ?? '',
      contactPerson: v.contactPerson ?? '', email: v.email ?? '', phone: v.phone ?? '', bankName: v.bankName ?? '',
      bankAccount: v.bankAccount ?? '', bankAccountName: v.bankAccountName ?? '', status: v.status, notes: v.notes ?? '',
    })
    setFieldError(null)
  }
  async function save() {
    if (!form) return
    if (form.vendorCode.trim().length < 2 || form.name.trim().length < 2) { setFieldError('Kode vendor dan nama perusahaan wajib diisi (minimal 2 karakter).'); return }
    setSaving(true); setFieldError(null)
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]))
    try {
      await api<Vendor>(editing ? `/api/vendors/${editing}` : '/api/vendors', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      setToast({ m: editing ? 'Data vendor berhasil diperbarui.' : 'Vendor berhasil ditambahkan.', k: 'ok' })
      setForm(null); setEditing(null); load()
    } catch (e) { setFieldError((e as Error).message) } finally { setSaving(false) }
  }
  async function remove(v: Vendor) {
    if (!window.confirm(`Hapus vendor “${v.name}” (${v.vendorCode})? Data akan diarsipkan dan tidak dihapus permanen.`)) return
    setDeleting(v.id)
    try {
      await api(`/api/vendors/${v.id}`, { method: 'DELETE' })
      setToast({ m: 'Vendor berhasil dihapus.', k: 'ok' }); load()
    } catch (e) { setToast({ m: (e as Error).message, k: 'error' }) } finally { setDeleting(null) }
  }
  function exportCsv() {
    const cols: (keyof Vendor)[] = ['vendorCode','name','category','npwp','contactPerson','email','phone','address','bankName','bankAccount','bankAccountName','status','notes']
    const csvCell = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"'
    const content = '\uFEFF' + [cols.join(';'), ...filtered.map((v) => cols.map((key) => csvCell(key === 'status' ? statusLabel[v.status] : v[key])).join(';'))].join('\r\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'data-vendor.csv'; a.click(); URL.revokeObjectURL(url)
    setToast({ m: `Ekspor ${filtered.length} data vendor berhasil dibuat.`, k: 'ok' })
  }
  function downloadImportErrors() {
    if (!importReport?.errors.length) return
    const cols = ['Baris CSV', 'Kode Vendor', 'Kolom Bermasalah', 'Keterangan Kesalahan']
    const cell = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"'
    const csv = '\uFEFF' + [cols, ...importReport.errors.map((e) => [e.row, e.vendorCode ?? '', e.field ?? 'data', e.message])].map((r) => r.map(cell).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'laporan-kesalahan-import-vendor.csv'; a.click(); URL.revokeObjectURL(url)
  }
  function downloadImportTemplate() {
    const labels = ['Kode Vendor', 'Nama Vendor', 'Kategori', 'NPWP', 'Alamat', 'Narahubung', 'Email', 'Telepon', 'Nama Bank', 'Nomor Rekening', 'Nama Pemilik Rekening', 'Status', 'Catatan']
    const sample = ['VND-001', 'PT Contoh Vendor', 'Material', '', 'Alamat vendor', 'Budi', 'vendor@example.com', '08123456789', 'BCA', '1234567890', 'PT Contoh Vendor', 'Aktif', 'Contoh data; hapus baris ini sebelum import']
    const csv = '\uFEFF' + [labels, sample].map((r) => r.map((v) => '"' + v.replace(/"/g, '""') + '"').join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'template-import-vendor.csv'; a.click(); URL.revokeObjectURL(url)
  }
  async function importCsv(file?: File) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setToast({ m: 'Format belum didukung. Simpan file Excel sebagai CSV UTF-8 terlebih dahulu.', k: 'error' })
      if (importInput.current) importInput.current.value = ''
      return
    }
    setImporting(true)
    try {
      const rowsCsv = parseCsv(await file.text())
      if (rowsCsv.length < 2) throw new Error('File CSV harus memiliki header dan minimal satu baris data.')
      const headers = rowsCsv[0].map((h) => headerAliases[h.toLowerCase().replace(/[\s_-]/g, '')] ?? headerAliases[h.toLowerCase().replace(/[^a-z0-9]/g, '')])
      const codeIndex = headers.indexOf('vendorCode'), nameIndex = headers.indexOf('name')
      if (codeIndex < 0 || nameIndex < 0) throw new Error('Header wajib tidak ditemukan. Gunakan template import: Kode Vendor dan Nama Vendor.')
      const items = rowsCsv.slice(1).map((cells) => {
        const item: Record<string, string> = {}
        headers.forEach((key, index) => { if (key && importColumns.includes(key as typeof importColumns[number])) item[key] = cells[index] ?? '' })
        if (item.status) {
          const status = item.status.toLowerCase()
          item.status = ['nonaktif', 'inactive'].includes(status) ? 'inactive' : ['blacklist', 'blacklisted'].includes(status) ? 'blacklisted' : 'active'
        }
        if (!item.category) item.category = 'Lainnya'
        return item
      }).filter((item) => Object.values(item).some((value) => value.trim() !== ''))
      if (!items.length) throw new Error('Tidak ada baris data yang bisa diimpor.')
      const result = await api<{ imported: number; failed: number; errors: { row: number; vendorCode?: string; field?: string; message: string }[] }>('/api/vendors/import', { method: 'POST', body: JSON.stringify({ items }) })
      setImportReport(result)
      load()
      if (result.failed) setToast({ m: `Import selesai: ${result.imported} berhasil, ${result.failed} gagal. Periksa laporan kesalahan di bawah.`, k: result.imported ? 'ok' : 'error' })
      else setToast({ m: `Berhasil mengimpor ${result.imported} vendor.`, k: 'ok' })
    } catch (e) {
      setToast({ m: (e as Error).message || 'Import gagal.', k: 'error' })
    } finally {
      setImporting(false)
      if (importInput.current) importInput.current.value = ''
    }
  }

  return <>
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Workspace / Master Data</div><h1>Data Vendor</h1><p>Kelola identitas, kontak, kategori, rekening, dan status vendor perusahaan.</p></div>
      {can(role, 'create') && <button className="primary-button" onClick={openCreate}><Plus /> Tambah Vendor</button>}</section>
    <section className="stat-grid">
      <div className="stat-card"><div className="stat-top"><span>Total vendor</span><Building2 /></div><strong>{rows?.length ?? '—'}</strong><div className="stat-foot">Semua vendor aktif dan nonaktif</div></div>
      <div className="stat-card"><div className="stat-top"><span>Vendor aktif</span><Building2 /></div><strong>{rows?.filter((v) => v.status === 'active').length ?? '—'}</strong><div className="stat-foot">Dapat dipilih untuk pengadaan</div></div>
      <div className="stat-card"><div className="stat-top"><span>Nonaktif / blacklist</span><Building2 /></div><strong>{rows?.filter((v) => v.status !== 'active').length ?? '—'}</strong><div className="stat-foot">Tidak direkomendasikan untuk transaksi</div></div>
    </section>

    {form && <section className="panel form-section">
      <div className="panel-heading"><div><h2>{editing ? 'Edit Vendor' : 'Tambah Vendor'}</h2><p>Kolom bertanda * wajib diisi. Periksa kembali NPWP dan rekening sebelum menyimpan.</p></div><button className="icon-button" onClick={() => setForm(null)} aria-label="Tutup form"><X /></button></div>
      {fieldError && <div className="banner-error" role="alert">{fieldError}</div>}
      <div className="form-grid">
        {inputFields.map((field) => <div className="form-field" key={field.key}><label htmlFor={`vendor-${field.key}`}>{field.label}</label><input id={`vendor-${field.key}`} type={field.type ?? 'text'} className="field-input" maxLength={field.max} value={form[field.key] as string} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} /></div>)}
        <div className="form-field"><label htmlFor="vendor-category">Kategori</label><select id="vendor-category" className="field-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categoryOptions.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="form-field"><label htmlFor="vendor-status">Status vendor</label><select id="vendor-status" className="field-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormData['status'] })}><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="blacklisted">Blacklist</option></select></div>
        <div className="form-field span-2"><label htmlFor="vendor-address">Alamat</label><textarea id="vendor-address" className="field-input" rows={2} maxLength={500} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="form-field span-2"><label htmlFor="vendor-notes">Catatan</label><textarea id="vendor-notes" className="field-input" rows={2} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <div className="form-actions"><button className="secondary-button" onClick={() => setForm(null)} disabled={saving}>Batal</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Simpan Vendor'}</button></div>
    </section>}

    <section className="panel documents-panel">
      {importReport && <section className="panel" style={{ marginTop: 16, padding: 18 }} aria-live="polite">
        <div className="panel-heading"><div><h2>Laporan Import Vendor</h2><p>Periksa baris dan kolom yang tidak sesuai. Nomor baris mengacu pada file CSV, termasuk header sebagai baris 1.</p></div><button className="icon-button" onClick={() => setImportReport(null)} aria-label="Tutup laporan"><X /></button></div>
        <div className="stat-grid" style={{ marginBottom: 16 }}><div className="stat-card"><div className="stat-top"><span>Berhasil</span></div><strong>{importReport.imported}</strong></div><div className="stat-card"><div className="stat-top"><span>Gagal</span></div><strong>{importReport.failed}</strong></div><div className="stat-card"><div className="stat-top"><span>Total diproses</span></div><strong>{importReport.imported + importReport.failed}</strong></div></div>
        {importReport.errors.length > 0 ? <><div className="toolbar-actions" style={{ marginBottom: 12 }}><button className="secondary-button" onClick={downloadImportErrors}><Download /> Unduh laporan kesalahan CSV</button></div><div className="table-scroll"><table><thead><tr><th>Baris CSV</th><th>Kode Vendor</th><th>Kolom</th><th>Kesalahan dan perbaikan</th></tr></thead><tbody>{importReport.errors.map((e, i) => <tr key={`${e.row}-${i}`}><td>{e.row}</td><td>{e.vendorCode || '—'}</td><td>{e.field || 'Data'}</td><td><span style={{ color: 'var(--danger, #b91c1c)' }}>{e.message}</span></td></tr>)}</tbody></table></div><p className="stat-foot" style={{ marginTop: 12 }}>Perbaiki baris yang disebutkan di file sumber, lalu impor ulang. Baris yang sudah berhasil tidak perlu diimpor ulang agar tidak terjadi duplikasi.</p></> : <p>Semua baris berhasil divalidasi dan disimpan.</p>}
      </section>}
      <div className="table-toolbar" style={{ marginTop: 0 }}>
        <div className="search-field"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kode, nama, NPWP, kontak..." aria-label="Cari vendor" /></div>
        <div className="toolbar-actions">{can(role, 'create') && <><input ref={importInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => importCsv(e.target.files?.[0])} /><button className="secondary-button" onClick={() => importInput.current?.click()} disabled={importing}>{importing ? <RefreshCw /> : <FileUp />} {importing ? 'Mengimpor…' : 'Import CSV'}</button><button className="secondary-button" onClick={downloadImportTemplate}><Download /> Template Import</button></>}<select className="field-select" aria-label="Filter status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="blacklisted">Blacklist</option></select><select className="field-select" aria-label="Filter kategori" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">Semua kategori</option>{categoryOptions.map((c) => <option key={c}>{c}</option>)}</select><button className="secondary-button" onClick={exportCsv} disabled={!filtered.length}><Download /> Export CSV</button><button className="secondary-button" onClick={load} disabled={loading}><RefreshCw /> Refresh</button></div>
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : loading && !rows ? <LoadingSkeleton /> : filtered.length === 0 ? <EmptyState title={rows?.length ? 'Vendor tidak ditemukan' : 'Belum ada data vendor'} description={rows?.length ? 'Ubah kata kunci atau filter pencarian.' : 'Tambahkan data vendor untuk mulai mengelola mitra perusahaan.'} /> :
        <div className="table-scroll"><table><thead><tr><th>Kode / Nama Vendor</th><th>Kategori</th><th>NPWP</th><th>Narahubung</th><th>Kontak</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
          {filtered.map((v) => <tr key={v.id}><td><div className="document-cell"><div className="doc-icon"><Building2 /></div><div><strong>{v.name}</strong><span>{v.vendorCode}</span></div></div></td><td>{v.category}</td><td>{v.npwp || '—'}</td><td>{v.contactPerson || '—'}</td><td><div>{v.email || '—'}</div><small>{v.phone || ''}</small></td><td><span className={`status-badge status-${v.status === 'active' ? 'green' : v.status === 'blacklisted' ? 'purple' : 'slate'}`}><span className="status-dot" />{statusLabel[v.status]}</span></td><td><div className="toolbar-actions">{can(role, 'edit') && <button className="icon-button" aria-label={`Edit ${v.name}`} title="Edit vendor" onClick={() => openEdit(v)}><Edit3 /></button>}{can(role, 'delete') && <button className="icon-button" aria-label={`Hapus ${v.name}`} title="Hapus vendor" disabled={deleting === v.id} onClick={() => remove(v)}><Trash2 /></button>}</div></td></tr>)}
        </tbody></table></div>}
      <div className="table-toolbar"><span style={{ color: 'var(--muted)', fontSize: 11 }}>Menampilkan {filtered.length} dari {rows?.length ?? 0} vendor</span></div>
    </section>
    <Toast message={toast?.m ?? null} kind={toast?.k} />
  </>
}
