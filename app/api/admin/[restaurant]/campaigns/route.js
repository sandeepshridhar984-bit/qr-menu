import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function POST(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const {
    title, description = "", discount_type = "percent", discount_value,
    requires_video = 1, allow_instagram_repost = 0, terms_text = "",
  } = await request.json();

  if (!title?.trim() || discount_value === undefined) {
    return NextResponse.json({ error: "Title and discount value are required." }, { status: 400 });
  }

  const id = newId();
  db.prepare(
    `INSERT INTO campaigns
      (id, restaurant_id, title, description, discount_type, discount_value,
       requires_video, allow_instagram_repost, terms_text, terms_version, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'v1', 1)`
  ).run(
    id, restaurant.id, title.trim(), description, discount_type, Number(discount_value),
    requires_video ? 1 : 0, allow_instagram_repost ? 1 : 0, terms_text
  );

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  return NextResponse.json({ campaign }, { status: 201 });
}
