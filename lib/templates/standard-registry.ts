import registryJson from './standard-registry.json'

export type StandardField = {
  key: string
  type_hint: string
  required: boolean | null
  requiredness: string
  source_binding: { source: string; status: string; confidence: string }
  sensitivity_hint: string
}

export type StandardDocument = {
  code: string
  name: string
  category: string
  file: string
  output_formats: string[]
  agent_role: string
  classification: string
  fields: StandardField[]
  repeating_blocks: string[]
  conditional_blocks: string[]
  legal_review_required: boolean
  has_expiry: boolean
  human_approval_required: boolean
  approval_chain: string[]
  agent_may_publish: boolean
  source_template_is_read_only: boolean
}

export type StandardRegistry = {
  schema_version: number
  status: string
  placeholder_format: string
  document_count: number
  default_controls: Record<string, unknown>
  roles: string[]
  approval_rules: Record<string, string>
  documents: StandardDocument[]
}

export const standardRegistry = registryJson as StandardRegistry

export function findStandardDocument(code: string) {
  return standardRegistry.documents.find((document) => document.code.toLowerCase() === code.toLowerCase())
}

/** Portal belum memiliki role fungsional (legal, HR, finance); batasi metadata non-internal ke admin/manager. */
export function standardDocumentIsVisible(document: StandardDocument, role: string) {
  return document.classification === 'internal' || role === 'admin' || role === 'manager'
}

export function standardCodeIsVisible(code: string, role: string) {
  const document = findStandardDocument(code)
  return !!document && standardDocumentIsVisible(document, role)
}

export function sourceRequiresConfirmation(field: StandardField) {
  return field.source_binding.status !== 'controlled_system_value'
}

export function standardDocumentSummary(document: StandardDocument) {
  const bindingCounts = document.fields.reduce<Record<string, number>>((counts, field) => {
    const status = field.source_binding?.status ?? 'unknown'
    counts[status] = (counts[status] ?? 0) + 1
    return counts
  }, {})
  return {
    code: document.code,
    name: document.name,
    category: document.category,
    agent_role: document.agent_role,
    classification: document.classification,
    field_count: document.fields.length,
    legal_review_required: document.legal_review_required,
    human_approval_required: document.human_approval_required,
    approval_chain: document.approval_chain,
    agent_may_publish: document.agent_may_publish,
    source_template_is_read_only: document.source_template_is_read_only,
    source_binding_counts: bindingCounts,
  }
}
