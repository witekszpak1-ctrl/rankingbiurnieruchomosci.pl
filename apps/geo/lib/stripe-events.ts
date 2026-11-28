/**
 * Zamiana zdarzeń Stripe na płatności w geo.payments. Czyste funkcje: webhook tylko je woła i zapisuje wynik.
 * Kwoty Stripe są w groszach. Netto bierzemy z faktury (po rabatach, bez VAT). Zwrot liczymy proporcjonalnie
 * do pierwotnej płatności (ta sama proporcja netto do brutto).
 */
export type StripeInvoice = {
  id: string;
  customer: string | null;
  amount_paid: number;
  total_excluding_tax?: number | null;
  subtotal?: number;
  currency: string;
  status_transitions?: { paid_at?: number | null };
  created: number;
  metadata?: Record<string, string> | null;
  parent?: { subscription_details?: { metadata?: Record<string, string> | null } | null } | null;
  subscription_details?: { metadata?: Record<string, string> | null } | null;
};

export type InvoicePayment = {
  providerPaymentId: string;
  customerId: string | null;
  accountIdHint: string | null;
  amountNetGrosze: number;
  amountGrossGrosze: number;
  occurredAt: Date;
};

export function invoicePayment(inv: StripeInvoice): InvoicePayment | null {
  if (inv.currency?.toLowerCase() !== "pln" || !(inv.amount_paid > 0)) return null;
  const net = inv.total_excluding_tax ?? inv.subtotal ?? inv.amount_paid;
  const meta = inv.metadata?.account_id ?? inv.parent?.subscription_details?.metadata?.account_id ?? inv.subscription_details?.metadata?.account_id ?? null;
  return {
    providerPaymentId: inv.id,
    customerId: inv.customer,
    accountIdHint: meta,
    amountNetGrosze: Math.min(net, inv.amount_paid),
    amountGrossGrosze: inv.amount_paid,
    occurredAt: new Date(((inv.status_transitions?.paid_at ?? inv.created) || inv.created) * 1000),
  };
}

/** Netto zwrotu w proporcji do pierwotnej płatności. */
export function proportionalNet(refundGross: number, originalNet: number, originalGross: number): number {
  if (originalGross <= 0) return 0;
  return Math.round((Math.abs(refundGross) * Math.abs(originalNet)) / Math.abs(originalGross));
}
