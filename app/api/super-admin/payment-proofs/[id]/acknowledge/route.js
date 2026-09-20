import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request, { params }) {
  const proof = db.prepare("SELECT * FROM payment_proofs WHERE id = ?").get(params.id);
  if (!proof) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("UPDATE payment_proofs SET status = 'acknowledged', reviewed_at = datetime('now') WHERE id = ?").run(params.id);

  if (proof.type === "platform_fee") {
    // Zero out this client's platform-fee balance — the next order they
    // take starts a fresh balance from ₹0, live, on both their page and
    // yours.
    db.prepare(
      `UPDATE platform_fees SET settled = 1, settled_at = datetime('now') WHERE restaurant_id = ? AND settled = 0`
    ).run(proof.restaurant_id);
  } else {
    // Subscription payment confirmed: mark it, renew the billing cycle,
    // and make sure onboarding is flagged paid + the account is active.
    // The client's Billing tab shows a "you paid successfully this month"
    // confirmation the moment this happens.
    const today = new Date();
    const nextCycleEnd = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().slice(0, 10);
    db.prepare(
      `UPDATE subscriptions SET onboarding_paid = 1, last_payment_confirmed_at = datetime('now'),
        billing_cycle_start = ?, billing_cycle_end = ?, status = 'active'
       WHERE restaurant_id = ?`
    ).run(fmt(today), fmt(nextCycleEnd), proof.restaurant_id);
    db.prepare(`UPDATE restaurants SET status = 'active' WHERE id = ?`).run(proof.restaurant_id);
  }

  return NextResponse.json({ ok: true });
}
