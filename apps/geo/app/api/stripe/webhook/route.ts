import { NextResponse } from "next/server";

import { recordPayment } from "@/lib/affiliate-repo";
import { query, withTransaction } from "@/lib/db";
import { invoicePayment, proportionalNet, type StripeInvoice } from "@/lib/stripe-events";
import { verifyStripeSignature } from "@/lib/stripe-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Event = { id: string; type: string; data: { object: Record<string, unknown> } };

async function accountFor(customerId: string | null, hint: string | null): Promise<string | null> {
  if (hint) {
    const r = await query<{ id: string }>(`select id from geo.accounts where id::text = $1`, [hint]);
    if (r[0]) return r[0].id;
  }
  if (!customerId) return null;
  const r = await query<{ id: string }>(
    `select account_id as id from geo.subscriptions where provider = 'stripe' and provider_customer_id = $1 order by created_at desc limit 1`,
    [customerId],
  );
  return r[0]?.id ?? null;
}

async function original(invoiceId: string | null) {
  if (!invoiceId) return null;
  const r = await query<{ accountId: string; net: string; gross: string }>(
    `select account_id as "accountId", amount_net_grosze as net, amount_gross_grosze as gross
     from geo.payments where provider = 'stripe' and provider_payment_id = $1 and kind = 'payment'`,
    [invoiceId],
  );
  return r[0] ? { accountId: r[0].accountId, net: Number(r[0].net), gross: Number(r[0].gross) } : null;
}

/**
 * Webhook Stripe: invoice.paid (płatność), charge.refunded (zwroty), charge.dispute.created (obciążenie zwrotne).
 * Każde zdarzenie jest idempotentne przez unikalny identyfikator płatności. Bez klucza webhooka trasa odpowiada 503,
 * więc nic nie zapisze się z niepodpisanego żądania.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("Webhook nieskonfigurowany", { status: 503 });
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) {
    return new NextResponse("Zły podpis", { status: 400 });
  }
  const event = JSON.parse(payload) as Event;
  const obj = event.data.object;

  if (event.type === "invoice.paid") {
    const p = invoicePayment(obj as unknown as StripeInvoice);
    if (!p) return NextResponse.json({ ignored: true });
    const accountId = await accountFor(p.customerId, p.accountIdHint);
    if (!accountId) return new NextResponse("Nieznane konto klienta", { status: 422 });
    const r = await withTransaction((c) => recordPayment(c, { accountId, kind: "payment", description: "faktura Stripe", ...p }));
    return NextResponse.json(r);
  }

  if (event.type === "charge.refunded") {
    const invoiceId = typeof obj.invoice === "string" ? obj.invoice : null;
    const orig = await original(invoiceId);
    if (!orig) return NextResponse.json({ ignored: true });
    const refunds = ((obj.refunds as { data?: { id: string; amount: number; created: number; status?: string }[] })?.data ?? [])
      .filter((r) => r.status !== "failed" && r.status !== "canceled");
    const results = await withTransaction(async (c) => {
      const out = [];
      for (const rf of refunds) {
        out.push(await recordPayment(c, {
          accountId: orig.accountId,
          providerPaymentId: rf.id,
          kind: "refund",
          amountGrossGrosze: rf.amount,
          amountNetGrosze: proportionalNet(rf.amount, orig.net, orig.gross),
          occurredAt: new Date(rf.created * 1000),
          description: `zwrot do ${invoiceId}`,
        }));
      }
      return out;
    });
    return NextResponse.json({ refunds: results.length });
  }

  if (event.type === "charge.dispute.created") {
    // Spór (chargeback) wskazuje płatność kartą; fakturę podaje pole invoice obciążenia, dostępne w metadanych naszej płatności.
    const invoiceId = typeof obj.invoice === "string" ? obj.invoice : typeof (obj.metadata as Record<string, string> | undefined)?.invoice === "string" ? (obj.metadata as Record<string, string>).invoice : null;
    const orig = await original(invoiceId);
    if (!orig) return NextResponse.json({ ignored: true });
    const amount = Number(obj.amount ?? 0);
    const r = await withTransaction((c) => recordPayment(c, {
      accountId: orig.accountId,
      providerPaymentId: String(obj.id),
      kind: "chargeback",
      amountGrossGrosze: amount,
      amountNetGrosze: proportionalNet(amount, orig.net, orig.gross),
      occurredAt: new Date(Number(obj.created ?? Date.now() / 1000) * 1000),
      description: `obciążenie zwrotne do ${invoiceId}`,
    }));
    return NextResponse.json(r);
  }

  return NextResponse.json({ ignored: true });
}
