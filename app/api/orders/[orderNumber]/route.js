import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request, { params }) {
  const order = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(params.orderNumber);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);
  return NextResponse.json({ order: { ...order, tax_breakdown: JSON.parse(order.tax_breakdown || "[]"), items } });
}
