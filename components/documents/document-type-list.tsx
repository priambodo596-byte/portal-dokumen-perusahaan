'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Copy, Eye, FileText, Pencil, Plus, RefreshCw, RotateCcw, Search, Trash2 } from 'lucide-react'
import { DELETABLE_STATUSES, DOCUMENT_STATUSES, EDITABLE_STATUSES, formatRupiah } from '@/lib/documents/constants'
import { can, type Role } from '@/lib/permissions-client'
import { api, ConfirmDialog, DocumentStatusBadge, EmptyState, ErrorState, LoadingSkeleton, Toast } from './shared'

type Row = { id: string; documentNumber: string; title: string; type: string; status: string; documentDate: string; total: number; updatedAt: string; createdBy: string; clientName: string | null; projectName: string | null; creatorName: string | null }
type Result = { rows: Row[]; total: number; page: number; pageSize: number; pageCount: number }

const dateFmt = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

/** Halaman daftar dokumen yang dikunci pada satu jenis. Khas per jenis dokumen. */
export default function DocumentTypeList({ type, title, description, userId, role }: { type: string; title: string; description: string; userId: string; role: Role }) {
  const router = useRouter()
  const [data, setData] = useState<Result | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true)
  const [all, setAll] = useState<Row[] | null>(null)
  const [status, setStatus] = useState(''); const [search, setSearch] = useState(''); const [debounced, setDebounced] = useState(''); const [page, setPage] = useState(1)
  const [toast, setToast] = useState<{ m: string; k: 'ok' | 'error' } | null>(null)
  const [toDelete, setToDelete] = useState<Row | null>(null); const [busy, setBusy] = useState(false); const [delError, setDelError] = useState<string | null>(null)

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1) }, 350); return () => clearTimeout(t) }, [search])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t) }, [toast])

  const load = useCallback(() => {
    const ctrl = new AbortController(); setLoading(true); setError(null)
    const params = new URLSearchParams({ type, page: String(page), pageSize: '10' })
    if (status) params.set('status', status)
    if (debounced) params.set('q', debounced)
    fetch(`/api/documents?${params}`, { signal: ctrl.signal, cache: 'no-store' })
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error ?? 'Gagal memuat dokumen.'); return b as Result })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ctrl.abort()
  }, [type, status, debounced, page])

  // Ringkasan angka khusus jenis ini (tanpa filter, seluruh dokumen jenis tsb).
  const loadSummary = useCallback(() => {
    fetch(`/api/documents?type=${type}&pageSize=100`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((d: Result | null) => d && setAll(d.rows)).catch(() => {})
  }, [type])

  useEffect(() => { const c = load(); return c }, [load])
  useEffect(() => { loadSummary() }, [loadSummary])

  const summary = useMemo(() => {
    if (!all) return null
    const totalValue = all.reduce((s, r) => s + r.total, 0)
    const counts = all.reduce<Record<string, number>>((m, r) => { m[r.status] = (m[r.status] ?? 0) + 1; return m }, {})
    return { count: all.length, totalValue, counts }
  }, [all])

  const hasFilters = !!status || !!debounced
  const reset = () => { setSearch(''); setStatus(''); setPage(1) }
  const refresh = () => { loadSummary(); load() }

  async function duplicate(r: Row) {
    try { const res = await api<{ id: string }>(`/api/documents/${r.id}/duplicate`, { method: 'POST' }); router.push(`/documents/${res.id}/edit`) }
    catch (e) { setToast({ m: (e as Error).message, k: 'error' }) }
  }
  async function confirmDelete() {
    if (!toDelete) return; setBusy(true); setDelError(null)
    try { await api(`/api/documents/${toDelete.id}`, { method: 'DELETE' }); setToast({ m: `Dokumen ${toDelete.documentNumber} dihapus.`, k: 'ok' }); setToDelete(null); refresh() }
    catch (e) { setDelError((e as Error).message) } finally { setBusy(false) }
  }

  return <>
    <section className="page-heading"><div className="eyebrow"><span className="eyebrow-dot" /> Dokumen / {title}</div>
      <div className="heading-row"><div><h1>{title}</h1><p>{description}</p></div>
        {can(role, 'create') && <Link href={`/documents/new?type=${type}`} className="primary-button"><Plus /> Tambah Dokumen</Link>}</div>
    </section>

    <section className="stat-grid cols-3" style={{ marginBottom: 18 }}>
      <article className="stat-card"><div className="stat-top"><span>Total Dokumen</span><div className="stat-icon"><FileText /></div></div><strong>{summary ? summary.count : '—'}</strong><div className="stat-foot">jenis {title}</div></article>
      <article className="stat-card"><div className="stat-top"><span>Nilai Total</span><div className="stat-icon"><FileText /></div></div><strong>{summary ? formatRupiah(summary.totalValue) : '—'}</strong><div className="stat-foot">akumulasi semua status</div></article>
      <article className="stat-card"><div className="stat-top"><span>Menunggu Persetujuan</span><div className="stat-icon"><FileText /></div></div><strong>{summary ? (summary.counts['pending'] ?? 0) + (summary.counts['review'] ?? 0) : '—'}</strong><div className="stat-foot">status pending &amp; review</div></article>
    </section>

    <section className="panel documents-panel">
      <div className="table-toolbar" style={{ marginTop: 0 }}>
        <div className="search-field"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor, judul, klien, atau proyek…" aria-label="Cari dokumen" /></div>
        <div className="toolbar-actions">
          <select className="field-select" style={{ maxWidth: 190 }} aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="">Semua status</option>{DOCUMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          <button className="secondary-button" onClick={reset} disabled={!hasFilters}><RotateCcw /> Reset</button>
          <button className="secondary-button" onClick={refresh} disabled={loading}><RefreshCw /> Refresh</button>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={refresh} />
        : loading && !data ? <LoadingSkeleton />
        : data && data.rows.length === 0 ? <EmptyState title={hasFilters ? 'Tidak ada dokumen yang cocok' : `Belum ada dokumen ${title}`} description={hasFilters ? 'Ubah atau reset filter.' : 'Buat dokumen pertama untuk jenis ini.'} action={hasFilters ? <button className="secondary-button" onClick={reset}><RotateCcw /> Reset</button> : can(role, 'create') ? <Link href={`/documents/new?type=${type}`} className="primary-button"><Plus /> Tambah Dokumen</Link> : undefined} />
        : data && <div className="table-scroll" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}><table><thead><tr><th>Nomor Dokumen</th><th>Judul</th><th>Klien / Proyek</th><th>Tanggal</th><th>Pembuat</th><th>Status</th><th className="num">Total</th><th><span className="sr-only">Aksi</span></th></tr></thead>
          <tbody>{data.rows.map((r) => { const own = { userId, ownerId: r.createdBy }
            return <tr key={r.id}>
              <td><Link href={`/documents/${r.id}`} style={{ color: 'var(--blue)', fontWeight: 700, textDecoration: 'none' }}>{r.documentNumber}</Link></td>
              <td><div className="document-cell"><div className="doc-icon"><FileText /></div><div><strong>{r.title}</strong></div></div></td>
              <td><div className="document-cell" style={{ minWidth: 0 }}><div><strong>{r.clientName ?? '—'}</strong><span>{r.projectName ?? '—'}</span></div></div></td>
              <td>{dateFmt.format(new Date(r.documentDate))}</td><td>{r.creatorName ?? '—'}</td><td><DocumentStatusBadge status={r.status} /></td>
              <td className="num">{formatRupiah(r.total)}</td>
              <td><div className="row-actions">
                <Link className="icon-button" href={`/documents/${r.id}`} aria-label={`Lihat ${r.documentNumber}`} title="Detail"><Eye /></Link>
                {EDITABLE_STATUSES.includes(r.status) && can(role, 'edit', own) && <Link className="icon-button" href={`/documents/${r.id}/edit`} aria-label={`Edit ${r.documentNumber}`} title="Edit"><Pencil /></Link>}
                {can(role, 'create') && <button className="icon-button" onClick={() => duplicate(r)} aria-label={`Duplikat ${r.documentNumber}`} title="Duplikat"><Copy /></button>}
                {DELETABLE_STATUSES.includes(r.status) && can(role, 'delete', own) && <button className="icon-button" onClick={() => { setDelError(null); setToDelete(r) }} aria-label={`Hapus ${r.documentNumber}`} title="Hapus"><Trash2 /></button>}
              </div></td></tr> })}</tbody></table></div>}

      {data && data.total > 0 && <div className="pagination"><span>{(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} dari {data.total} dokumen</span>
        <div className="pager"><button className="secondary-button" disabled={data.page <= 1 || loading} onClick={() => setPage((p) => p - 1)}><ChevronLeft /> Sebelumnya</button><span>Hal. {data.page} / {data.pageCount}</span><button className="secondary-button" disabled={data.page >= data.pageCount || loading} onClick={() => setPage((p) => p + 1)}>Berikutnya <ChevronRight /></button></div></div>}
    </section>

    <ConfirmDialog open={!!toDelete} title="Hapus dokumen?" confirmLabel="Hapus" busy={busy} error={delError} onConfirm={confirmDelete} onCancel={() => setToDelete(null)}>
      Dokumen <strong>{toDelete?.documentNumber}</strong> — {toDelete?.title} akan dihapus dari daftar. Tindakan ini tercatat di audit log.</ConfirmDialog>
    <Toast message={toast?.m ?? null} kind={toast?.k} />
  </>
}
