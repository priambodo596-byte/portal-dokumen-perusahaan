import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

const TOKEN_RE = /\{\{[^{}]+\}\}/g

/** Sorot token {{variabel}} (ungu) di dalam editor tanpa mengubah isi dokumen. */
export const VariableHighlight = {
  name: 'variableHighlight',
  addProseMirrorPlugins() {
    const build = (doc: PMNode) => {
      const decos: Decoration[] = []
      doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return
        for (const m of node.text.matchAll(TOKEN_RE)) {
          const from = pos + (m.index ?? 0)
          decos.push(Decoration.inline(from, from + m[0].length, { class: 'variable-text' }))
        }
      })
      return DecorationSet.create(doc, decos)
    }
    return [new Plugin({
      key: new PluginKey('variableHighlight'),
      state: { init: (_c, { doc }) => build(doc), apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old) },
      props: { decorations(state) { return this.getState(state) } },
    })]
  },
} as any

/** Baris tabel yang diulang per item dokumen ({{#items}}). Disimpan sebagai atribut data-each. */
export const LoopRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      dataEach: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-each'),
        renderHTML: (attrs: Record<string, unknown>) => (attrs.dataEach ? { 'data-each': String(attrs.dataEach) } : {}),
      },
    }
  },
})

export const FONT_FAMILIES = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
] as const

export const FONT_SIZES = ['10px', '11px', '12px', '14px', '16px', '18px', '20px', '24px', '32px'] as const

export function templateExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, autolink: false, HTMLAttributes: { rel: 'noopener noreferrer' } },
    }),
    TextStyle, FontFamily, FontSize, Color,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Table.configure({ resizable: false }),
    LoopRow, TableHeader, TableCell,
    VariableHighlight,
  ]
}
