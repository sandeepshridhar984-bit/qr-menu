import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request) {
  const { restaurantId } = await request.json();
  if (!restaurantId) return NextResponse.json({ error: "restaurantId is required" }, { status: 400 });

  db.prepare(
    `UPDATE platform_fees SET settled = 1, settled_at = datetime('now') WHERE restaurant_id = ? AND settled = 0`
  ).run(restaurantId);

  return NextResponse.json({ ok: true });
}
