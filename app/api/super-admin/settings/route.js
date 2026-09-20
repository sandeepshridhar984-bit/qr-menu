import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const settings = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  return NextResponse.json({ settings });
}

// Inserts a new versioned row rather than updating in place, so every past
// rate is preserved for invoice-dispute auditing (see technical-spec.md §5).
export async function POST(request) {
  const { onboarding_fee, monthly_fee, order_fee, grace_period_days } = await request.json();

  db.prepare(
    `INSERT INTO platform_settings (onboarding_fee, monthly_fee, order_fee, grace_period_days, updated_by)
     VALUES (?, ?, ?, ?, ?)`
  ).run(onboarding_fee, monthly_fee, order_fee, grace_period_days, "super-admin");

  const settings = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  return NextResponse.json({ settings });
}
