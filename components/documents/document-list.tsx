'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, Eye, FileDown, FileText, Pencil, Plus, RefreshCw, RotateCcw, Search, Trash2, Upload } from 'lucide-react'
import { DELETABLE_STATUSES, DOCUMENT_STATUSES, DOCUMENT_TYPES, EDITABLE_STATUSES, formatRupiah, typeLabel } from '@/lib/documents/constants'
import { can, type Role } from '@/lib/permissions-client'
import { api, ConfirmDialog, DocumentStatusBadge, downloadFile, EmptyState, ErrorState, LoadingSkeleton, Toast } from './shared'

type Row = { id: string; documentNumber: string; title: string; type: string; status: string; documentDate: string; total: number; updatedAt: string; createdBy: string; clientName: string | null; projectName: string | null; creatorName: string | null }
type Result = { rows: Row[]; total: number; page: number; pageSize: number; pageCount: number }
type Project = { id: string; name: string }

const FILTER_KEYS = ['q', 'type', 'status', 'projectId', 'from', 'to'] as const
const dateFmt = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function DocumentList({ userId, role }: { userId: string; role: Role }) {
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams()
  const [data, setData] = useState<Result | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([]); const [toast, setToast] = useState<{ m: string; k: 'ok' | 'error' } | null>(null)
  const [toDelete, setToDelete] = useState<Row | null>(null); const [busy, setBusy] = useState(false); const [delError, setDelError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState(sp.get('q') ?? ''); const [tick, setTick] = useState(0)

  const query = sp.toString()
  const sort = sp.get('sort') ?? 'updatedAt'; const dir = sp.get('dir') ?? 'desc'

  const setParams = useCallback((patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    if (resetPage) next.delete('page')
    router.replace(`${pathname}${next.toString() ? `?${next}` : ''}`)
  }, [sp, router, pathname])

  // Debounce pencarian
  useEffect(() => { const t = setTimeout(() => { if ((sp.get('q') ?? '') !== search) setParams({ q: search || null }) }, 350); return () => clearTimeout(t) }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctrl = new AbortController(); setLoading(true); setError(null)
    fetch(`/api/documents?${query}`, { signal: ctrl.signal, cache: 'no-store' })
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error ?? 'Gagal memuat dokumen.'); return b as Result })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ctrl.abort()
  }, [query, tick])

  useEffect(() => { api<Project[]>('/api/projects').then(setProjects).catch(() => {}) }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t) }, [toast])

  const hasFilters = FILTER_KEYS.some((k) => sp.get(k))
  const reset = () => { setSearch(''); router.replace(pathname) }
  const toggleSort = (col: string) => setParams({ sort: col, dir: sort === col && dir === 'desc' ? 'asc' : 'desc' }, false)
  const SortHead = ({ col, children }: { col: string; children: React.ReactNode }) => <th aria-sort={sort === col ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><button className="sortable" onClick={() => toggleSort(col)}>{children}{sort === col && (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button></th>

  async function duplicate(r: Row) {
    try { const res = await api<{ id: string }>(`/api/documents/${r.id}/duplicate`, { method: 'POST' }); router.push(`/documents/${res.id}/edit`) }
    catch (e) { setToast({ m: (e as Error).message, k: 'error' }) }
  }
  async function confirmDelete() {
    if (!toDelete) return; setBusy(true); setDelError(null)
    try { await api(`/api/documents/${toDelete.id}`, { method: 'DELETE' }); setToast({ m: `Dokumen ${toDelete.documentNumber} dihapus.`, k: 'ok' }); setToDelete(null); setTick((t) => t + 1) }
    catch (e) { setDelError((e as Error).message) } finally { setBusy(false) }
  }
  async function exportBulk(format: 'docx' | 'pdf') {
    const ids = [...selected]
    if (!ids.length) { setToast({ m: 'Pilih minimal satu dokumen terlebih dahulu.', k: 'error' }); return }
    setBusy(true)
    try { await downloadFile('/api/documents/export/bulk', { ids, format }, `export-${format}.zip`); setToast({ m: `${ids.length} dokumen di-export sebagai ${format.toUpperCase()}.`, k: 'ok' }); setSelected(new Set()) }
    catch (e) { setToast({ m: (e as Error).message, k: 'error' }) } finally { setBusy(false) }
  }
  async function exportOne(r: Row, format: 'docx' | 'pdf') {
    setBusy(true)
    try { await downloadFile(`/api/documents/${r.id}/export/${format}`, {}, `${r.documentNumber}.${format}`); setToast({ m: `File ${format.toUpperCase()} ${r.documentNumber} diunduh.`, k: 'ok' }) }
    catch (e) { setToast({ m: (e as Error).message, k: 'error' }) } finally { setBusy(false) }
  }
  const toggleRow = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSelected = !!data && data.rows.length > 0 && data.rows.every((r) => selected.has(r.id))
  const toggleAll = () => setSelected((s) => { const n = new Set(s); data?.rows.forEach((r) => (allSelected ? n.delete(r.id) : n.add(r.id))); return n })

  return <>
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Workspace / Dokumen</div><h1>Semua Dokumen</h1><p>Cari, filter, dan kelola dokumen perusahaan.</p></div>
      {can(role, 'create') && <div className="heading-actions"><Link href="/documents/import" className="secondary-button"><Upload /> Impor</Link><Link href="/documents/new" className="primary-button"><Plus /> Tambah Dokumen</Link></div>}</section>
    <section className="panel documents-panel">
      <div className="table-toolbar" style={{ marginTop: 0 }}>
        <div className="search-field"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor, judul, klien, proyek, atau jenis…" aria-label="Cari dokumen" /></div>
        <div className="toolbar-actions">
          {selected.size > 0 && <><button className="secondary-button" onClick={() => exportBulk('docx')} disabled={busy}><FileDown /> Export Word ({selected.size})</button>
            <button className="secondary-button" onClick={() => exportBulk('pdf')} disabled={busy}><FileDown /> Export PDF ({selected.size})</button></>}
          <button className="secondary-button" onClick={reset} disabled={!hasFilters}><RotateCcw /> Reset Filter</button>
          <button className="secondary-button" onClick={() => setTick((t) => t + 1)} disabled={loading}><RefreshCw /> Refresh</button>
        </div>
      </div>
      <div className="filter-bar">
        <select className="field-select" aria-label="Jenis dokumen" value={sp.get('type') ?? ''} onChange={(e) => setParams({ type: e.target.value || null })}><option value="">Semua jenis</option>{DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        <select className="field-select" aria-label="Status" value={sp.get('status') ?? ''} onChange={(e) => setParams({ status: e.target.value || null })}><option value="">Semua status</option>{DOCUMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        <select className="field-select" aria-label="Proyek" value={sp.get('projectId') ?? ''} onChange={(e) => setParams({ projectId: e.target.value || null })}><option value="">Semua proyek</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <input className="field-input" type="date" aria-label="Tanggal dari" value={sp.get('from') ?? ''} onChange={(e) => setParams({ from: e.target.value || null })} />
        <input className="field-input" type="date" aria-label="Tanggal sampai" value={sp.get('to') ?? ''} onChange={(e) => setParams({ to: e.target.value || null })} />
      </div>

      {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} />
        : loading && !data ? <LoadingSkeleton />
        : data && data.rows.length === 0 ? <EmptyState title={hasFilters ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'} description={hasFilters ? 'Ubah atau reset filter untuk melihat dokumen lain.' : 'Buat dokumen pertama Anda.'} action={hasFilters ? <button className="secondary-button" onClick={reset}><RotateCcw /> Reset Filter</button> : can(role, 'create') ? <Link href="/documents/new" className="primary-button"><Plus /> Tambah Dokumen</Link> : undefined} />
        : data && <div className="table-scroll" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}><table><thead><tr>
            <th style={{ width: 34 }}><input type="checkbox" aria-label="Pilih semua dokumen" checked={allSelected} onChange={toggleAll} /></th>
            <SortHead col="documentNumber">Nomor Dokumen</SortHead><SortHead col="title">Judul</SortHead><SortHead col="type">Jenis</SortHead><th>Klien / Proyek</th><SortHead col="documentDate">Tanggal</SortHead><th>Pembuat</th><SortHead col="status">Status</SortHead><SortHead col="updatedAt">Terakhir Diubah</SortHead><th><span className="sr-only">Aksi</span></th></tr></thead>
          <tbody>{data.rows.map((r) => { const own = { userId, ownerId: r.createdBy }
            return <tr key={r.id}>
              <td><input type="checkbox" aria-label={`Pilih ${r.documentNumber}`} checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} /></td>
              <td><Link href={`/documents/${r.id}`} style={{ color: 'var(--blue)', fontWeight: 700, textDecoration: 'none' }}>{r.documentNumber}</Link></td>
              <td><div className="document-cell"><div className="doc-icon"><FileText /></div><div><strong>{r.title}</strong><span>{formatRupiah(r.total)}</span></div></div></td>
              <td>{typeLabel(r.type)}</td>
              <td><div className="document-cell" style={{ minWidth: 0 }}><div><strong>{r.clientName ?? '—'}</strong><span>{r.projectName ?? '—'}</span></div></div></td>
              <td>{dateFmt.format(new Date(r.documentDate))}</td><td>{r.creatorName ?? '—'}</td><td><DocumentStatusBadge status={r.status} /></td><td className="date-cell">{dateTimeFmt.format(new Date(r.updatedAt))}</td>
              <td><div className="row-actions">
                <Link className="icon-button" href={`/documents/${r.id}`} aria-label={`Lihat ${r.documentNumber}`} title="Detail"><Eye /></Link>
                {EDITABLE_STATUSES.includes(r.status) && can(role, 'edit', own) && <Link className="icon-button" href={`/documents/${r.id}/edit`} aria-label={`Edit ${r.documentNumber}`} title="Edit"><Pencil /></Link>}
                <button className="icon-button" onClick={() => exportOne(r, 'docx')} aria-label={`Export Word ${r.documentNumber}`} title="Export Word"><FileDown /></button>
                {can(role, 'create') && <button className="icon-button" onClick={() => duplicate(r)} aria-label={`Duplikat ${r.documentNumber}`} title="Duplikat"><Copy /></button>}
                {DELETABLE_STATUSES.includes(r.status) && can(role, 'delete', own) && <button className="icon-button" onClick={() => { setDelError(null); setToDelete(r) }} aria-label={`Hapus ${r.documentNumber}`} title="Hapus"><Trash2 /></button>}
              </div></td></tr> })}</tbody></table></div>}

      {data && data.total > 0 && <div className="pagination"><span>{(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} dari {data.total} dokumen</span>
        <div className="pager"><button className="secondary-button" disabled={data.page <= 1 || loading} onClick={() => setParams({ page: String(data.page - 1) }, false)}><ChevronLeft /> Sebelumnya</button><span>Hal. {data.page} / {data.pageCount}</span><button className="secondary-button" disabled={data.page >= data.pageCount || loading} onClick={() => setParams({ page: String(data.page + 1) }, false)}>Berikutnya <ChevronRight /></button></div></div>}
    </section>
    <ConfirmDialog open={!!toDelete} title="Hapus dokumen?" confirmLabel="Hapus" busy={busy} error={delError} onConfirm={confirmDelete} onCancel={() => setToDelete(null)}>
      Dokumen <strong>{toDelete?.documentNumber}</strong> — {toDelete?.title} akan dihapus dari daftar. Tindakan ini tercatat di audit log.</ConfirmDialog>
    <Toast message={toast?.m ?? null} kind={toast?.k} />
  </>
}
