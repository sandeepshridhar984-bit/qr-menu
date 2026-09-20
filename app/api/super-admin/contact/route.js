import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const contact = db.prepare("SELECT * FROM platform_contact WHERE id = 1").get();
  return NextResponse.json({ contact });
}

export async function POST(request) {
  const { phone, phonepe_qr_image_url } = await request.json();
  db.prepare(
    `UPDATE platform_contact SET phone = ?, phonepe_qr_image_url = ?, updated_at = datetime('now') WHERE id = 1`
  ).run(phone || "", phonepe_qr_image_url || "");
  const contact = db.prepare("SELECT * FROM platform_contact WHERE id = 1").get();
  return NextResponse.json({ contact });
}
