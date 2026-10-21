'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Plus, RefreshCw } from 'lucide-react'
import { can, type Role } from '@/lib/permissions-client'
import { api, EmptyState, ErrorState, LoadingSkeleton, Toast } from './shared'

type Client = { id: string; name: string; address: string | null; contactPerson: string | null; email: string | null; phone: string | null; createdAt: string }

const emptyForm = { name: '', address: '', contactPerson: '', email: '', phone: '' }

export default function ClientManager({ role }: { role: Role }) {
  const [rows, setRows] = useState<Client[] | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ m: string; k: 'ok' | 'error' } | null>(null)
  const [form, setForm] = useState<typeof emptyForm | null>(null); const [saving, setSaving] = useState(false); const [fieldErr, setFieldErr] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    api<Client[]>('/api/clients').then((d) => { setRows(d); setLoading(false) }).catch((e) => { setError((e as Error).message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t) }, [toast])

  async function save() {
    if (!form || form.name.trim().length < 2) return
    setSaving(true); setFieldErr(null)
    try {
      await api('/api/clients', { method: 'POST', body: JSON.stringify({ ...form, name: form.name.trim(), address: form.address || null, contactPerson: form.contactPerson || null, email: form.email || null, phone: form.phone || null }) })
      setToast({ m: 'Klien ditambahkan.', k: 'ok' }); setForm(null); load()
    } catch (e) { const ex = e as Error & { details?: Record<string, string> }; setFieldErr(ex.details?.name ?? ex.message) } finally { setSaving(false) }
  }

  return <section className="panel documents-panel">
    <div className="table-toolbar" style={{ marginTop: 0 }}>
      <div><h2 style={{ margin: 0, fontSize: 13, color: 'var(--navy)' }}>Klien</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 11 }}>Data referensi klien yang dipakai dokumen.</p></div>
      <div className="toolbar-actions">
        <button className="secondary-button" onClick={load} disabled={loading}><RefreshCw /> Refresh</button>
        {can(role, 'create') && <button className="primary-button" onClick={() => setForm({ ...emptyForm })}><Plus /> Tambah Klien</button>}
      </div>
    </div>

    {form && <div className="inline-form">
      <div className="form-grid">
        <div className="form-field"><label htmlFor="c-name">Nama klien<span className="req">*</span></label><input id="c-name" className={`field-input ${fieldErr ? 'field-invalid' : ''}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} />{fieldErr && <div className="field-error" role="alert">{fieldErr}</div>}</div>
        <div className="form-field"><label htmlFor="c-contact">Narahubung</label><input id="c-contact" className="field-input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} maxLength={150} /></div>
        <div className="form-field"><label htmlFor="c-email">Email</label><input id="c-email" className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="form-field"><label htmlFor="c-phone">Telepon</label><input id="c-phone" className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} /></div>
        <div className="form-field span-2"><label htmlFor="c-address">Alamat</label><input id="c-address" className="field-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={500} /></div>
      </div>
      <div className="form-actions"><button className="secondary-button" onClick={() => setForm(null)}>Batal</button><button className="primary-button" disabled={saving || form.name.trim().length < 2} onClick={save}>{saving ? 'Menyimpan…' : 'Simpan Klien'}</button></div>
    </div>}

    {error ? <ErrorState message={error} onRetry={load} />
      : loading && !rows ? <LoadingSkeleton />
      : rows && rows.length === 0 ? <EmptyState title="Belum ada klien" description="Tambahkan klien untuk dipakai pada dokumen." />
      : rows && <div className="table-scroll"><table><thead><tr><th>Nama</th><th>Narahubung</th><th>Email</th><th>Telepon</th><th>Alamat</th></tr></thead>
        <tbody>{rows.map((c) => <tr key={c.id}>
          <td><div className="document-cell"><div className="doc-icon"><Building2 /></div><div><strong>{c.name}</strong></div></div></td>
          <td>{c.contactPerson ?? '—'}</td><td>{c.email ?? '—'}</td><td>{c.phone ?? '—'}</td><td>{c.address ?? '—'}</td></tr>)}</tbody></table></div>}
    <Toast message={toast?.m ?? null} kind={toast?.k} />
  </section>
}
