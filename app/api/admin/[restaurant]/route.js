import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const logo_image_url = body.logo_image_url !== undefined ? body.logo_image_url : restaurant.logo_image_url;
  const cover_image_url = body.cover_image_url !== undefined ? body.cover_image_url : restaurant.cover_image_url;
  const tagline = body.tagline !== undefined ? body.tagline : restaurant.tagline;
  const instagram_url = body.instagram_url !== undefined ? body.instagram_url : restaurant.instagram_url;

  db.prepare(`UPDATE restaurants SET logo_image_url = ?, cover_image_url = ?, tagline = ?, instagram_url = ? WHERE id = ?`).run(
    logo_image_url || "",
    cover_image_url || "",
    tagline || "",
    instagram_url || "",
    restaurant.id
  );

  const updated = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(restaurant.id);
  return NextResponse.json({ restaurant: updated });
}
