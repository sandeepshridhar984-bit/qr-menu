import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const body = await request.json();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(params.id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fields = ["title", "description", "discount_type", "discount_value", "requires_video", "allow_instagram_repost", "terms_text", "active", "media_type"];
  const boolFields = ["requires_video", "allow_instagram_repost", "active"];
  const updates = {};
  for (const f of fields) {
    if (f in body) updates[f] = boolFields.includes(f) ? (body[f] ? 1 : 0) : body[f];
  }
  const keys = Object.keys(updates);
  if (keys.length === 0) return NextResponse.json({ error: "No changes" }, { status: 400 });

  db.prepare(`UPDATE campaigns SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).run(
    ...keys.map((k) => updates[k]),
    campaign.id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  db.prepare("DELETE FROM campaigns WHERE id = ?").run(params.id);
  return NextResponse.json({ ok: true });
}
