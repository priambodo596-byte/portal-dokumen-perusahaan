export type ItemInput = { quantity: number; unitPrice: number }

/** Semua perhitungan nilai dokumen dilakukan di sini (server). Hasil dalam rupiah utuh. */
export function computeTotals(items: ItemInput[], discount: number, taxRate: number) {
  const lines = items.map((i) => Math.round(i.quantity * i.unitPrice))
  const subtotal = lines.reduce((a, b) => a + b, 0)
  const safeDiscount = Math.min(Math.max(discount, 0), subtotal)
  const taxable = subtotal - safeDiscount
  const taxAmount = Math.round((taxable * taxRate) / 100)
  return { lines, subtotal, discount: safeDiscount, taxAmount, total: taxable + taxAmount }
}
