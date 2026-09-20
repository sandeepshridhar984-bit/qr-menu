import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(request, { params }) {
  const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(params.id);
  if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("DELETE FROM consents WHERE order_id = ? AND campaign_id = ?").run(review.order_id, review.campaign_id);
  db.prepare("DELETE FROM reviews WHERE id = ?").run(review.id);

  return NextResponse.json({ ok: true });
}
