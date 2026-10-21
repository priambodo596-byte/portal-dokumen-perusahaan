import sanitizeHtml from 'sanitize-html'

// Pola nilai style untuk garis tepi dan kotak (padding/margin 1–4 nilai).
const BORDER = [/^(none|0)$/i, /^\d+(\.\d+)?(px|pt)?\s+(solid|dashed|dotted|double)\s+(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i]
const BOX = /^\d+(\.\d+)?(px|pt|em|rem)?(\s+\d+(\.\d+)?(px|pt|em|rem)?){0,3}$/

// Allowlist HTML untuk template & hasil render. Menjaga agar skrip/atribut berbahaya dibuang.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'span', 'div', 'section', 'header', 'footer',
    'strong', 'b', 'i', 'em', 'u', 's', 'sub', 'sup', 'small', 'blockquote', 'pre', 'code',
    'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'a', 'img', 'figure', 'figcaption',
  ],
  allowedAttributes: {
    '*': ['style', 'class', 'colspan', 'rowspan', 'align'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    th: ['colspan', 'rowspan', 'scope', 'width', 'valign'],
    td: ['colspan', 'rowspan', 'width', 'valign'],
    col: ['span', 'width'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'data'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
  // Izinkan hanya properti style yang aman untuk dokumen (tanpa url()/expression()).
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      'font-size': [/^\d+(\.\d+)?(px|pt|em|rem|%)$/],
      'font-family': [/^[\w\s,'"-]+$/],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
      'font-style': [/^(normal|italic)$/],
      'text-decoration': [/^(none|underline|line-through)$/],
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
      'line-height': [/^\d+(\.\d+)?(px|pt|em|rem|%)?$/],
      width: [/^\d+(\.\d+)?(px|pt|em|rem|%)$/],
      'min-width': [/^\d+(\.\d+)?(px|pt|em|rem|%)$/],
      'vertical-align': [/^(top|middle|bottom|baseline)$/],
      'margin-top': [/^\d+(\.\d+)?(px|pt|em|rem)$/],
      'margin-bottom': [/^\d+(\.\d+)?(px|pt|em|rem)$/],
      'padding-left': [/^\d+(\.\d+)?(px|pt|em|rem)$/],
      // Kop surat / header-footer: garis tepi, padding, margin, dan tinggi sederhana tetap dipertahankan.
      border: BORDER,
      'border-top': BORDER,
      'border-bottom': BORDER,
      'border-left': BORDER,
      'border-right': BORDER,
      'border-collapse': [/^(collapse|separate)$/],
      padding: [BOX],
      'padding-top': [/^\d+(\.\d+)?(px|pt|em|rem)$/],
      'padding-right': [/^\d+(\.\d+)?(px|pt|em|rem)$/],
      'padding-bottom': [/^\d+(\.\d+)?(px|pt|em|rem)$/],
      margin: [BOX],
      'margin-left': [/^\d+(\.\d+)?(px|pt|em|rem)$/],
      'margin-right': [/^\d+(\.\d+)?(px|pt|em|rem)$/],
      height: [/^\d+(\.\d+)?(px|pt|em|rem|%)$/],
      'max-width': [/^\d+(\.\d+)?(px|pt|em|rem|%)$/],
      'white-space': [/^(normal|nowrap|pre-wrap)$/],
    },
  },
  disallowedTagsMode: 'discard',
}

export function sanitizeTemplateHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS)
}
