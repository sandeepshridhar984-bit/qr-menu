const { db } = require("./db");

function getSuperAdminDashboardData() {
  const settings = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  const settingsHistory = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 10").all();

  const rawRestaurants = db
    .prepare(
      `SELECT r.*, s.monthly_fee, s.order_fee_override, s.billing_cycle_end, s.billing_cycle_start,
              s.onboarding_fee, s.onboarding_paid, s.platform_fee_enabled
       FROM restaurants r LEFT JOIN subscriptions s ON s.restaurant_id = r.id
       ORDER BY r.created_at DESC`
    )
    .all();

  const restaurants = rawRestaurants.map((r) => {
    // Pending payment proofs uploaded by the client from their billing tab.
    const pendingProofs = db
      .prepare("SELECT * FROM payment_proofs WHERE restaurant_id = ? AND status = 'pending' ORDER BY created_at DESC")
      .all(r.id);
    const allProofs = db
      .prepare("SELECT * FROM payment_proofs WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 10")
      .all(r.id);

    // A password-reset link the client requested but (maybe) never
    // received by email — surfaced here so the admin can hand it over
    // directly (WhatsApp/phone) if email delivery isn't working.
    const owner = db
      .prepare(
        `SELECT u.email, u.reset_token, u.reset_token_expires FROM users u
         JOIN restaurant_users ru ON ru.user_id = u.id
         WHERE ru.restaurant_id = ? LIMIT 1`
      )
      .get(r.id);
    const hasPendingReset =
      owner?.reset_token && owner?.reset_token_expires && new Date(owner.reset_token_expires) > new Date();

    // This month's platform-fee amount owed (unsettled fees), computed
    // live from the ledger rather than a cached figure, so it's always
    // accurate the instant an order is placed or removed.
    const feeRow = db
      .prepare("SELECT COALESCE(SUM(fee_amount),0) as t, COUNT(*) as n FROM platform_fees WHERE restaurant_id = ? AND settled = 0")
      .get(r.id);
    // All-time total already collected from this client — separate from
    // the current balance, so "how much have they paid me so far" and
    // "how much do they owe me right now" are both visible at a glance.
    const settledRow = db
      .prepare("SELECT COALESCE(SUM(fee_amount),0) as t FROM platform_fees WHERE restaurant_id = ? AND settled = 1")
      .get(r.id);

    return {
      ...r,
      monthly_fee_is_custom: r.monthly_fee !== null,
      monthly_fee_effective: r.monthly_fee ?? settings?.monthly_fee ?? 7000,
      onboarding_fee_is_custom: r.onboarding_fee !== null,
      onboarding_fee_effective: r.onboarding_fee ?? settings?.onboarding_fee ?? 10000,
      platform_fee_enabled: r.platform_fee_enabled !== 0,
      unsettled_platform_fees: feeRow.t,
      unsettled_platform_fee_orders: feeRow.n,
      settled_platform_fees_total: settledRow.t,
      pending_payment_proofs: pendingProofs,
      payment_proofs: allProofs,
      owner_email: owner?.email || null,
      pending_reset_link: hasPendingReset ? `/reset-password?token=${owner.reset_token}` : null,
    };
  });

  const contact = db.prepare("SELECT * FROM platform_contact WHERE id = 1").get();

  const totalUnsettled = db.prepare("SELECT COALESCE(SUM(fee_amount),0) as t FROM platform_fees WHERE settled = 0").get().t;
  const totalSettled = db.prepare("SELECT COALESCE(SUM(fee_amount),0) as t FROM platform_fees WHERE settled = 1").get().t;
  const feesByRestaurant = db
    .prepare(
      `SELECT r.id as restaurant_id, r.name,
              COALESCE(SUM(CASE WHEN pf.settled = 0 THEN pf.fee_amount ELSE 0 END), 0) as unsettled,
              COALESCE(SUM(CASE WHEN pf.settled = 0 THEN 1 ELSE 0 END), 0) as unsettled_orders
       FROM restaurants r LEFT JOIN platform_fees pf ON pf.restaurant_id = r.id
       GROUP BY r.id HAVING unsettled > 0 ORDER BY unsettled DESC`
    )
    .all();

  return {
    settings,
    settingsHistory,
    restaurants,
    contact,
    feeBalance: { totalUnsettled, totalSettled, byRestaurant: feesByRestaurant },
  };
}

module.exports = { getSuperAdminDashboardData };
