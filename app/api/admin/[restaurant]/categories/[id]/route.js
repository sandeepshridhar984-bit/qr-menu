import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const { name, active } = await request.json();
  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(params.id);
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("UPDATE categories SET name = ?, active = ? WHERE id = ?").run(
    name ?? category.name,
    active === undefined ? category.active : (active ? 1 : 0),
    category.id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(params.id);
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const itemCount = db.prepare("SELECT COUNT(*) c FROM menu_items WHERE category_id = ?").get(category.id).c;
  if (itemCount > 0) {
    return NextResponse.json(
      { error: `Move or delete the ${itemCount} item(s) in this category first.` },
      { status: 409 }
    );
  }

  db.prepare("DELETE FROM categories WHERE id = ?").run(category.id);
  return NextResponse.json({ ok: true });
}
