'use client'

import { useCallback, useEffect, useState } from 'react'
import { FolderKanban, Plus, RefreshCw } from 'lucide-react'
import { formatRupiah } from '@/lib/documents/constants'
import { can, type Role } from '@/lib/permissions-client'
import { api, EmptyState, ErrorState, LoadingSkeleton, Toast } from './shared'

type Row = { id: string; code: string | null; name: string; clientId: string | null; createdAt: string; clientName: string | null; documentCount: number; totalValue: number }
type Client = { id: string; name: string }

export default function ProjectList({ role }: { role: Role }) {
  const [rows, setRows] = useState<Row[] | null>(null); const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ m: string; k: 'ok' | 'error' } | null>(null)
  const [form, setForm] = useState<{ name: string; code: string; clientId: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    api<Row[]>('/api/projects/stats').then((d) => { setRows(d); setLoading(false) }).catch((e) => { setError((e as Error).message); setLoading(false) })
  }, [])

  useEffect(() => { load(); api<Client[]>('/api/clients').then(setClients).catch(() => {}) }, [load])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t) }, [toast])

  async function save() {
    if (!form || form.name.trim().length < 2) return
    setSaving(true)
    try {
      await api('/api/projects', { method: 'POST', body: JSON.stringify({ name: form.name.trim(), code: form.code.trim() || null, clientId: form.clientId || null }) })
      setToast({ m: 'Proyek ditambahkan.', k: 'ok' }); setForm(null); load()
    } catch (e) { setToast({ m: (e as Error).message, k: 'error' }) } finally { setSaving(false) }
  }

  return <>
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> Workspace / Proyek</div><h1>Proyek</h1><p>Kelola proyek dan lihat nilai dokumen terkait.</p></div>
      {can(role, 'create') && <button className="primary-button" onClick={() => setForm({ name: '', code: '', clientId: '' })}><Plus /> Tambah Proyek</button>}</section>

    {form && <section className="panel form-section"><h2>Proyek baru</h2><div className="form-grid">
      <div className="form-field"><label htmlFor="p-name">Nama proyek<span className="req">*</span></label><input id="p-name" className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} /></div>
      <div className="form-field"><label htmlFor="p-code">Kode</label><input id="p-code" className="field-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={40} /></div>
      <div className="form-field"><label htmlFor="p-client">Klien</label><select id="p-client" className="field-select" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}><option value="">— Tanpa klien —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    </div><div className="form-actions"><button className="secondary-button" onClick={() => setForm(null)}>Batal</button><button className="primary-button" disabled={saving || form.name.trim().length < 2} onClick={save}>{saving ? 'Menyimpan…' : 'Simpan Proyek'}</button></div></section>}

    <section className="panel documents-panel">
      <div className="table-toolbar" style={{ marginTop: 0 }}><div /><div className="toolbar-actions"><button className="secondary-button" onClick={load} disabled={loading}><RefreshCw /> Refresh</button></div></div>
      {error ? <ErrorState message={error} onRetry={load} />
        : loading && !rows ? <LoadingSkeleton />
        : rows && rows.length === 0 ? <EmptyState title="Belum ada proyek" description="Tambahkan proyek untuk mengelompokkan dokumen." />
        : rows && <div className="table-scroll"><table><thead><tr><th>Nama Proyek</th><th>Kode</th><th>Klien</th><th className="num">Jumlah Dokumen</th><th className="num">Nilai Dokumen</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}>
            <td><div className="document-cell"><div className="doc-icon"><FolderKanban /></div><div><strong>{r.name}</strong></div></div></td>
            <td>{r.code ?? '—'}</td><td>{r.clientName ?? '—'}</td>
            <td className="num">{r.documentCount}</td><td className="num">{formatRupiah(Number(r.totalValue))}</td></tr>)}</tbody></table></div>}
    </section>
    <Toast message={toast?.m ?? null} kind={toast?.k} />
  </>
}
