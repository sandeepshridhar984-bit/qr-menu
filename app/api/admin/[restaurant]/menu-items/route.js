import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function POST(request, { params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const {
    category_id, name, description = "", price, discounted_price = null,
    image_emoji = "🍲", image_url = "", is_veg = 1, spice_level = "none",
    tags = [], ingredients = [], allergens = [], prep_time_minutes = 15,
    is_popular = 0, is_recommended = 0,
  } = body;

  if (!category_id || !name?.trim() || price === undefined || price === null) {
    return NextResponse.json({ error: "Category, name, and price are required." }, { status: 400 });
  }

  const id = newId();
  db.prepare(
    `INSERT INTO menu_items
      (id, restaurant_id, category_id, name, description, price, discounted_price, image_emoji, image_url,
       is_veg, spice_level, tags, ingredients, allergens, prep_time_minutes, available, is_popular, is_recommended)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    id, restaurant.id, category_id, name.trim(), description, Number(price),
    discounted_price ? Number(discounted_price) : null, image_emoji, image_url,
    is_veg ? 1 : 0, spice_level, JSON.stringify(tags), JSON.stringify(ingredients),
    JSON.stringify(allergens), Number(prep_time_minutes) || 15, is_popular ? 1 : 0, is_recommended ? 1 : 0
  );

  const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id);
  return NextResponse.json({ item: { ...item, tags: JSON.parse(item.tags) } }, { status: 201 });
}
