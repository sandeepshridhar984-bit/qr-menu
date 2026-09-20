import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const body = await request.json();
  const subscription = db.prepare("SELECT * FROM subscriptions WHERE restaurant_id = ?").get(params.id);
  if (!subscription) return NextResponse.json({ error: "No subscription found for this restaurant" }, { status: 404 });

  const monthly_fee = body.monthly_fee !== undefined ? Number(body.monthly_fee) : subscription.monthly_fee;
  const order_fee_override = body.order_fee_override !== undefined
    ? (body.order_fee_override === null || body.order_fee_override === "" ? null : Number(body.order_fee_override))
    : subscription.order_fee_override;
  const onboarding_fee = body.onboarding_fee !== undefined
    ? (body.onboarding_fee === null || body.onboarding_fee === "" ? null : Number(body.onboarding_fee))
    : subscription.onboarding_fee;
  const billing_cycle_end = body.billing_cycle_end !== undefined ? body.billing_cycle_end : subscription.billing_cycle_end;
  const platform_fee_enabled = body.platform_fee_enabled !== undefined
    ? (body.platform_fee_enabled ? 1 : 0)
    : subscription.platform_fee_enabled;

  db.prepare(
    `UPDATE subscriptions SET monthly_fee = ?, order_fee_override = ?, onboarding_fee = ?, billing_cycle_end = ?, platform_fee_enabled = ? WHERE restaurant_id = ?`
  ).run(monthly_fee, order_fee_override, onboarding_fee, billing_cycle_end, platform_fee_enabled, params.id);

  return NextResponse.json({ ok: true });
}
