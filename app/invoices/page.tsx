import DocumentTypePage from '@/components/documents/document-type-page'

export default async function InvoicesPage() {
  return <DocumentTypePage type="invoice" route="invoices" title="Invoice & Pembayaran" description="Pantau tagihan dan status pembayaran proyek." />
}
