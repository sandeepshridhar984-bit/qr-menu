import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId, generateOrderNumber } from "@/lib/ids";

export async function POST(request) {
  const body = await request.json();
  const { restaurantId, tableId, items, subtotal, offerId, campaignId, campaignFeedback, sessionId, paymentMethod } = body;

  if (!restaurantId || !tableId || !items?.length) {
    return NextResponse.json({ error: "Missing order details" }, { status: 400 });
  }

  const restaurant = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(restaurantId);
  if (!restaurant || restaurant.status === "suspended") {
    return NextResponse.json({ error: "This restaurant isn't accepting orders right now." }, { status: 403 });
  }

  // MONEY RULE: every rupee amount is rounded to a whole rupee exactly
  // once, right here, before it's ever stored or summed anywhere else.
  // Rounding at display time only (like the old code did) lets two orders
  // that each *display* as ₹444 actually be stored as ₹443.50 each — their
  // sum then correctly totals ₹887, not the ₹888 a customer would expect
  // from "444 + 444". Rounding once at the source means every later sum,
  // receipt, and stat is adding up already-whole numbers, so it can never
  // silently drift by a rupee like that again.
  const roundMoney = (n) => Math.round(n);

  // Discount: either a validated offer OR a validated campaign — never both.
  // Recomputed entirely server-side rather than trusting the client's number.
  let discount = 0;
  let campaign = null;
  if (campaignId) {
    campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND restaurant_id = ? AND active = 1").get(campaignId, restaurantId);
    if (!campaign) {
      return NextResponse.json({ error: "This campaign is no longer available." }, { status: 404 });
    }
    if (!campaignFeedback?.agreedToSubmitContent) {
      return NextResponse.json({ error: "You must agree to the campaign terms to apply this discount." }, { status: 400 });
    }
    if (campaign.requires_video && !campaignFeedback?.videoUrl) {
      return NextResponse.json({ error: "This campaign requires a video to be submitted." }, { status: 400 });
    }
    discount = campaign.discount_type === "percent" ? (subtotal * campaign.discount_value) / 100 : campaign.discount_value;
  } else if (offerId) {
    const offer = db.prepare("SELECT * FROM offers WHERE id = ? AND restaurant_id = ? AND active = 1").get(offerId, restaurantId);
    if (offer && subtotal >= offer.min_order_value) {
      discount = offer.discount_type === "percent" ? (subtotal * offer.discount_value) / 100 : offer.discount_value;
    }
  }
  discount = roundMoney(discount);

  // Tax: computed entirely server-side from this restaurant's active tax
  // rows, never trusting a client-supplied tax figure. A tax can be a
  // percentage of the taxable amount, or a flat ₹ charge (e.g. packaging).
  const activeTaxes = db.prepare("SELECT * FROM restaurant_taxes WHERE restaurant_id = ? AND active = 1").all(restaurantId);
  const taxable = Math.max(subtotal - discount, 0);
  const taxBreakdown = activeTaxes.map((t) => ({
    name: t.name,
    type: t.type || "percent",
    percent: t.percent,
    amount: roundMoney(t.type === "fixed" ? t.percent : (taxable * t.percent) / 100),
  }));
  const tax = taxBreakdown.reduce((s, t) => s + t.amount, 0);

  // Platform fee: added into what the customer actually pays (a disclosed
  // line on the bill), captured at order time so future rate changes never
  // alter historical orders, and logged to the platform_fees ledger as a
  // balance this restaurant owes the platform owner.
  const subscription = db.prepare("SELECT * FROM subscriptions WHERE restaurant_id = ?").get(restaurantId);
  const globalSettings = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  // A client can have platform fees switched off entirely (e.g. they
  // negotiated a flat-fee-only deal) — in that case customers aren't
  // charged the extra line at all, and nothing is added to the ledger.
  const platformFeeEnabled = subscription ? subscription.platform_fee_enabled !== 0 : true;
  const platformFee = roundMoney(platformFeeEnabled ? (subscription?.order_fee_override ?? globalSettings?.order_fee ?? 3) : 0);

  const total = roundMoney(taxable + tax + platformFee);

  const orderId = newId();
  const orderNumber = generateOrderNumber(restaurantId);
  const paymentStatus = paymentMethod === "cash" ? "unpaid" : "pending_confirmation";

  const insertOrder = db.prepare(
    `INSERT INTO orders
      (id, order_number, restaurant_id, table_id, status, subtotal, discount_amount, tax_amount,
       tax_breakdown, platform_fee, total, payment_method, payment_status)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price, addons, item_note)
     VALUES (?, ?, ?, ?, ?, ?, '[]', ?)`
  );

  const tx = db.transaction(() => {
    insertOrder.run(
      orderId, orderNumber, restaurantId, tableId, subtotal, discount, tax,
      JSON.stringify(taxBreakdown), platformFee, total, paymentMethod, paymentStatus
    );
    for (const it of items) {
      insertItem.run(newId(), orderId, it.itemId, it.name, it.qty, it.price, it.note || "");
    }
    db.prepare(
      `INSERT INTO analytics_events (id, restaurant_id, event_type, metadata) VALUES (?, ?, 'order_placed', ?)`
    ).run(newId(), restaurantId, JSON.stringify({ orderNumber, total, paymentMethod }));
    if (platformFeeEnabled && platformFee > 0) {
      db.prepare(
        `INSERT INTO platform_fees (id, restaurant_id, order_id, fee_amount) VALUES (?, ?, ?, ?)`
      ).run(newId(), restaurantId, orderId, platformFee);
    }

    if (campaign) {
      db.prepare(
        `INSERT INTO consents
          (id, campaign_id, order_id, session_id, terms_version, agreed_to_submit_content, agreed_to_instagram_use)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newId(), campaign.id, orderId, sessionId || null, campaign.terms_version,
        campaignFeedback.agreedToSubmitContent ? 1 : 0, campaignFeedback.agreedToInstagramUse ? 1 : 0
      );
      db.prepare(
        `INSERT INTO reviews (id, restaurant_id, order_id, campaign_id, rating, text_feedback, video_url, discount_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newId(), restaurantId, orderId, campaign.id, campaignFeedback.rating || null,
        campaignFeedback.textFeedback || "", campaignFeedback.videoUrl || "",
        `TS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      );
    }
  });
  tx();

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  const orderItems = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderId);
  const table = db.prepare("SELECT * FROM tables WHERE id = ?").get(tableId);
  const fullOrder = { ...order, table_number: table?.table_number, tax_breakdown: JSON.parse(order.tax_breakdown || "[]"), items: orderItems };

  // n8n webhook (Stage 2). Fires only if configured — safe no-op in local/mock mode.
  notifyN8n({ restaurant, orderNumber, tableId, items, total, paymentMethod }).catch(() => {});

  return NextResponse.json({ order: fullOrder }, { status: 201 });
}

async function notifyN8n({ restaurant, orderNumber, tableId, items, total, paymentMethod }) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return; // mock mode: no webhook configured, skip silently
  await fetch(`${url}/order-created`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET || "" },
    body: JSON.stringify({
      restaurantId: restaurant.id, restaurantName: restaurant.name, orderNumber,
      tableId, items, total, paymentMethod, timestamp: new Date().toISOString(),
    }),
  });
}
