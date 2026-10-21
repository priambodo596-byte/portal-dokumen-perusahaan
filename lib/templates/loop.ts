/**
 * Konversi blok loop {{#items}}...{{/items}} <-> atribut data-each pada <tr>.
 * Editor WYSIWYG (ProseMirror) membuang teks yang berada langsung di dalam <tbody>,
 * sehingga penanda loop diubah menjadi atribut baris selama proses penyuntingan.
 * Format yang disimpan di database tetap {{#items}}...{{/items}}.
 */

const LOOP_BLOCK = /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g
const EACH_ROWS = /((?:\s*<tr\b[^>]*\sdata-each="items"[^>]*>[\s\S]*?<\/tr>)+)/g

/** Template tersimpan -> HTML untuk editor. */
export function toEditorHtml(html: string): string {
  return html.replace(LOOP_BLOCK, (_m, inner: string) => inner.replace(/<tr\b([^>]*)>/g, (_t, attrs: string) => (/data-each=/.test(attrs) ? `<tr${attrs}>` : `<tr data-each="items"${attrs}>`)))
}

/** HTML editor -> template yang disimpan. */
export function fromEditorHtml(html: string): string {
  return html.replace(EACH_ROWS, (run: string) => `{{#items}}${run.replace(/\sdata-each="items"/g, '')}{{/items}}`)
}
