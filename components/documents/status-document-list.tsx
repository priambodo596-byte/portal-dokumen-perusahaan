'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Eye, FileText, RefreshCw, RotateCcw, Search, ShieldCheck, XCircle } from 'lucide-react'
import { formatRupiah, transitionsFor, typeLabel, type TransitionAction } from '@/lib/documents/constants'
import { can, type Role } from '@/lib/permissions-client'
import { api, ConfirmDialog, DocumentStatusBadge, EmptyState, ErrorState, LoadingSkeleton, Toast } from './shared'

type Row = { id: string; documentNumber: string; title: string; type: string; status: string; documentDate: string; total: number; updatedAt: string; createdBy: string; clientName: string | null; projectName: string | null; creatorName: string | null }
type Result = { rows: Row[]; total: number; page: number; pageSize: number; pageCount: number }

const dateTimeFmt = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const APPROVER_ACTIONS: TransitionAction[] = ['review', 'approve', 'reject', 'request-revision']
const ICONS: Record<string, React.ReactNode> = { review: <ShieldCheck />, approve: <CheckCircle2 />, reject: <XCircle />, 'request-revision': <RotateCcw /> }

/** Daftar dokumen yang difilter berdasarkan sekumpulan status (persetujuan/arsip). */
export default function StatusDocumentList({ statuses, emptyTitle, emptyDescription, userId, role }: { statuses: string[]; emptyTitle: string; emptyDescription: string; userId?: string; role?: Role }) {
  const [rows, setRows] = useState<Row[] | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(''); const [debounced, setDebounced] = useState('')
  const [busy, setBusy] = useState(false); const [toast, setToast] = useState<{ m: string; k: 'ok' | 'error' } | null>(null); const [tick, setTick] = useState(0)
  const [noteAction, setNoteAction] = useState<{ action: TransitionAction; row: Row } | null>(null); const [note, setNote] = useState(''); const [noteError, setNoteError] = useState<string | null>(null)

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 350); return () => clearTimeout(t) }, [search])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t) }, [toast])

  const load = useCallback(() => {
    const ctrl = new AbortController(); setLoading(true); setError(null)
    Promise.all(statuses.map((s) => fetch(`/api/documents?status=${s}&pageSize=100&q=${encodeURIComponent(debounced)}`, { signal: ctrl.signal, cache: 'no-store' })
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error ?? 'Gagal memuat dokumen.'); return (b as Result).rows })))
      .then((groups) => {
        const all = groups.flat().sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        setRows(all); setLoading(false)
      })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ctrl.abort()
  }, [statuses, debounced])

  useEffect(() => { const c = load(); return c }, [load, tick])

  async function transition(row: Row, action: TransitionAction, withNote?: string) {
    setBusy(true); setNoteError(null)
    try {
      await api(`/api/documents/${row.id}/transition`, { method: 'POST', body: JSON.stringify({ action, note: withNote ?? undefined }) })
      setNoteAction(null); setNote(''); setToast({ m: `${row.documentNumber} diperbarui.`, k: 'ok' }); setTick((t) => t + 1)
    } catch (e) {
      const msg = (e as Error).message
      if (noteAction) setNoteError(msg); else setToast({ m: msg, k: 'error' })
    } finally { setBusy(false) }
  }

  const noteDef = noteAction ? transitionsFor(noteAction.row.status).find((t) => t.action === noteAction.action) : null

  return <section className="panel documents-panel">
    <div className="table-toolbar" style={{ marginTop: 0 }}>
      <div className="search-field"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari dokumen…" aria-label="Cari dokumen" /></div>
      <div className="toolbar-actions"><button className="secondary-button" onClick={() => setTick((t) => t + 1)} disabled={loading}><RefreshCw /> Refresh</button></div>
    </div>
    {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} />
      : loading && !rows ? <LoadingSkeleton />
      : rows && rows.length === 0 ? <EmptyState title={emptyTitle} description={emptyDescription} />
      : rows && <div className="table-scroll"><table><thead><tr><th>Nomor Dokumen</th><th>Judul</th><th>Jenis</th><th>Klien / Proyek</th><th>Status</th><th className="num">Total</th><th>Terakhir Diubah</th><th><span className="sr-only">Aksi</span></th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}>
          <td><Link href={`/documents/${r.id}`} style={{ color: 'var(--blue)', fontWeight: 700, textDecoration: 'none' }}>{r.documentNumber}</Link></td>
          <td><div className="document-cell"><div className="doc-icon"><FileText /></div><div><strong>{r.title}</strong></div></div></td>
          <td>{typeLabel(r.type)}</td>
          <td><div className="document-cell" style={{ minWidth: 0 }}><div><strong>{r.clientName ?? '—'}</strong><span>{r.projectName ?? '—'}</span></div></div></td>
          <td><DocumentStatusBadge status={r.status} /></td>
          <td className="num">{formatRupiah(r.total)}</td>
          <td className="date-cell">{dateTimeFmt.format(new Date(r.updatedAt))}</td>
          <td><div className="row-actions">
            <Link className="icon-button" href={`/documents/${r.id}`} aria-label={`Lihat ${r.documentNumber}`} title="Detail"><Eye /></Link>
            {userId && role && transitionsFor(r.status).filter((t) => APPROVER_ACTIONS.includes(t.action)).map((t) => can(role, t.permission, { userId, ownerId: r.createdBy }) && (
              <button key={t.action} className="icon-button" title={t.label} aria-label={`${t.label} ${r.documentNumber}`} disabled={busy}
                onClick={() => (t.requiresNote ? (setNote(''), setNoteError(null), setNoteAction({ action: t.action, row: r })) : transition(r, t.action))}>{ICONS[t.action]}</button>
            ))}
          </div></td></tr>)}</tbody></table></div>}

    <ConfirmDialog open={!!noteDef} title={noteDef?.label ?? ''} confirmLabel={noteDef?.label ?? 'Kirim'} busy={busy} error={noteError}
      onConfirm={() => noteAction && noteDef && transition(noteAction.row, noteDef.action, note)} onCancel={() => setNoteAction(null)}>
      Catatan untuk <strong>{noteAction?.row.documentNumber}</strong>
      <textarea className="field-input" style={{ width: '100%', marginTop: 10, minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan / alasan" aria-label="Catatan" />
    </ConfirmDialog>
    <Toast message={toast?.m ?? null} kind={toast?.k} />
  </section>
}
