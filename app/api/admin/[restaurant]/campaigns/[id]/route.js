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

  const applyUpdate = db.transaction(() => {
    if (updates.active === 1) {
      // Same single-active rule as campaign creation: turning this one on
      // pauses every other campaign for this restaurant, so the customer
      // menu (which just grabs "the" active campaign) always shows the one
      // that was just switched on.
      db.prepare("UPDATE campaigns SET active = 0 WHERE restaurant_id = ? AND id != ?").run(
        campaign.restaurant_id,
        campaign.id
      );
    }
    db.prepare(`UPDATE campaigns SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).run(
      ...keys.map((k) => updates[k]),
      campaign.id
    );
  });
  applyUpdate();

  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(params.id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A campaign with submissions against it (reviews/consents referencing
  // this campaign_id) can't just be deleted -- foreign_keys is ON, so that
  // throws SQLITE_CONSTRAINT and the delete silently fails client-side.
  // The submissions themselves are still real feedback worth keeping, so
  // detach them from the campaign instead of blocking the delete.
  const deleteCampaign = db.transaction(() => {
    db.prepare("UPDATE reviews SET campaign_id = NULL WHERE campaign_id = ?").run(params.id);
    db.prepare("UPDATE consents SET campaign_id = NULL WHERE campaign_id = ?").run(params.id);
    db.prepare("DELETE FROM campaigns WHERE id = ?").run(params.id);
  });

  try {
    deleteCampaign();
  } catch (e) {
    return NextResponse.json({ error: "Could not delete this campaign." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
