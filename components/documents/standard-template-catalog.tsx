'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FileUp, Search, ShieldCheck } from 'lucide-react'
import { sourceRequiresConfirmation, type StandardDocument } from '@/lib/templates/standard-registry'
import { postForm } from './shared'

const humanize = (value: string) => value.replace(/^\d+_/, '').replaceAll('_', ' ')
const titleCase = (value: string) => humanize(value).replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('id-ID'))
const bindingLabel = (value: string) => ({
  unmapped_requires_owner_decision: 'Belum dipetakan',
  suggestion_requires_owner_confirmation: 'Perlu konfirmasi sumber',
  confirm_signer_for_workflow: 'Konfirmasi penandatangan',
  needs_company_owner_confirmation: 'Konfirmasi pemilik perusahaan',
  needs_identity_mapping: 'Pemetaan identitas diperlukan',
  existing_profile_mapping: 'Periksa pemetaan profil',
  controlled_system_value: 'Dikelola sistem',
}[value] ?? titleCase(value))

export default function StandardTemplateCatalog({ documents, canManage = false, initialUploadedCodes = {} }: { documents: StandardDocument[]; canManage?: boolean; initialUploadedCodes?: Record<string, { sha256: string; size: number; updatedAt: Date | string }> }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [uploadedCodes, setUploadedCodes] = useState(initialUploadedCodes)
  const [uploadState, setUploadState] = useState('')
  const [uploading, setUploading] = useState(false)
  const categories = useMemo(() => [...new Set(documents.map((document) => document.category))], [documents])
  const visible = useMemo(() => documents.filter((document) => {
    const matchesCategory = !category || document.category === category
    const text = `${document.code} ${document.name} ${document.category} ${document.agent_role}`.toLocaleLowerCase('id-ID')
    return matchesCategory && text.includes(query.trim().toLocaleLowerCase('id-ID'))
  }), [documents, category, query])
  const totalFields = documents.reduce((sum, document) => sum + document.fields.length, 0)
  const needsMapping = documents.reduce((sum, document) => sum + document.fields.filter(sourceRequiresConfirmation).length, 0)

  async function uploadMasters(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setUploadState(`Mengunggah 0 dari ${files.length} file…`)
    const uploaded: typeof uploadedCodes = { ...uploadedCodes }
    const failures: string[] = []
    let completed = 0
    for (const file of Array.from(files)) {
      const doc = documents.find((item) => item.file.split('/').at(-1)?.toLocaleLowerCase('id-ID') === file.name.toLocaleLowerCase('id-ID'))
      if (!doc) failures.push(`${file.name}: nama tidak cocok dengan registri`)
      else {
        try {
          const form = new FormData()
          form.append('file', file)
          const saved = await postForm<{ sha256: string; size: number; updatedAt: string }>(`/api/v1/templates/${encodeURIComponent(doc.code)}/source`, form)
          uploaded[doc.code] = saved
        } catch (error) { failures.push(`${file.name}: ${(error as Error).message}`) }
      }
      completed += 1
      setUploadState(`Mengunggah ${completed} dari ${files.length} file…`)
    }
    setUploadedCodes(uploaded)
    setUploading(false)
    setUploadState(failures.length ? `${files.length - failures.length} file berhasil; ${failures.length} gagal. ${failures.slice(0, 2).join(' · ')}` : `${files.length} master DOCX tersimpan privat.`)
  }

  return <div className="standard-catalog">
    <div className="stat-grid cols-3 standard-catalog-stats">
      <article className="stat-card"><span>Dokumen terdaftar</span><strong>{documents.length}</strong><small>{categories.length} kelompok dokumen</small></article>
      <article className="stat-card"><span>Field di dalam skema</span><strong>{totalFields.toLocaleString('id-ID')}</strong><small>Termasuk blok berulang bila tersedia</small></article>
      <article className="stat-card"><span>Perlu pemetaan sumber</span><strong>{needsMapping.toLocaleString('id-ID')}</strong><small>Agent wajib meminta konfirmasi, bukan menebak</small></article>
    </div>

    <section className="panel standard-catalog-panel">
      <div className="panel-heading standard-catalog-heading">
        <div><h2>Daftar standar PT.Palos</h2><p>Gunakan kode dokumen untuk memilih format dan mengambil skema isian melalui API internal.</p></div>
        <div className="standard-heading-actions">
          <span className="standard-policy"><ShieldCheck size={15} /> Persetujuan manusia wajib</span>
          {canManage && <label className={`secondary-button standard-upload-button ${uploading ? 'disabled' : ''}`}><FileUp size={14} />{uploading ? 'Mengunggah…' : 'Unggah master DOCX'}<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple disabled={uploading} hidden onChange={(event) => { void uploadMasters(event.currentTarget.files); event.currentTarget.value = '' }} /></label>}
        </div>
      </div>
      {uploadState && <p className="standard-upload-status" role="status">{uploadState}</p>}
      <div className="standard-filters">
        <label className="template-list-search"><Search size={16} /><input aria-label="Cari dokumen standar" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kode, nama, kategori, atau peran agent…" /></label>
        <select className="field-select" aria-label="Filter kategori" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Semua kategori ({documents.length})</option>
          {categories.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
        </select>
        <span className="template-count">{visible.length} dokumen</span>
      </div>
      <div className="standard-document-list">
        {visible.map((document) => {
          const needsConfirmation = document.fields.filter(sourceRequiresConfirmation).length
          const systemFields = document.fields.length - needsConfirmation
          const sourceUploaded = !!uploadedCodes[document.code]
          return <details className="standard-document" key={document.code}>
            <summary>
              <span className="standard-code">{document.code}</span>
              <span className="standard-document-title"><strong>{document.name}</strong><small>{titleCase(document.category)}</small></span>
              <span className="standard-document-meta"><span>{document.fields.length} field</span><span>{titleCase(document.classification)}</span><span>{sourceUploaded ? 'Master DOCX tersedia' : 'Master DOCX belum diunggah'}</span></span>
            </summary>
            <div className="standard-document-detail">
              <div className="standard-detail-grid">
                <div><small>Peran agent</small><strong>{titleCase(document.agent_role)}</strong></div>
                <div><small>Rantai persetujuan</small><strong>{document.approval_chain.map(titleCase).join(' → ')}</strong></div>
                <div><small>Tinjauan legal</small><strong>{document.legal_review_required ? 'Wajib' : 'Sesuai alur dokumen'}</strong></div>
                <div><small>Status pemetaan sumber</small><strong>{systemFields} dikelola sistem · {needsConfirmation} perlu konfirmasi</strong></div>
                <div><small>Master template</small><strong>{sourceUploaded ? `Tersimpan privat · SHA ${uploadedCodes[document.code].sha256.slice(0, 12)}` : 'Belum diunggah'}</strong></div>
                <div><small>Terbit otomatis oleh agent</small><strong>Tidak diizinkan</strong></div>
              </div>
              {(document.repeating_blocks.length > 0 || document.conditional_blocks.length > 0) && <div className="standard-blocks">
                {document.repeating_blocks.map((block) => <span key={`repeat-${block}`}>Blok berulang: {titleCase(block)}</span>)}
                {document.conditional_blocks.map((block) => <span key={`conditional-${block}`}>Blok kondisional: {titleCase(block)}</span>)}
              </div>}
              <div className="standard-fields-wrap">
                <h3>Field input ({document.fields.length})</h3>
                <div className="standard-fields">
                  {document.fields.map((field) => <div className="standard-field" key={field.key}>
                    <code>{`{{${field.key}}}`}</code>
                    <span>{titleCase(field.type_hint)} · {bindingLabel(field.source_binding.status)}</span>
                    <small>Sumber: {field.source_binding.source.replaceAll('_', ' ')}</small>
                  </div>)}
                </div>
              </div>
              <p className="standard-note">Field wajib dikonfigurasi per alur kerja. Nilai yang belum terpetakan atau masih berupa saran harus dikonfirmasi oleh pemilik proses sebelum draf dibuat.</p>
              <div className="standard-document-actions">{sourceUploaded ? <Link href={`/documents/standard/new?code=${encodeURIComponent(document.code)}`} className="primary-button">Buat draf {document.code}</Link> : <span className="standard-source-pending">Admin perlu mengunggah master DOCX yang cocok untuk mengaktifkan pembuatan draf.</span>}</div>
            </div>
          </details>
        })}
        {visible.length === 0 && <div className="state-box"><strong>Tidak ada dokumen yang cocok</strong><span>Ubah pencarian atau pilih kategori lain.</span></div>}
      </div>
    </section>
  </div>
}
