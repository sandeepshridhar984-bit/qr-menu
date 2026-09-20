import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const totalUnsettled = db.prepare("SELECT COALESCE(SUM(fee_amount),0) as t FROM platform_fees WHERE settled = 0").get().t;
  const totalSettled = db.prepare("SELECT COALESCE(SUM(fee_amount),0) as t FROM platform_fees WHERE settled = 1").get().t;

  const byRestaurant = db
    .prepare(
      `SELECT r.id as restaurant_id, r.name,
              COALESCE(SUM(CASE WHEN pf.settled = 0 THEN pf.fee_amount ELSE 0 END), 0) as unsettled,
              COALESCE(SUM(CASE WHEN pf.settled = 0 THEN 1 ELSE 0 END), 0) as unsettled_orders
       FROM restaurants r
       LEFT JOIN platform_fees pf ON pf.restaurant_id = r.id
       GROUP BY r.id
       HAVING unsettled > 0
       ORDER BY unsettled DESC`
    )
    .all();

  return NextResponse.json({ totalUnsettled, totalSettled, byRestaurant });
}
