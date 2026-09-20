"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, QrCode, Check, StickyNote } from "lucide-react";
import { parseDbDate } from "@/lib/clientDates";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STATUS_LABEL = {
  trial: ["Free trial", "bg-clay-light text-clay"],
  pending_payment: ["Payment requested", "bg-turmeric/25 text-chili-dark"],
  active: ["Active", "bg-herb/15 text-herb"],
  grace_period: ["Grace period", "bg-turmeric/25 text-chili-dark"],
  suspended: ["Suspended", "bg-chili/15 text-chili-dark"],
};

// How long, after a local edit, we ignore the server's version of that same
// field when a background poll comes in. This stops the "type a number,
// watch it get overwritten mid-keystroke" problem while still keeping
// everything live within a few seconds of you finishing an edit.
const EDIT_PROTECTION_MS = 4000;

export default function SuperAdminApp({ settings, settingsHistory, restaurants: initialRestaurants, contact: initialContact, feeBalance: initialFeeBalance }) {
  const router = useRouter();
  const [form, setForm] = useState({
    onboarding_fee: settings?.onboarding_fee ?? 10000,
    monthly_fee: settings?.monthly_fee ?? 7000,
    order_fee: settings?.order_fee ?? 3,
    grace_period_days: settings?.grace_period_days ?? 3,
  });
  const [saved, setSaved] = useState(false);
  const [restaurants, setRestaurants] = useState(initialRestaurants);
  const [history, setHistory] = useState(settingsHistory);
  const [contact, setContact] = useState(initialContact || { phone: "", phonepe_qr_image_url: "" });
  const [contactSaved, setContactSaved] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [feeBalance, setFeeBalance] = useState(initialFeeBalance || { totalUnsettled: 0, totalSettled: 0, byRestaurant: [] });
  const [savedNoteId, setSavedNoteId] = useState(null);

  // Tracks "restaurantId:field" -> timestamp of last local edit, so live
  // polling never clobbers something you're in the middle of typing.
  const lastEditedRef = useRef({});
  function markEdited(restaurantId, field) {
    lastEditedRef.current[`${restaurantId}:${field}`] = Date.now();
  }
  function isProtected(restaurantId, field) {
    const t = lastEditedRef.current[`${restaurantId}:${field}`];
    return t && Date.now() - t < EDIT_PROTECTION_MS;
  }

  function askConfirm(message, onConfirm) {
    setConfirmDialog({ message, onConfirm });
  }

  // Live polling — the whole dashboard (client list, order counts baked
  // into each client's fee balance, payment proofs, notes) refreshes every
  // few seconds on its own. No more needing to hit refresh to see a new
  // order's ₹0 total turn into a real number.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/super-admin/dashboard");
        if (!res.ok) return;
        const data = await res.json();

        setFeeBalance(data.feeBalance);
        setHistory(data.settingsHistory);

        setRestaurants((prev) => {
          const prevById = Object.fromEntries(prev.map((r) => [r.id, r]));
          return data.restaurants.map((fresh) => {
            const local = prevById[fresh.id];
            if (!local) return fresh;
            const merged = { ...fresh };
            for (const field of ["monthly_fee_effective", "onboarding_fee_effective", "billing_cycle_end", "notes", "platform_fee_enabled"]) {
              if (isProtected(fresh.id, field)) merged[field] = local[field];
            }
            return merged;
          });
        });
      } catch {
        // network hiccup — just try again next tick
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  async function settleFees(restaurantId) {
    const res = await fetch("/api/super-admin/platform-fees/settle", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId }),
    });
    if (res.ok) {
      setRestaurants((prev) =>
        prev.map((x) =>
          x.id === restaurantId
            ? {
                ...x,
                settled_platform_fees_total: (x.settled_platform_fees_total || 0) + (x.unsettled_platform_fees || 0),
                unsettled_platform_fees: 0,
                unsettled_platform_fee_orders: 0,
              }
            : x
        )
      );
      const refreshed = await fetch("/api/super-admin/platform-fees").then((r) => r.json());
      setFeeBalance(refreshed);
    }
  }

  const counts = restaurants.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; },
    {}
  );

  async function logout() {
    await fetch("/api/super-admin/auth/logout", { method: "POST" });
    router.push("/super-admin/login");
  }

  async function saveRates() {
    const res = await fetch("/api/super-admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      setHistory((h) => [data.settings, ...h]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function saveContact() {
    const res = await fetch("/api/super-admin/contact", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contact),
    });
    if (res.ok) {
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 2000);
    }
  }

  async function handleQrImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const upRes = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
    const upData = await upRes.json();
    if (upRes.ok) setContact((c) => ({ ...c, phonepe_qr_image_url: upData.url }));
  }

  async function requestPayment(r) {
    const res = await fetch(`/api/super-admin/restaurants/${r.id}/request-payment`, { method: "POST" });
    if (res.ok) setRestaurants((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "pending_payment" } : x)));
  }

  async function activate(r) {
    const res = await fetch(`/api/super-admin/restaurants/${r.id}/activate`, { method: "POST" });
    if (res.ok) {
      setRestaurants((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? { ...x, status: "active", onboarding_paid: 1, billing_cycle_start: "today", billing_cycle_end: "in 30 days" }
            : x
        )
      );
    }
  }

  async function toggleSuspend(r) {
    const nextStatus = r.status === "suspended" ? "active" : "suspended";
    const res = await fetch(`/api/super-admin/restaurants/${r.id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) setRestaurants((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: nextStatus } : x)));
  }

  async function deleteRestaurant(r) {
    askConfirm(`Permanently delete "${r.name}" and all their menu, orders, and data? This cannot be undone. (Their email will become available again if they ever want to sign up fresh.)`, async () => {
      const res = await fetch(`/api/super-admin/restaurants/${r.id}`, { method: "DELETE" });
      if (res.ok) {
        setRestaurants((prev) => prev.filter((x) => x.id !== r.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this client.");
      }
    });
  }

  function updateSubscriptionField(r, field, value) {
    markEdited(r.id, field);
    setRestaurants((prev) => prev.map((x) => (x.id === r.id ? { ...x, [field]: value } : x)));
  }
  async function saveSubscriptionField(r, field, value) {
    await fetch(`/api/super-admin/restaurants/${r.id}/subscription`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }),
    });
  }

  async function togglePlatformFee(r) {
    const next = !r.platform_fee_enabled;
    setRestaurants((prev) => prev.map((x) => (x.id === r.id ? { ...x, platform_fee_enabled: next } : x)));
    markEdited(r.id, "platform_fee_enabled");
    await saveSubscriptionField(r, "platform_fee_enabled", next);
  }

  function updateNotes(r, value) {
    markEdited(r.id, "notes");
    setRestaurants((prev) => prev.map((x) => (x.id === r.id ? { ...x, notes: value } : x)));
  }
  async function saveNotes(r, value) {
    await fetch(`/api/super-admin/restaurants/${r.id}/notes`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: value }),
    });
    setSavedNoteId(r.id);
    setTimeout(() => setSavedNoteId((cur) => (cur === r.id ? null : cur)), 1500);
  }

  async function acknowledgeProof(proofId, restaurantId) {
    const res = await fetch(`/api/super-admin/payment-proofs/${proofId}/acknowledge`, { method: "POST" });
    if (res.ok) {
      setRestaurants((prev) =>
        prev.map((x) => {
          if (x.id !== restaurantId) return x;
          const proof = x.pending_payment_proofs.find((p) => p.id === proofId);
          const updated = {
            ...x,
            pending_payment_proofs: x.pending_payment_proofs.filter((p) => p.id !== proofId),
            payment_proofs: x.payment_proofs.map((p) => (p.id === proofId ? { ...p, status: "acknowledged" } : p)),
          };
          // Reflect the balance/renewal effects immediately instead of
          // waiting for the next poll — same thing the server just did.
          if (proof?.type === "platform_fee") {
            updated.settled_platform_fees_total = (x.settled_platform_fees_total || 0) + (x.unsettled_platform_fees || 0);
            updated.unsettled_platform_fees = 0;
            updated.unsettled_platform_fee_orders = 0;
          } else {
            updated.onboarding_paid = 1;
            updated.status = "active";
          }
          return updated;
        })
      );
      const refreshed = await fetch("/api/super-admin/platform-fees").then((r) => r.json()).catch(() => null);
      if (refreshed) setFeeBalance(refreshed);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-ink text-paper px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} className="text-turmeric" />
            <span className="font-display font-bold">TableServe · Super Admin</span>
          </div>
          <button onClick={logout} className="text-xs font-medium text-paper/60 hover:text-paper transition-colors">
            Log out
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 grid gap-8">
        <section>
          <h2 className="font-display text-lg font-bold text-ink mb-1">Clients</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
            <StatBox label="Total" value={restaurants.length} />
            <StatBox label="Free trial" value={counts.trial || 0} />
            <StatBox label="Payment requested" value={counts.pending_payment || 0} />
            <StatBox label="Active" value={counts.active || 0} />
            <StatBox label="Suspended" value={counts.suspended || 0} />
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-ink mb-1">Platform fee balance</h2>
          <p className="text-sm text-clay mb-4 max-w-lg">
            This is <strong>your</strong> money — the per-order fee is included in each customer's
            bill, but since payments go straight to the restaurant (cash or their own UPI), they owe
            you this amount. Each client's amount and "Mark collected" button is on their own card
            further down. Updates live as new orders come in.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <StatBox label="Owed to you (all clients)" value={`₹${Math.round(feeBalance.totalUnsettled)}`} />
            <StatBox label="Already collected" value={`₹${Math.round(feeBalance.totalSettled)}`} />
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-ink mb-1">Your payment details (shown to clients)</h2>
          <p className="text-sm text-clay mb-4 max-w-lg">
            When you press "Request payment" on a trial client below, this phone number and
            PhonePe QR appear in a popup on their dashboard so they know how to pay you directly.
          </p>
          <div className="bg-white border border-ink/10 rounded-2xl p-5 max-w-md grid gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">Your phone number</label>
              <input
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">Your PhonePe / UPI QR code</label>
              <label className="flex items-center gap-3 border border-dashed border-ink/25 rounded-card p-3 cursor-pointer">
                {contact.phonepe_qr_image_url ? (
                  <img src={contact.phonepe_qr_image_url} className="w-14 h-14 rounded-lg object-cover" alt="" />
                ) : (
                  <span className="w-14 h-14 rounded-lg bg-clay-light flex items-center justify-center"><QrCode size={24} className="text-clay" /></span>
                )}
                <span className="text-xs text-clay">Upload your QR code image</span>
                <input type="file" accept="image/*" onChange={handleQrImage} className="hidden" />
              </label>
            </div>
            <button onClick={saveContact} className="bg-chili text-white font-semibold px-5 py-2.5 rounded-card text-sm w-fit">
              {contactSaved ? (<span className="inline-flex items-center gap-1"><Check size={14}/> Saved</span>) : "Save contact details"}
            </button>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-ink mb-1">Default platform rates</h2>
          <p className="text-sm text-clay mb-4 max-w-lg">
            This is the rate every restaurant is on <strong>unless you've individually customized
            them</strong> in the list below — so changing it here updates every "(using default
            rate)" client immediately. Restaurants marked "(custom)" keep whatever you specifically
            set for them until you change that client's number directly.
          </p>
          <div className="bg-white border border-ink/10 rounded-2xl p-5 grid sm:grid-cols-2 gap-4 max-w-lg">
            <Field label="Onboarding fee (₹, one-time)" value={form.onboarding_fee} onChange={(v) => setForm({ ...form, onboarding_fee: v })} />
            <Field label="Monthly fee (₹)" value={form.monthly_fee} onChange={(v) => setForm({ ...form, monthly_fee: v })} />
            <Field label="Per-order fee (₹)" value={form.order_fee} onChange={(v) => setForm({ ...form, order_fee: v })} />
            <Field label="Grace period (days)" value={form.grace_period_days} onChange={(v) => setForm({ ...form, grace_period_days: v })} />
          </div>
          <button onClick={saveRates} className="mt-4 bg-chili text-white font-semibold px-5 py-2.5 rounded-card text-sm">
            {saved ? (<span className="inline-flex items-center gap-1"><Check size={14}/> Saved</span>) : "Update rates"}
          </button>

          <details className="mt-5">
            <summary className="text-xs font-semibold text-clay cursor-pointer">Rate change history</summary>
            <div className="grid gap-1.5 text-xs text-ink/70 mt-2">
              {history.map((h) => (
                <div key={h.id} className="flex gap-4">
                  <span className="text-clay w-40 flex-shrink-0">{h.effective_from}</span>
                  <span>₹{h.onboarding_fee} onboarding · ₹{h.monthly_fee}/mo · ₹{h.order_fee}/order · {h.grace_period_days}d grace</span>
                </div>
              ))}
            </div>
          </details>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-ink mb-3">Every restaurant on the platform</h2>
          <div className="grid gap-3">
            {restaurants.map((r) => {
              const [label, cls] = STATUS_LABEL[r.status] || STATUS_LABEL.trial;
              return (
                <div key={r.id} className="bg-white border border-ink/10 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-ink text-sm">{r.name}</p>
                      <p className="text-xs text-ink/70 mt-0.5">
                        {r.owner_email || "No email on file"}
                        {r.phone ? ` · ${r.phone}` : ""}
                      </p>
                      <p className="text-xs text-clay mt-0.5">
                        Due date: {r.billing_cycle_end || "—"} · Onboarding {r.onboarding_paid ? "paid" : "unpaid"}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${cls}`}>{label}</span>
                  </div>

                  {r.pending_reset_link && (
                    <div className="mt-3 bg-turmeric/10 border border-turmeric/30 rounded-card p-3 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-chili-dark">
                        This client requested a password reset. If email delivery isn't working, share this link with them directly.
                      </p>
                      <button
                        onClick={() => navigator.clipboard?.writeText(window.location.origin + r.pending_reset_link)}
                        className="text-xs font-semibold bg-white border border-ink/15 px-3 py-1.5 rounded-full flex-shrink-0"
                      >
                        Copy reset link
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-3 flex-wrap text-xs">
                    <label className="flex items-center gap-1.5">
                      <span className="text-clay">Monthly fee ₹</span>
                      <input
                        type="number"
                        value={r.monthly_fee_effective ?? ""}
                        onChange={(e) => updateSubscriptionField(r, "monthly_fee_effective", e.target.value)}
                        onBlur={(e) => {
                          saveSubscriptionField(r, "monthly_fee", Number(e.target.value));
                          updateSubscriptionField(r, "monthly_fee_is_custom", true);
                        }}
                        className="w-20 border border-ink/15 rounded-card px-2 py-1"
                      />
                      <span className={r.monthly_fee_is_custom ? "text-chili-dark font-medium" : "text-clay"}>
                        {r.monthly_fee_is_custom ? "(custom)" : "(using default rate)"}
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span className="text-clay">Starting/onboarding fee ₹</span>
                      <input
                        type="number"
                        value={r.onboarding_fee_effective ?? ""}
                        onChange={(e) => updateSubscriptionField(r, "onboarding_fee_effective", e.target.value)}
                        onBlur={(e) => {
                          saveSubscriptionField(r, "onboarding_fee", Number(e.target.value));
                          updateSubscriptionField(r, "onboarding_fee_is_custom", true);
                        }}
                        className="w-20 border border-ink/15 rounded-card px-2 py-1"
                      />
                      <span className={r.onboarding_fee_is_custom ? "text-chili-dark font-medium" : "text-clay"}>
                        {r.onboarding_fee_is_custom ? "(custom)" : "(using default rate)"}
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span className="text-clay">Due date</span>
                      <input
                        type="date"
                        value={r.billing_cycle_end && r.billing_cycle_end.match(/^\d{4}-\d{2}-\d{2}$/) ? r.billing_cycle_end : ""}
                        onChange={(e) => updateSubscriptionField(r, "billing_cycle_end", e.target.value)}
                        onBlur={(e) => saveSubscriptionField(r, "billing_cycle_end", e.target.value)}
                        className="border border-ink/15 rounded-card px-2 py-1"
                      />
                    </label>
                    <button
                      onClick={() => togglePlatformFee(r)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold ${
                        r.platform_fee_enabled ? "bg-herb/15 text-herb" : "bg-clay-light text-clay"
                      }`}
                      title="If this client didn't agree to the per-order platform fee, switch it off just for them — their customers won't be charged it and nothing gets added to your fee ledger for their orders."
                    >
                      <span className={`w-7 h-4 rounded-full relative transition-colors ${r.platform_fee_enabled ? "bg-herb" : "bg-clay"}`}>
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${r.platform_fee_enabled ? "left-3.5" : "left-0.5"}`} />
                      </span>
                      Platform fee {r.platform_fee_enabled ? "on" : "off"}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-4 bg-paper border border-ink/10 rounded-card p-3 flex-wrap">
                    <div>
                      <p className="text-xs font-semibold text-ink">Platform fees — current balance</p>
                      {r.unsettled_platform_fees > 0 ? (
                        <p className="text-xs text-clay mt-0.5">
                          ₹{Math.round(r.unsettled_platform_fees)} owed, across {r.unsettled_platform_fee_orders} order(s)
                        </p>
                      ) : (
                        <p className="text-xs text-herb font-medium mt-0.5">✓ Paid up — balance is ₹0</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-ink">Collected all-time</p>
                      <p className="text-xs text-clay mt-0.5">₹{Math.round(r.settled_platform_fees_total || 0)}</p>
                    </div>
                    {r.unsettled_platform_fees > 0 && (
                      <button
                        onClick={() => settleFees(r.id)}
                        className="text-xs font-semibold bg-herb/15 text-herb px-3.5 py-1.5 rounded-full flex-shrink-0"
                      >
                        Mark collected
                      </button>
                    )}
                  </div>

                  {r.pending_payment_proofs?.length > 0 && (
                    <div className="mt-3 grid gap-2">
                      {r.pending_payment_proofs.map((p) => (
                        <div key={p.id} className="bg-herb/10 border border-herb/30 rounded-card p-3 flex items-center gap-3">
                          <img src={p.image_url} alt="Payment screenshot" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 cursor-pointer" onClick={() => window.open(p.image_url, "_blank")} />
                          <div className="flex-1 text-xs">
                            <p className="font-semibold text-ink">
                              {r.name} says they paid{p.amount_claimed ? ` ₹${p.amount_claimed}` : ""}
                              <span className="ml-1.5 text-clay font-normal">
                                ({p.type === "platform_fee" ? "platform fee" : "subscription"})
                              </span>
                            </p>
                            <p className="text-clay mt-0.5">{parseDbDate(p.created_at).toLocaleString()}{p.note ? ` · ${p.note}` : ""}</p>
                          </div>
                          <button
                            onClick={() => acknowledgeProof(p.id, r.id)}
                            className="text-xs font-semibold bg-herb text-white px-3 py-1.5 rounded-full flex-shrink-0"
                          >
                            Acknowledge
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="flex items-center gap-1.5 text-xs text-clay mb-1">
                      <StickyNote size={12} /> Your notes about this client
                    </label>
                    <textarea
                      value={r.notes || ""}
                      onChange={(e) => updateNotes(r, e.target.value)}
                      onBlur={(e) => saveNotes(r, e.target.value)}
                      placeholder="e.g. Prefers WhatsApp, pays on the 5th, asked about a second QR stand..."
                      rows={2}
                      className="w-full border border-ink/15 rounded-card px-3 py-2 text-xs bg-paper"
                    />
                    {savedNoteId === r.id && <span className="text-xs text-herb font-medium">Saved</span>}
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {r.status === "trial" && (
                      <button onClick={() => requestPayment(r)} className="text-xs font-semibold bg-turmeric/25 text-chili-dark px-3.5 py-1.5 rounded-full">
                        Request subscription payment
                      </button>
                    )}
                    {r.status === "pending_payment" && (
                      <button onClick={() => activate(r)} className="text-xs font-semibold bg-herb/15 text-herb px-3.5 py-1.5 rounded-full">
                        Mark as paid & activate
                      </button>
                    )}
                    {(r.status === "active" || r.status === "grace_period") && (
                      <button onClick={() => toggleSuspend(r)} className="text-xs font-semibold text-chili-dark underline">
                        Suspend
                      </button>
                    )}
                    {r.status === "suspended" && (
                      <button onClick={() => toggleSuspend(r)} className="text-xs font-semibold text-herb underline">
                        Reactivate
                      </button>
                    )}
                    <button onClick={() => deleteRestaurant(r)} className="text-xs font-semibold text-chili-dark underline ml-auto">
                      Delete client
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-clay mt-3">
            Manual control by design — you decide when a client's trial ends and when their payment
            is confirmed. The automated daily job that would do this on its own (per{" "}
            <code>technical-spec.md</code> §5) hasn't been built yet.
          </p>
        </section>
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-[60] bg-ink/50 flex items-center justify-center p-4" onClick={() => setConfirmDialog(null)}>
          <div className="bg-paper rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-ink">{confirmDialog.message}</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 border border-ink/15 text-ink font-semibold py-2.5 rounded-card">Cancel</button>
              <button
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                className="flex-1 bg-chili text-white font-semibold py-2.5 rounded-card"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="bg-white border border-ink/10 rounded-2xl p-4 text-center">
      <p className="font-display text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-clay mt-0.5">{label}</p>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm"
      />
    </div>
  );
}
