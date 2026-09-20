import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { upi_id, phonepe_qr_image_url } = await request.json();

  const existing = db
    .prepare("SELECT * FROM restaurant_payment_settings WHERE restaurant_id = ?")
    .get(restaurant.id);

  if (existing) {
    db.prepare(
      `UPDATE restaurant_payment_settings SET upi_id = ?, phonepe_qr_image_url = ? WHERE restaurant_id = ?`
    ).run(upi_id || "", phonepe_qr_image_url || "", restaurant.id);
  } else {
    db.prepare(
      `INSERT INTO restaurant_payment_settings (restaurant_id, upi_id, phonepe_qr_image_url, cash_enabled, online_enabled)
       VALUES (?, ?, ?, 1, 1)`
    ).run(restaurant.id, upi_id || "", phonepe_qr_image_url || "");
  }

  return NextResponse.json({ ok: true });
}
