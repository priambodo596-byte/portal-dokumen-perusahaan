'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Pencil, Plus, Search, Trash2, X, Variable } from 'lucide-react'
import { TOKEN_GROUPS } from '@/lib/templates/tokens'
import { api, ConfirmDialog, EmptyState, Toast } from './shared'

type CustomVariable = { id: string; token: string; label: string; group: string; description: string; sampleValue: string; createdAt: string; updatedAt: string }
type Draft = { token: string; label: string; group: string; description: string; sampleValue: string }
const emptyDraft = (): Draft => ({ token: '', label: '', group: 'Variabel Kustom', description: '', sampleValue: '' })

export default function TokenLibrary({ canManage = false }: { canManage?: boolean }) {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState('')
  const [custom, setCustom] = useState<CustomVariable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'error' } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomVariable | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const notify = useCallback((message: string, kind: 'ok' | 'error' = 'ok') => { setToast({ message, kind }); window.setTimeout(() => setToast(null), 3200) }, [])
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setCustom(await api<CustomVariable[]>('/api/template-variables')) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const builtinTokens = useMemo(() => new Set(TOKEN_GROUPS.flatMap((group) => group.tokens.map((token) => token.token))), [])
  const groups = useMemo(() => TOKEN_GROUPS.map((group) => ({
    ...group,
    tokens: group.tokens.map((token) => ({ ...token, label: custom.find((item) => item.token === token.token)?.label ?? token.label })).filter((token) => `${token.token} ${token.label}`.toLowerCase().includes(query.trim().toLowerCase())),
  })).filter((group) => group.tokens.length > 0), [query, custom])
  const customGroups = useMemo(() => {
    const filtered = custom.filter((item) => !builtinTokens.has(item.token) && `${item.token} ${item.label} ${item.group} ${item.description} ${item.sampleValue}`.toLowerCase().includes(query.trim().toLowerCase()))
    return Array.from(filtered.reduce((map, item) => map.set(item.group, [...(map.get(item.group) ?? []), item]), new Map<string, CustomVariable[]>()).entries())
  }, [custom, query])

  async function copyToken(token: string) {
    try { await navigator.clipboard.writeText(`{{${token}}}`); setCopied(token); window.setTimeout(() => setCopied((current) => current === token ? '' : current), 1600) }
    catch { notify('Tidak dapat menyalin token. Periksa izin clipboard browser.', 'error') }
  }
  function startCreate() { setEditing(null); setDraft(emptyDraft()); setFormOpen(true) }
  function startEdit(item: CustomVariable) { setEditing(item.id); setDraft({ token: item.token, label: item.label, group: item.group, description: item.description, sampleValue: item.sampleValue }); setFormOpen(true) }
  function closeForm() { if (!saving) { setFormOpen(false); setEditing(null); setDraft(emptyDraft()) } }
  async function saveVariable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true)
    const payload = { ...draft, token: draft.token.trim(), label: draft.label.trim(), group: draft.group.trim() || 'Variabel Kustom' }
    try {
      const isBuiltin = Boolean(editing && editing.startsWith('builtin:'))
      const saved = await api<CustomVariable>(
        isBuiltin ? '/api/template-variables/builtin' : editing ? `/api/template-variables/${editing}` : '/api/template-variables',
        { method: isBuiltin || !editing ? 'POST' : 'PATCH', body: JSON.stringify(payload) },
      )
      setCustom((list) => editing ? (isBuiltin ? [...list.filter((item) => item.token !== saved.token), saved] : list.map((item) => item.id === saved.id ? saved : item)) : [...list, saved].sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label)))
      notify(editing ? 'Placeholder berhasil diperbarui.' : 'Placeholder baru berhasil ditambahkan.')
      setFormOpen(false); setEditing(null); setDraft(emptyDraft())
    } catch (e) { notify((e as Error).message || 'Placeholder gagal disimpan.', 'error') }
    finally { setSaving(false) }
  }
  async function deleteVariable() {
    if (!deleteTarget) return
    setDeleteBusy(true); setDeleteError(null)
    try { await api(`/api/template-variables/${deleteTarget.id}`, { method: 'DELETE' }); setCustom((list) => list.filter((item) => item.id !== deleteTarget.id)); setDeleteTarget(null); notify('Placeholder berhasil dihapus.') }
    catch (e) { setDeleteError((e as Error).message) }
    finally { setDeleteBusy(false) }
  }

  const inputStyle: React.CSSProperties = { width: '100%', minWidth: 0, border: '1px solid var(--line)', borderRadius: 8, padding: '10px 11px', color: 'var(--navy)', background: '#fff', fontSize: 12, outlineColor: 'var(--blue)' }
  const cardStyle: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 10, padding: 14, minWidth: 0, background: '#fff' }
  return <div className="token-library">
    <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
      <div className="panel-heading" style={{ alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div><h2>Pustaka variabel dokumen</h2><p>Salin placeholder bawaan atau kelola placeholder kustom untuk referensi template.</p></div>
        {canManage && <button type="button" className="primary-button" onClick={startCreate}><Plus size={15} /> Tambah placeholder</button>}
      </div>
      <div className="search-field" style={{ maxWidth: 620, marginTop: 18 }}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, grup, deskripsi, atau token..." aria-label="Cari placeholder" /></div>
      <p style={{ marginTop: 12, color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>Format placeholder menggunakan kurung kurawal ganda, misalnya <code>{'{{Nama_Token}}'}</code>. Klik Salin token untuk menyalinnya. Placeholder bawaan bersifat referensi sistem; admin dapat membuat, mengubah, dan menghapus placeholder kustom.</p>
      {error && <div className="banner-error" role="alert" style={{ marginTop: 12 }}>{error} <button className="secondary-button" type="button" onClick={() => void load()}>Coba lagi</button></div>}
    </div>

    {groups.map((group) => <section className="panel" key={group.label} style={{ padding: 20, marginBottom: 16 }}>
      <div className="panel-heading" style={{ marginBottom: 14 }}><div><h2>{group.label}</h2><p>{group.tokens.length} placeholder bawaan</p></div><span className="status-badge status-slate">Bawaan</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 12 }}>
        {group.tokens.map((token) => <div key={token.token} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 650, fontSize: 13, marginBottom: 8, color: 'var(--navy)' }}>{token.label}</div><code style={{ display: 'inline-block', maxWidth: '100%', overflowWrap: 'anywhere', fontSize: 12, color: 'var(--blue)', background: '#f1f5ff', borderRadius: 5, padding: '5px 7px' }}>{`{{${token.token}}}`}</code></div><button type="button" className="icon-button" title="Salin token" aria-label={`Salin ${token.token}`} onClick={() => void copyToken(token.token)}>{copied === token.token ? <Check size={15} /> : <Copy size={15} />}</button></div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}><button className="secondary-button" type="button" onClick={() => void copyToken(token.token)}>{copied === token.token ? <Check size={14} /> : <Copy size={14} />}{copied === token.token ? 'Tersalin' : 'Salin token'}</button>{canManage && <button className="secondary-button" type="button" onClick={() => { setEditing(`builtin:${token.token}`); setDraft({ token: token.token, label: token.label, group: group.label, description: 'Placeholder bawaan sistem', sampleValue: '' }); setFormOpen(true) }}><Pencil size={14} /> Edit label</button>}</div>
        </div>)}
      </div>
    </section>)}

    {(customGroups.length > 0 || loading || (!groups.length && !loading)) && <section className="panel" style={{ padding: 20, marginBottom: 16 }}>
      <div className="panel-heading" style={{ marginBottom: 14 }}><div><h2>Placeholder kustom</h2><p>{custom.length} placeholder yang dikelola admin</p></div><Variable size={19} color="var(--blue)" /></div>
      {loading ? <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Memuat placeholder...</div> : customGroups.length ? customGroups.map(([group, items]) => <div key={group} style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 750, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>{group}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 12 }}>
          {items.map((item) => <div key={item.id} style={cardStyle}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 650, fontSize: 13, color: 'var(--navy)', marginBottom: 7 }}>{item.label}</div><code style={{ display: 'inline-block', maxWidth: '100%', overflowWrap: 'anywhere', color: 'var(--blue)', background: '#f1f5ff', padding: '5px 7px', borderRadius: 5, fontSize: 12 }}>{`{{${item.token}}}`}</code></div><button type="button" className="icon-button" title="Salin token" aria-label={`Salin ${item.token}`} onClick={() => void copyToken(item.token)}>{copied === item.token ? <Check size={15} /> : <Copy size={15} />}</button></div>
            {item.description && <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--muted)', margin: '10px 0 0' }}>{item.description}</p>}
            {item.sampleValue && <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>Contoh nilai: <strong style={{ color: 'var(--navy)', fontWeight: 600 }}>{item.sampleValue}</strong></div>}
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}><button className="secondary-button" type="button" onClick={() => void copyToken(item.token)}>{copied === item.token ? <Check size={14} /> : <Copy size={14} />}{copied === item.token ? 'Tersalin' : 'Salin token'}</button>{canManage && <><button className="secondary-button" type="button" onClick={() => startEdit(item)}><Pencil size={14} /> Edit</button><button className="icon-button" type="button" title="Hapus placeholder" aria-label={`Hapus ${item.label}`} onClick={() => { setDeleteError(null); setDeleteTarget(item) }}><Trash2 size={15} /></button></>}</div>
          </div>)}
        </div>
      </div>) : <EmptyState title={query ? 'Tidak ada placeholder kustom yang cocok' : 'Belum ada placeholder kustom'} description={canManage ? 'Tambahkan placeholder untuk mengelompokkan referensi yang dibutuhkan tim.' : 'Placeholder kustom akan muncul di sini setelah dibuat oleh admin.'} action={canManage && !query ? <button className="primary-button" type="button" onClick={startCreate}><Plus size={15} /> Tambah placeholder</button> : undefined} />}
    </section>}

    {canManage && formOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><div className="create-modal" role="dialog" aria-modal="true" aria-label={editing ? 'Edit placeholder' : 'Tambah placeholder'} style={{ width: 'min(560px, 100%)' }}>
      <div className="modal-heading"><div><h2>{editing ? 'Edit placeholder' : 'Tambah placeholder'}</h2><p>Atur nama token, label, kelompok, dan contoh nilainya.</p></div><button className="icon-button" type="button" aria-label="Tutup" onClick={closeForm} disabled={saving}><X size={18} /></button></div>
      <form onSubmit={(event) => void saveVariable(event)} style={{ display: 'grid', gap: 14 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 650 }}>Nama token <input style={inputStyle} required minLength={2} maxLength={80} pattern="[A-Za-z][A-Za-z0-9_.-]*" value={draft.token} disabled={Boolean(editing?.startsWith('builtin:'))} onChange={(e) => setDraft((d) => ({ ...d, token: e.target.value.replace(/\s/g, '') }))} placeholder="contoh: Nomor_Surat" /><span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>Format yang digunakan di template: {'{{Nama_Token}}'}. Awali dengan huruf.</span></label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 650 }}>Label yang ditampilkan <input style={inputStyle} required minLength={2} maxLength={120} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Contoh: Nomor surat" /></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 650 }}>Kelompok <input style={inputStyle} required maxLength={80} value={draft.group} onChange={(e) => setDraft((d) => ({ ...d, group: e.target.value }))} placeholder="Informasi Surat" /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 650 }}>Contoh nilai <input style={inputStyle} maxLength={500} value={draft.sampleValue} onChange={(e) => setDraft((d) => ({ ...d, sampleValue: e.target.value }))} placeholder="Contoh: 001/PLS/X/2026" /></label>
        </div>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 650 }}>Deskripsi <textarea style={{ ...inputStyle, minHeight: 76, resize: 'vertical' }} maxLength={300} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Jelaskan kegunaan placeholder ini..." /></label>
        <div style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}><div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 6 }}>Pratinjau format</div><code style={{ color: 'var(--blue)', overflowWrap: 'anywhere' }}>{`{{${draft.token || 'Nama_Token'}}}`}</code></div>
        <div className="modal-footer" style={{ gap: 8, marginTop: 2 }}><button type="button" className="secondary-button" onClick={closeForm} disabled={saving}>Batal</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Tambah placeholder'}</button></div>
      </form>
    </div></div>}

    <ConfirmDialog open={!!deleteTarget} title="Hapus placeholder?" confirmLabel="Hapus" busy={deleteBusy} error={deleteError} onConfirm={() => void deleteVariable()} onCancel={() => setDeleteTarget(null)}>Placeholder <strong>{deleteTarget?.label}</strong> ({`{{${deleteTarget?.token ?? ''}}}`}) akan dihapus dari pustaka kustom.</ConfirmDialog>
    <Toast message={toast?.message ?? (copied ? 'Token berhasil disalin.' : null)} kind={toast?.kind} />
  </div>
}
