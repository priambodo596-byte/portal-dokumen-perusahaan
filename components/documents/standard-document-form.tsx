'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import type { StandardDocument } from '@/lib/templates/standard-registry'
import { api, Toast } from './shared'

type DraftResult = { id: string; documentNumber: string; missingFields: string[] }
const today = () => new Date().toISOString().slice(0, 10)
const label = (key: string) => key.replaceAll('_', ' ').replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('id-ID'))
const autoControlled = (field: StandardDocument['fields'][number]) => field.source_binding.status === 'controlled_system_value'

export default function StandardDocumentForm({ document }: { document: StandardDocument; userName: string }) {
  const router = useRouter()
  const [title, setTitle] = useState(document.name)
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [fieldQuery, setFieldQuery] = useState('')
  const [repeatValues, setRepeatValues] = useState<Record<string, string>>(
    Object.fromEntries(document.repeating_blocks.map((block) => [block, '[]'])),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const repeatingKeys = new Set(document.repeating_blocks)
  const normalFields = document.fields.filter((field) => !repeatingKeys.has(field.key) && !/^document_(number|status|title|date|version)$/.test(field.key))
  const requiredFields = normalFields.filter((field) => field.required === true && !autoControlled(field))
  const completedRequired = requiredFields.filter((field) => values[field.key]?.trim()).length
  const visibleFields = normalFields.filter((field) => `${field.key} ${field.type_hint} ${field.source_binding.source}`.toLocaleLowerCase('id-ID').includes(fieldQuery.trim().toLocaleLowerCase('id-ID')))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const data: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(values)) if (value.trim()) data[key] = value.trim()
    for (const [key, raw] of Object.entries(repeatValues)) {
      if (!raw.trim() || raw.trim() === '[]') continue
      try { data[key] = JSON.parse(raw) }
      catch { setError(`Format JSON blok ${label(key)} belum valid.`); setSaving(false); return }
    }
    try {
      const result = await api<DraftResult>('/api/v1/document-drafts', {
        method: 'POST',
        body: JSON.stringify({ template_code: document.code, title, document_date: date, notes, data }),
      })
      setToast(`Draf ${result.documentNumber} berhasil dibuat.`)
      router.push(`/documents/${result.id}`)
      router.refresh()
    } catch (exception) {
      setError((exception as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return <form onSubmit={submit}>
    <section className="panel form-section standard-draft-summary">
      <h2>Informasi dokumen</h2>
      <div className="form-grid">
        <div className="form-field span-2"><label htmlFor="standard-title">Judul draf</label><input id="standard-title" className="field-input" value={title} maxLength={180} onChange={(event) => setTitle(event.target.value)} required /></div>
        <div className="form-field"><label htmlFor="standard-date">Tanggal dokumen</label><input id="standard-date" type="date" className="field-input" value={date} onChange={(event) => setDate(event.target.value)} required /></div>
        <div className="form-field span-2"><label htmlFor="standard-notes">Catatan untuk pemeriksa</label><textarea id="standard-notes" className="field-textarea" value={notes} maxLength={5000} onChange={(event) => setNotes(event.target.value)} /></div>
      </div>
      <div className="standard-draft-policy"><ShieldCheck size={16} /><span>Disimpan sebagai draf. Persetujuan mengikuti urutan: <strong>{document.approval_chain.map(label).join(' → ')}</strong>. Agent tidak dapat menerbitkan.</span></div>
    </section>

    <section className="panel form-section"><div className="standard-form-section-heading"><div><h2>Data dokumen ({normalFields.length} field)</h2><p className="standard-form-hint">Isi berdasarkan data yang sudah diverifikasi. Field tanpa tanda wajib masih perlu dikonfigurasi oleh pemilik workflow.</p></div><span className="standard-completion">{completedRequired}/{requiredFields.length} wajib terisi</span></div>
      <label className="template-list-search standard-field-search"><Search size={16} /><input aria-label="Cari field dokumen" value={fieldQuery} onChange={(event) => setFieldQuery(event.target.value)} placeholder="Cari nama field atau sumber data…" /></label>
      <div className="form-grid standard-fields-form-grid">
        {visibleFields.map((field) => {
          const isSystem = autoControlled(field)
          const isMultiline = field.type_hint === 'text' && /text|content|description|clause|note|address|scope|summary|purpose|response|terms|details/i.test(field.key)
          const labelText = label(field.key)
          const inputType = field.type_hint === 'email' ? 'email' : field.type_hint === 'url' ? 'url' : field.type_hint === 'date' ? 'date' : 'text'
          const inputMode = /numeric|currency|scalar/.test(field.type_hint) ? 'decimal' : undefined
          return <div className={`form-field ${isMultiline ? 'span-2' : ''}`} key={field.key}>
            <label htmlFor={`field-${field.key}`}>{labelText}{field.required === true && <span className="req"> *</span>}</label>
            {isMultiline
              ? <textarea id={`field-${field.key}`} className="field-textarea" value={values[field.key] ?? ''} disabled={isSystem} required={field.required === true && !isSystem} maxLength={2000} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />
              : <input id={`field-${field.key}`} className="field-input" type={inputType} inputMode={inputMode} value={values[field.key] ?? ''} disabled={isSystem} required={field.required === true && !isSystem} maxLength={2000} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />}
            <small className="hint">{isSystem ? 'Diisi otomatis oleh portal.' : `${field.required === true ? 'Wajib diisi · ' : 'Opsional sesuai konfigurasi workflow · '}Sumber: ${field.source_binding.source.replaceAll('_', ' ')} · ${field.source_binding.status.replaceAll('_', ' ')}`}</small>
          </div>
        })}
        {visibleFields.length === 0 && <div className="state-box"><strong>Field tidak ditemukan</strong><span>Coba kata kunci lain atau kosongkan pencarian.</span></div>}
      </div>
    </section>

    {document.repeating_blocks.length > 0 && <section className="panel form-section"><h2>Data berulang</h2><p className="standard-form-hint">Masukkan setiap blok sebagai JSON array. Kunci baris memakai nama field di atas. Contoh: <code>[&#123;&quot;account_code&quot;:&quot;1101&quot;,&quot;account_name&quot;:&quot;Kas&quot;&#125;]</code></p>
      <div className="form-grid">{document.repeating_blocks.map((block) => <div className="form-field span-2" key={block}><label htmlFor={`repeat-${block}`}>{label(block)}</label><textarea id={`repeat-${block}`} className="field-textarea standard-json-field" spellCheck={false} value={repeatValues[block] ?? '[]'} onChange={(event) => setRepeatValues((current) => ({ ...current, [block]: event.target.value }))} /><small className="hint">Field yang tersedia: {normalFields.map((field) => field.key).join(', ')}</small></div>)}</div>
    </section>}

    {error && <div className="banner-error" role="alert">{error}</div>}
    <div className="form-actions"><Link href="/templates" className="secondary-button"><ArrowLeft size={15} /> Kembali</Link><button type="submit" className="primary-button" disabled={saving || title.trim().length < 3 || !date}>{saving ? 'Membuat draf…' : 'Simpan Draf'}</button></div>
    <Toast message={toast} />
  </form>
}
