'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, UserRound } from 'lucide-react'
import { api, EmptyState, ErrorState, LoadingSkeleton, Toast } from './shared'

type Row = { id: string; name: string; email: string; createdAt: string; role: string | null }
type Role = 'admin' | 'manager' | 'staff' | 'viewer'

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' }, { value: 'manager', label: 'Manager' }, { value: 'staff', label: 'Staff' }, { value: 'viewer', label: 'Viewer' },
]
const dateFmt = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

export default function UserManager({ userId, role }: { userId: string; role: string }) {
  const [rows, setRows] = useState<Row[] | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null); const [toast, setToast] = useState<{ m: string; k: 'ok' | 'error' } | null>(null)
  const isAdmin = role === 'admin'

  const load = useCallback(() => {
    setLoading(true); setError(null)
    api<Row[]>('/api/users').then((d) => { setRows(d); setLoading(false) }).catch((e) => { setError((e as Error).message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t) }, [toast])

  async function changeRole(r: Row, next: Role) {
    if (r.role === next) return
    setBusyId(r.id)
    try {
      await api(`/api/users/${r.id}`, { method: 'PATCH', body: JSON.stringify({ role: next }) })
      setRows((list) => list?.map((x) => (x.id === r.id ? { ...x, role: next } : x)) ?? null)
      setToast({ m: `Hak akses ${r.name} diubah menjadi ${ROLES.find((x) => x.value === next)?.label}.`, k: 'ok' })
    } catch (e) { setToast({ m: (e as Error).message, k: 'error' }) } finally { setBusyId(null) }
  }

  return <section className="panel documents-panel">
    <div className="table-toolbar" style={{ marginTop: 0 }}>
      <div><h2 style={{ margin: 0, fontSize: 13, color: 'var(--navy)' }}>Pengguna & Hak Akses</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 11 }}>{isAdmin ? 'Ubah hak akses pengguna.' : 'Hanya admin yang dapat mengubah hak akses.'}</p></div>
      <div className="toolbar-actions"><button className="secondary-button" onClick={load} disabled={loading}><RefreshCw /> Refresh</button></div>
    </div>

    {error ? <ErrorState message={error} onRetry={load} />
      : loading && !rows ? <LoadingSkeleton />
      : rows && rows.length === 0 ? <EmptyState title="Belum ada pengguna" description="Pengguna muncul setelah mendaftar." />
      : rows && <div className="table-scroll"><table><thead><tr><th>Nama</th><th>Email</th><th>Terdaftar</th><th>Hak Akses</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}>
          <td><div className="document-cell"><div className="doc-icon">{r.role === 'admin' ? <ShieldCheck /> : <UserRound />}</div><div><strong>{r.name}{r.id === userId && <span className="you-tag">Anda</span>}</strong></div></div></td>
          <td>{r.email}</td><td>{dateFmt.format(new Date(r.createdAt))}</td>
          <td>{isAdmin
            ? <select className="field-select" style={{ maxWidth: 160 }} aria-label={`Hak akses ${r.name}`} value={r.role ?? 'staff'} disabled={busyId === r.id} onChange={(e) => changeRole(r, e.target.value as Role)}>{ROLES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
            : <span className="status-badge status-slate"><span className="status-dot" />{ROLES.find((x) => x.value === (r.role ?? 'staff'))?.label}</span>}</td>
        </tr>)}</tbody></table></div>}
    <Toast message={toast?.m ?? null} kind={toast?.k} />
  </section>
}
