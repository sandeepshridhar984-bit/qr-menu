"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Monogram from "@/components/Monogram";
import { parseDbDate } from "@/lib/clientDates";
import {
  Eye, Bell, CreditCard, Check, Camera, Video, Star, QrCode,
  Smartphone, RefreshCw, ExternalLink, Printer, Upload, ChefHat,
} from "lucide-react";

const TABS = ["Orders", "Menu", "Offers", "Campaigns", "Taxes", "Tables & QR", "Customer View", "Payment settings", "Billing"];
const STATUS_FLOW = ["pending", "completed"];
const SPICE_LEVELS = ["none", "mild", "medium", "hot"];

function money(n, currency = "INR") {
  const symbol = currency === "INR" ? "₹" : currency + " ";
  return `${symbol}${Math.round(n)}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DashboardApp({
  restaurant: initialRestaurant, categories: initialCategories, items: initialItems, tables: initialTables,
  offers: initialOffers, orders: initialOrders, paymentSettings, subscription, totals,
  campaigns: initialCampaigns, reviews: initialReviews, userName, taxes: initialTaxes, platformContact,
  paymentProofs: initialPaymentProofs,
}) {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState(initialRestaurant);
  const [tab, setTab] = useState("Orders");
  const [orders, setOrders] = useState(initialOrders);
  const [items, setItems] = useState(initialItems);
  const [categories, setCategories] = useState(initialCategories);
  const [tables, setTables] = useState(initialTables);
  const [offers, setOffers] = useState(initialOffers);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [taxes, setTaxes] = useState(initialTaxes);
  const [reviews, setReviews] = useState(initialReviews);
  const [paymentProofs, setPaymentProofs] = useState(initialPaymentProofs || []);
  const [paymentModalOpen, setPaymentModalOpen] = useState(restaurant.status === "pending_payment");
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm } | null
  const [newOrderToast, setNewOrderToast] = useState(null);
  const previewTableNumber = tables.find((t) => t.active)?.table_number || tables[0]?.table_number;

  function askConfirm(message, onConfirm) {
    setConfirmDialog({ message, onConfirm });
  }

  useEffect(() => {
    // Fast polling rather than a streaming connection — this is the more
    // reliable choice across dev/production, corporate networks, and
    // reverse proxies that don't forward Server-Sent Events cleanly. Every
    // 2 seconds is fast enough to feel immediate without any streaming
    // infrastructure that could silently fail on some setups.
    let previousOrderNumbers = new Set(orders.map((o) => o.order_number));

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/${restaurant.slug}/orders`);
        if (!res.ok) return;
        const { orders: fresh } = await res.json();

        const freshNumbers = new Set(fresh.map((o) => o.order_number));
        const newOnes = fresh.filter((o) => !previousOrderNumbers.has(o.order_number));
        if (newOnes.length > 0) {
          setNewOrderToast(newOnes[0]);
          // Popup shows briefly, then goes away on its own.
          setTimeout(() => setNewOrderToast((cur) => (cur === newOnes[0] ? null : cur)), 3000);
        }
        previousOrderNumbers = freshNumbers;
        setOrders(fresh);
      } catch {
        // network hiccup — just try again next tick
      }
    }, 2000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.slug]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-gradient-to-r from-ink to-[#1a2318] px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {restaurant.logo_image_url ? (
              <img src={restaurant.logo_image_url} className="w-11 h-11 rounded-xl object-cover" alt="" />
            ) : (
              <Monogram name={restaurant.name} size="sm" className="w-11 h-11 text-base" />
            )}
            <div>
              <p className="font-display font-bold text-paper leading-tight">{restaurant.name}</p>
              <p className="text-xs text-paper/50">{userName ? `Signed in as ${userName}` : "Restaurant dashboard"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/dashboard/${restaurant.slug}/kitchen`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold bg-turmeric/25 text-chili-dark px-3.5 py-2 rounded-full hover:bg-turmeric/40 transition-colors inline-flex items-center gap-1.5"
              title="Open this on a kitchen tablet/screen — live order tickets, no email needed"
            >
              <ChefHat size={14} /> Kitchen Display
            </a>
            {previewTableNumber && (
              <a
                href={`/r/${restaurant.slug}/table/${previewTableNumber}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold bg-white/10 text-paper px-3.5 py-2 rounded-full hover:bg-white/20 transition-colors inline-flex items-center gap-1.5"
              >
                <Eye size={14} /> View customer menu
              </a>
            )}
            <StatusPill status={restaurant.status} />
            <button onClick={logout} className="text-xs font-medium text-paper/60 hover:text-paper transition-colors">
              Log out
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-ink/10 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap px-3.5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? "border-chili text-chili-dark" : "border-transparent text-ink/60 hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      {restaurant.status === "pending_payment" && !paymentModalOpen && (
        <div className="bg-turmeric/20 border-b border-turmeric/40 px-6 py-2.5">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs font-medium text-chili-dark">
              Your subscription payment is due to keep TableServe active.
            </p>
            <button onClick={() => setPaymentModalOpen(true)} className="text-xs font-semibold text-chili-dark underline">
              View payment details
            </button>
          </div>
        </div>
      )}

      {paymentModalOpen && (
        <PaymentDueModal
          subscription={subscription}
          platformContact={platformContact}
          onClose={() => setPaymentModalOpen(false)}
        />
      )}

      <div className="max-w-6xl mx-auto px-6 py-6">
        {tab === "Orders" && <OrdersTab restaurant={restaurant} orders={orders} setOrders={setOrders} askConfirm={askConfirm} />}
        {tab === "Menu" && (
          <MenuTab restaurant={restaurant} categories={categories} setCategories={setCategories} items={items} setItems={setItems} askConfirm={askConfirm} />
        )}
        {tab === "Offers" && <OffersTab restaurant={restaurant} offers={offers} setOffers={setOffers} askConfirm={askConfirm} />}
        {tab === "Campaigns" && (
          <CampaignsTab restaurant={restaurant} campaigns={campaigns} setCampaigns={setCampaigns} reviews={reviews} setReviews={setReviews} askConfirm={askConfirm} />
        )}
        {tab === "Taxes" && <TaxesTab restaurant={restaurant} taxes={taxes} setTaxes={setTaxes} askConfirm={askConfirm} />}
        {tab === "Tables & QR" && <TablesTab restaurant={restaurant} tables={tables} setTables={setTables} />}
        {tab === "Customer View" && <CustomerViewTab restaurant={restaurant} tables={tables} onRestaurantUpdate={setRestaurant} />}
        {tab === "Payment settings" && <PaymentSettingsTab restaurant={restaurant} paymentSettings={paymentSettings} />}
        {tab === "Billing" && (
          <BillingTab
            restaurant={restaurant}
            subscription={subscription}
            platformContact={platformContact}
            orders={orders}
            paymentProofs={paymentProofs}
            setPaymentProofs={setPaymentProofs}
          />
        )}
      </div>

      {newOrderToast && (
        <div className="fixed top-4 right-4 z-[70] bg-ink text-paper rounded-2xl px-5 py-3.5 shadow-2xl animate-rise-in max-w-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-chili/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bell size={16} className="text-turmeric" />
          </div>
          <div>
            <p className="font-semibold text-sm">New order #{newOrderToast.order_number}</p>
            <p className="text-xs text-paper/60 mt-0.5">Table {newOrderToast.table_number} · ₹{Math.round(newOrderToast.total)}</p>
          </div>
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
        />
      )}
    </main>
  );
}

function ConfirmDialog({ message, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] bg-ink/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-paper rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-ink">{message}</p>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 border border-ink/15 text-ink font-semibold py-2.5 rounded-card">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-chili text-white font-semibold py-2.5 rounded-card">Delete</button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    active: ["Active", "bg-herb/20 text-herb"],
    grace_period: ["Grace period", "bg-turmeric/25 text-chili-dark"],
    pending_payment: ["Payment due", "bg-turmeric/25 text-chili-dark"],
    suspended: ["Suspended", "bg-chili/20 text-chili-dark"],
    trial: ["Free trial", "bg-paper/20 text-paper"],
  };
  const [label, cls] = map[status] || map.active;
  return <span className={`text-xs font-semibold px-3 py-1 rounded-full ${cls}`}>{label}</span>;
}

function PaymentDueModal({ subscription, platformContact, onClose }) {
  const amountDue = subscription?.onboarding_paid ? subscription?.monthly_fee : subscription?.onboarding_fee;
  const label = subscription?.onboarding_paid ? "Monthly subscription" : "Onboarding + first month";

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-4">
      <div className="bg-paper rounded-2xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-turmeric/20 flex items-center justify-center mx-auto mb-3">
          <CreditCard size={26} className="text-chili-dark" />
        </div>
        <h2 className="font-display text-lg font-bold text-ink">Subscription payment due</h2>
        <p className="text-sm text-ink/70 mt-2">
          Your free trial has ended. Pay {label.toLowerCase()} — <strong>₹{amountDue}</strong> — to
          keep your QR menu and ordering live.
        </p>

        {platformContact?.phonepe_qr_image_url ? (
          <img src={platformContact.phonepe_qr_image_url} alt="Pay via UPI" className="w-40 h-40 mx-auto rounded-lg mt-5" />
        ) : (
          <div className="w-40 h-40 mx-auto rounded-lg bg-white border border-dashed border-ink/20 flex items-center justify-center text-xs text-clay mt-5 px-4">
            QR not uploaded yet
          </div>
        )}

        {platformContact?.phone && (
          <p className="mt-3 text-sm text-ink">
            Or call/WhatsApp <strong>{platformContact.phone}</strong> to arrange payment.
          </p>
        )}

        <p className="text-xs text-clay mt-4">
          Once you've paid, contact us using the number above — we'll confirm and activate your
          account from our side.
        </p>

        <button onClick={onClose} className="mt-5 w-full border border-ink/15 text-ink font-semibold py-2.5 rounded-card">
          I'll pay later
        </button>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white border border-ink/10 rounded-2xl shadow-sm ${className}`}>{children}</div>;
}

// ---------- Orders ----------

function OrdersTab({ restaurant, orders, setOrders, askConfirm }) {
  // Computed live from the (polled) orders list instead of a one-time
  // server-rendered snapshot, so these numbers update within a couple of
  // seconds of a new order coming in or one being deleted — no page
  // refresh needed.
  const totals = useMemo(() => {
    let totalSales = 0, cashOrders = 0, onlineOrders = 0;
    for (const o of orders) {
      totalSales += o.total;
      if (o.payment_method === "cash") cashOrders += 1;
      else if (o.payment_method === "online_upi") onlineOrders += 1;
    }
    return { totalOrders: orders.length, totalSales, cashOrders, onlineOrders };
  }, [orders]);

  // Bulk delete — either clear everything in one go, or switch into
  // "select" mode and check off specific orders (useful for clearing out
  // test orders without hunting for each Delete button one at a time).
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected(new Set());
  }
  function toggleSelected(orderNumber) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderNumber)) next.delete(orderNumber);
      else next.add(orderNumber);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(orders.map((o) => o.order_number)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  async function deleteAllOrders() {
    if (orders.length === 0) return;
    askConfirm(`Delete all ${orders.length} order(s) from your history? This can't be undone.`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/orders`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setOrders([]);
        setSelectMode(false);
        setSelected(new Set());
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete orders. Please try again.");
      }
    });
  }

  async function deleteSelectedOrders() {
    if (selected.size === 0) return;
    const orderNumbers = Array.from(selected);
    askConfirm(`Delete ${orderNumbers.length} selected order(s)? This can't be undone.`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/orders`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumbers }),
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => !selected.has(o.order_number)));
        setSelectMode(false);
        setSelected(new Set());
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete the selected orders. Please try again.");
      }
    });
  }

  async function updateStatus(orderNumber, status) {
    const res = await fetch(`/api/admin/${restaurant.slug}/orders/${orderNumber}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      setOrders((prev) => prev.map((o) => (o.order_number === orderNumber ? { ...o, ...data.order } : o)));
    }
  }
  async function confirmPayment(orderNumber) {
    const res = await fetch(`/api/admin/${restaurant.slug}/orders/${orderNumber}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_status: "paid" }),
    });
    if (res.ok) {
      const data = await res.json();
      setOrders((prev) => prev.map((o) => (o.order_number === orderNumber ? { ...o, ...data.order } : o)));
    }
  }
  async function deleteOrder(orderNumber) {
    askConfirm(`Delete order #${orderNumber} from your history? This can't be undone.`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/orders/${orderNumber}`, { method: "DELETE" });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.order_number !== orderNumber));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this order. Please try again.");
      }
    });
  }
  // Alternative to email notifications: print (or just view, on a phone) a
  // clean receipt for an order and hand it straight to the kitchen. Useful
  // any time email delivery isn't set up or isn't working.
  function printReceipt(order) {
    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) return;
    const itemsHtml = order.items
      .map(
        (it) =>
          `<tr><td style="padding:4px 0">${it.name} × ${it.quantity}</td><td style="padding:4px 0;text-align:right">${money(
            it.unit_price * it.quantity,
            restaurant.currency
          )}</td></tr>`
      )
      .join("");

    // Full breakdown — subtotal, discount, every tax line, and the
    // platform fee — not just the final total. A receipt that only shows
    // items + total looks like a math error the moment tax or a discount
    // is involved; showing every line is what makes the total make sense.
    const taxBreakdown = Array.isArray(order.tax_breakdown) ? order.tax_breakdown : [];
    const breakdownRows = [
      `<tr><td style="padding:2px 0">Subtotal</td><td style="padding:2px 0;text-align:right">${money(order.subtotal, restaurant.currency)}</td></tr>`,
      order.discount_amount > 0
        ? `<tr><td style="padding:2px 0">Discount</td><td style="padding:2px 0;text-align:right">− ${money(order.discount_amount, restaurant.currency)}</td></tr>`
        : "",
      ...taxBreakdown.map(
        (t) =>
          `<tr><td style="padding:2px 0">${t.name} (${t.type === "fixed" ? "flat" : t.percent + "%"})</td><td style="padding:2px 0;text-align:right">${money(t.amount, restaurant.currency)}</td></tr>`
      ),
      order.platform_fee > 0
        ? `<tr><td style="padding:2px 0">Platform fee</td><td style="padding:2px 0;text-align:right">${money(order.platform_fee, restaurant.currency)}</td></tr>`
        : "",
    ].join("");

    win.document.write(`
      <html>
        <head>
          <title>Order #${order.order_number}</title>
          <style>
            body { font-family: monospace; padding: 16px; color: #111; }
            h1 { font-size: 16px; margin: 0 0 4px; }
            p { margin: 2px 0; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            tr.total td { border-top: 1px dashed #111; padding-top: 6px; font-weight: bold; }
            hr { border: none; border-top: 1px dashed #111; margin: 10px 0; }
          </style>
        </head>
        <body>
          <h1>${restaurant.name}</h1>
          <p>Order #${order.order_number} · Table ${order.table_number || ""}</p>
          <p>${parseDbDate(order.created_at).toLocaleString()}</p>
          <hr />
          <table>
            ${itemsHtml}
          </table>
          <hr />
          <table>
            ${breakdownRows}
            <tr class="total"><td>Total</td><td style="text-align:right">${money(order.total, restaurant.currency)}</td></tr>
          </table>
          <hr />
          <p>Payment: ${order.payment_method.replace("_", " ")} (${order.payment_status.replace("_", " ")})</p>
          ${order.customer_note ? `<p>Note: ${order.customer_note}</p>` : ""}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total orders" value={totals.totalOrders} />
        <StatCard label="Total sales" value={money(totals.totalSales, restaurant.currency)} />
        <StatCard label="Cash orders" value={totals.cashOrders} />
        <StatCard label="Online orders" value={totals.onlineOrders} />
      </div>

      {orders.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          {!selectMode ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={toggleSelectMode}
                className="text-xs font-semibold text-ink/70 border border-ink/15 px-3 py-1.5 rounded-full"
              >
                Select orders
              </button>
              <button
                onClick={deleteAllOrders}
                className="text-xs font-semibold text-chili-dark border border-chili/30 bg-chili/5 px-3 py-1.5 rounded-full"
              >
                Delete all
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-clay">{selected.size} selected</span>
              <button onClick={selectAll} className="text-xs font-semibold text-ink/70 border border-ink/15 px-3 py-1.5 rounded-full">
                Select all
              </button>
              <button onClick={clearSelection} className="text-xs font-semibold text-ink/70 border border-ink/15 px-3 py-1.5 rounded-full">
                Clear
              </button>
              <button
                onClick={deleteSelectedOrders}
                disabled={selected.size === 0}
                className="text-xs font-semibold text-white bg-chili disabled:opacity-40 px-3 py-1.5 rounded-full"
              >
                Delete selected
              </button>
              <button onClick={toggleSelectMode} className="text-xs font-semibold text-clay px-3 py-1.5 rounded-full">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3">
        {orders.length === 0 && <p className="text-clay text-sm">No orders yet.</p>}
        {orders.map((o) => (
          <Card key={o.id} className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selected.has(o.order_number)}
                    onChange={() => toggleSelected(o.order_number)}
                    className="mt-1 w-4 h-4 accent-chili flex-shrink-0"
                  />
                )}
                <div>
                  <p className="font-semibold text-ink">#{o.order_number} · Table {o.table_number}</p>
                  <p className="text-xs text-clay mt-0.5">{o.items.map((it) => `${it.name} ×${it.quantity}`).join(", ")}</p>
                  <p className="text-xs text-clay mt-0.5">
                    {money(o.total, restaurant.currency)} · {o.payment_method.replace("_", " ")} ·{" "}
                    <span className={o.payment_status === "paid" ? "text-herb font-medium" : "text-chili-dark font-medium"}>
                      {o.payment_status.replace("_", " ")}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {o.payment_status !== "paid" && (
                  <button onClick={() => confirmPayment(o.order_number)} className="text-xs font-semibold bg-herb/15 text-herb px-3 py-1.5 rounded-full">
                    {o.payment_status === "pending_confirmation" ? "Confirm payment received" : "Mark as paid"}
                  </button>
                )}
                <select
                  value={o.status}
                  onChange={(e) => updateStatus(o.order_number, e.target.value)}
                  className="text-sm border border-ink/15 rounded-card px-2.5 py-1.5 bg-paper"
                >
                  {STATUS_FLOW.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  onClick={() => printReceipt(o)}
                  className="text-xs font-semibold text-ink/70 inline-flex items-center gap-1 border border-ink/15 px-2.5 py-1.5 rounded-full"
                  title="Print or view a receipt for the kitchen"
                >
                  <Printer size={13} /> Receipt
                </button>
                <button onClick={() => deleteOrder(o.order_number)} className="text-xs font-semibold text-chili-dark">
                  Delete
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-clay">{label}</p>
      <p className="font-display text-xl font-bold text-ink mt-1">{value}</p>
    </Card>
  );
}

// ---------- Menu ----------

function MenuTab({ restaurant, categories, setCategories, items, setItems, askConfirm }) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingItem, setEditingItem] = useState(null); // null | 'new' | item object
  const [modalCategoryId, setModalCategoryId] = useState(null);

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    const res = await fetch(`/api/admin/${restaurant.slug}/categories`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategoryName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setCategories((prev) => [...prev, data.category]);
      setNewCategoryName("");
    }
  }

  async function deleteCategory(cat) {
    askConfirm(`Delete category "${cat.name}"?`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/categories/${cat.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return alert(data.error);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    });
  }

  async function deleteItem(item) {
    askConfirm(`Delete "${item.name}"?`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/menu-items/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this item.");
      }
    });
  }

  async function toggleAvailable(item) {
    const res = await fetch(`/api/admin/${restaurant.slug}/menu-items/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: item.available ? 0 : 1 }),
    });
    if (res.ok) setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available: item.available ? 0 : 1 } : i)));
  }

  function saveItemLocally(item) {
    setItems((prev) => (prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]));
    setEditingItem(null);
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="New category, e.g. Starters"
          className="border border-ink/15 rounded-card px-3.5 py-2 text-sm bg-white"
        />
        <button onClick={addCategory} className="bg-ink text-paper px-4 rounded-card text-sm font-semibold">Add category</button>
      </div>

      <div className="grid gap-7">
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category_id === cat.id);
          return (
            <div key={cat.id}>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="font-display font-bold text-ink">{cat.name}</h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setModalCategoryId(cat.id); setEditingItem("new"); }}
                    className="text-xs font-semibold text-chili"
                  >
                    + Add item
                  </button>
                  {catItems.length === 0 && (
                    <button onClick={() => deleteCategory(cat)} className="text-xs text-clay">Delete category</button>
                  )}
                </div>
              </div>
              {catItems.length === 0 ? (
                <p className="text-xs text-clay">No items yet.</p>
              ) : (
                <div className="grid gap-2">
                  {catItems.map((item) => (
                    <Card key={item.id} className="p-3.5 flex items-center gap-3">
                      {item.image_url ? (
                        <img src={item.image_url} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" alt="" />
                      ) : (
                        <Monogram name={item.name} size="sm" className="w-12 h-12" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink text-sm">{item.name}</p>
                        <p className="text-xs text-clay">
                          {money(item.discounted_price || item.price, restaurant.currency)}
                          {item.discounted_price ? <span className="line-through ml-1.5">{money(item.price, restaurant.currency)}</span> : null}
                        </p>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-clay">
                        <input type="checkbox" checked={!!item.available} onChange={() => toggleAvailable(item)} /> Available
                      </label>
                      <button onClick={() => { setModalCategoryId(cat.id); setEditingItem(item); }} className="text-xs font-semibold text-ink/60">Edit</button>
                      <button onClick={() => deleteItem(item)} className="text-xs font-semibold text-chili-dark">Delete</button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {categories.length === 0 && <p className="text-clay text-sm">Add a category to start building your menu.</p>}
      </div>

      {editingItem && (
        <ItemFormModal
          restaurant={restaurant}
          categoryId={modalCategoryId}
          categories={categories}
          item={editingItem === "new" ? null : editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={saveItemLocally}
        />
      )}
    </div>
  );
}

function ItemFormModal({ restaurant, categoryId, categories, item, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    category_id: item?.category_id || categoryId,
    name: item?.name || "",
    description: item?.description || "",
    price: item?.price ?? "",
    discounted_price: item?.discounted_price ?? "",
    is_veg: item?.is_veg ?? 1,
    spice_level: item?.spice_level || "none",
    prep_time_minutes: item?.prep_time_minutes ?? 15,
    is_popular: item?.is_popular ?? 0,
    is_recommended: item?.is_recommended ?? 0,
    tags: (item?.tags || []).join(", "),
    allergens: (JSON.parse(item?.allergens || "[]") || []).join(", "),
    image_url: item?.image_url || "",
  });
  const [imagePreview, setImagePreview] = useState(item?.image_url || null);
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setImageDataUrl(dataUrl);
    setImagePreview(dataUrl);
  }

  async function save() {
    setError("");
    if (!form.name.trim() || !form.price) {
      setError("Name and price are required.");
      return;
    }
    setSaving(true);
    try {
      let imageUrl = form.image_url;
      if (imageDataUrl) {
        const upRes = await fetch("/api/uploads", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: imageDataUrl }),
        });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error);
        imageUrl = upData.url;
      }

      const payload = {
        category_id: form.category_id,
        name: form.name.trim(),
        description: form.description,
        price: Number(form.price),
        discounted_price: form.discounted_price ? Number(form.discounted_price) : null,
        is_veg: !!form.is_veg,
        spice_level: form.spice_level,
        prep_time_minutes: Number(form.prep_time_minutes) || 15,
        is_popular: !!form.is_popular,
        is_recommended: !!form.is_recommended,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        allergens: form.allergens.split(",").map((t) => t.trim()).filter(Boolean),
        image_url: imageUrl,
      };

      const url = isEdit ? `/api/admin/${restaurant.slug}/menu-items/${item.id}` : `/api/admin/${restaurant.slug}/menu-items`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.item);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-paper rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink mb-4">{isEdit ? "Edit item" : "Add menu item"}</h3>

        <div className="grid gap-3">
          <label className="flex items-center gap-3 border border-dashed border-ink/25 rounded-card p-3 cursor-pointer">
            {imagePreview ? (
              <img src={imagePreview} className="w-14 h-14 rounded-lg object-cover" alt="" />
            ) : (
              <span className="w-14 h-14 rounded-lg bg-clay-light flex items-center justify-center"><Camera size={22} className="text-clay" /></span>
            )}
            <span className="text-xs text-clay">Upload a photo (optional — falls back to a monogram tile)</span>
            <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
          </label>

          <Field label="Category">
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white"
            >
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <Field label="Name"><Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹)"><Input type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} /></Field>
            <Field label="Discounted price (optional)"><Input type="number" value={form.discounted_price} onChange={(v) => setForm({ ...form, discounted_price: v })} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Veg / Non-veg">
              <select value={form.is_veg ? "1" : "0"} onChange={(e) => setForm({ ...form, is_veg: e.target.value === "1" })} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white">
                <option value="1">Vegetarian</option>
                <option value="0">Non-vegetarian</option>
              </select>
            </Field>
            <Field label="Spice level">
              <select value={form.spice_level} onChange={(e) => setForm({ ...form, spice_level: e.target.value })} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white">
                {SPICE_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prep time (minutes)"><Input type="number" value={form.prep_time_minutes} onChange={(v) => setForm({ ...form, prep_time_minutes: v })} /></Field>
            <Field label="Tags (comma-separated)"><Input value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} placeholder="popular, budget" /></Field>
          </div>

          <Field label="Allergens (comma-separated)"><Input value={form.allergens} onChange={(v) => setForm({ ...form, allergens: v })} placeholder="nuts, dairy" /></Field>

          <div className="flex gap-5">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={!!form.is_popular} onChange={(e) => setForm({ ...form, is_popular: e.target.checked })} /> Popular badge
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={!!form.is_recommended} onChange={(e) => setForm({ ...form, is_recommended: e.target.checked })} /> Recommended
            </label>
          </div>
        </div>

        {error && <p className="text-xs text-chili-dark font-medium mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-ink/15 text-ink font-semibold py-2.5 rounded-card">Cancel</button>
          <button disabled={saving} onClick={save} className="flex-1 bg-chili text-white font-semibold py-2.5 rounded-card disabled:opacity-60">
            {saving ? "Saving..." : isEdit ? "Save changes" : "Add item"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink mb-1">{label}</label>
      {children}
    </div>
  );
}
function Input({ value, onChange, type = "text", placeholder }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white"
    />
  );
}

// ---------- Offers ----------

function OffersTab({ restaurant, offers, setOffers, askConfirm }) {
  const [showForm, setShowForm] = useState(false);

  async function toggleActive(offer) {
    const res = await fetch(`/api/admin/${restaurant.slug}/offers/${offer.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: offer.active ? 0 : 1 }),
    });
    if (res.ok) setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, active: offer.active ? 0 : 1 } : o)));
  }

  async function deleteOffer(offer) {
    askConfirm(`Delete offer "${offer.title}"?`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/offers/${offer.id}`, { method: "DELETE" });
      if (res.ok) {
        setOffers((prev) => prev.filter((o) => o.id !== offer.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this offer.");
      }
    });
  }

  return (
    <div>
      <button onClick={() => setShowForm(true)} className="mb-5 bg-ink text-paper px-4 py-2 rounded-card text-sm font-semibold">
        + Create offer
      </button>

      <div className="grid gap-3">
        {offers.length === 0 && <p className="text-clay text-sm">No offers yet.</p>}
        {offers.map((o) => (
          <Card key={o.id} className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">{o.title}</p>
              <p className="text-xs text-clay mt-1">
                {o.discount_type === "percent" ? `${o.discount_value}% off` : `${money(o.discount_value, restaurant.currency)} off`}
                {" "}on orders above {money(o.min_order_value, restaurant.currency)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => toggleActive(o)} className={`text-xs font-semibold px-3 py-1 rounded-full ${o.active ? "bg-herb/15 text-herb" : "bg-clay-light text-clay"}`}>
                {o.active ? "Active" : "Paused"}
              </button>
              <button onClick={() => deleteOffer(o)} className="text-xs font-semibold text-chili-dark">Delete</button>
            </div>
          </Card>
        ))}
      </div>

      {showForm && (
        <OfferFormModal
          restaurant={restaurant}
          onClose={() => setShowForm(false)}
          onSaved={(offer) => { setOffers((prev) => [...prev, offer]); setShowForm(false); }}
        />
      )}
    </div>
  );
}

function OfferFormModal({ restaurant, onClose, onSaved }) {
  const [form, setForm] = useState({ title: "", description: "", discount_type: "percent", discount_value: "", min_order_value: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.title.trim() || !form.discount_value) { setError("Title and discount value are required."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}/offers`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.offer);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-paper rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink mb-4">Create offer</h3>
        <div className="grid gap-3">
          <Field label="Title"><Input value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="10% OFF on orders above ₹500" /></Field>
          <Field label="Description (optional)"><Input value={form.description} onChange={(v) => setForm({ ...form, description: v })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount type">
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white">
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat amount (₹)</option>
              </select>
            </Field>
            <Field label="Discount value"><Input type="number" value={form.discount_value} onChange={(v) => setForm({ ...form, discount_value: v })} /></Field>
          </div>
          <Field label="Minimum order value (₹)"><Input type="number" value={form.min_order_value} onChange={(v) => setForm({ ...form, min_order_value: v })} /></Field>
        </div>
        {error && <p className="text-xs text-chili-dark font-medium mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-ink/15 text-ink font-semibold py-2.5 rounded-card">Cancel</button>
          <button disabled={saving} onClick={save} className="flex-1 bg-chili text-white font-semibold py-2.5 rounded-card disabled:opacity-60">
            {saving ? "Saving..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Campaigns (Instagram / video feedback) ----------

function CampaignsTab({ restaurant, campaigns, setCampaigns, reviews, setReviews, askConfirm }) {
  const [showForm, setShowForm] = useState(false);

  async function toggleActive(c) {
    const res = await fetch(`/api/admin/${restaurant.slug}/campaigns/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: c.active ? 0 : 1 }),
    });
    if (res.ok) setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: c.active ? 0 : 1 } : x)));
  }
  async function deleteCampaign(c) {
    askConfirm(`Delete campaign "${c.title}"?`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/campaigns/${c.id}`, { method: "DELETE" });
      if (res.ok) {
        setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this campaign.");
      }
    });
  }
  async function deleteReview(r) {
    askConfirm("Delete this submission? This removes the video/feedback record permanently.", async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/reviews/${r.id}`, { method: "DELETE" });
      if (res.ok) {
        setReviews((prev) => prev.filter((x) => x.id !== r.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this submission.");
      }
    });
  }

  return (
    <div>
      <p className="text-sm text-clay mb-4 max-w-lg">
        At checkout, customers can complete a quick video-feedback campaign for a discount that
        applies immediately to their current order. Only one active campaign shows at a time.
      </p>
      <button onClick={() => setShowForm(true)} className="mb-5 bg-ink text-paper px-4 py-2 rounded-card text-sm font-semibold hover:bg-ink/90 transition-colors">
        + Create campaign
      </button>

      <div className="grid gap-3 mb-8">
        {campaigns.length === 0 && <p className="text-clay text-sm">No campaigns yet.</p>}
        {campaigns.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2.5">
                <Video size={17} className="text-chili-dark mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-ink">{c.title}</p>
                  <p className="text-xs text-clay mt-1">{c.description}</p>
                  <p className="text-xs text-clay mt-1">
                    {c.discount_type === "percent" ? `${c.discount_value}% off` : `${money(c.discount_value, restaurant.currency)} off`} this order
                    {c.requires_video ? " · video required" : " · video optional"}
                    {c.allow_instagram_repost ? " · Instagram reuse allowed (with separate consent)" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={() => toggleActive(c)} className={`text-xs font-semibold px-3 py-1 rounded-full ${c.active ? "bg-herb/15 text-herb" : "bg-clay-light text-clay"}`}>
                  {c.active ? "Active" : "Paused"}
                </button>
                <button onClick={() => deleteCampaign(c)} className="text-xs font-semibold text-chili-dark">Delete</button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <h3 className="font-display font-bold text-ink mb-2.5">Submissions</h3>
      <div className="grid gap-2">
        {reviews.length === 0 && <p className="text-clay text-sm">No submissions yet.</p>}
        {reviews.map((r) => (
          <Card key={r.id} className="p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={14} className={n <= (r.rating || 0) ? "fill-turmeric text-turmeric" : "text-clay-light"} />
                ))}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-clay">{r.discount_code}</span>
                <button onClick={() => deleteReview(r)} className="text-xs font-semibold text-chili-dark">Delete</button>
              </div>
            </div>
            {r.text_feedback && <p className="text-xs text-ink/70 mt-1.5">{r.text_feedback}</p>}
            {r.video_url && (
              <a href={r.video_url} target="_blank" rel="noreferrer" className="text-xs text-chili font-medium mt-1.5 inline-flex items-center gap-1">
                <Video size={12} /> View video
              </a>
            )}
          </Card>
        ))}
      </div>

      {showForm && (
        <CampaignFormModal
          restaurant={restaurant}
          onClose={() => setShowForm(false)}
          onSaved={(c) => { setCampaigns((prev) => [...prev, c]); setShowForm(false); }}
        />
      )}
    </div>
  );
}

function CampaignFormModal({ restaurant, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: "Share a video, get a discount",
    description: "Post a quick video about your food experience and get a discount on your next visit.",
    discount_type: "percent", discount_value: "10",
    requires_video: true, allow_instagram_repost: false,
    terms_text: "We're asking for honest feedback, not a positive review. Your video/photo may be used internally to improve our food and service.",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.title.trim() || !form.discount_value) { setError("Title and discount value are required."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}/campaigns`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.campaign);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-paper rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink mb-4">Create video feedback campaign</h3>
        <div className="grid gap-3">
          <Field label="Title"><Input value={form.title} onChange={(v) => setForm({ ...form, title: v })} /></Field>
          <Field label="Description shown to customers">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount type">
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white">
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat amount (₹)</option>
              </select>
            </Field>
            <Field label="Discount value"><Input type="number" value={form.discount_value} onChange={(v) => setForm({ ...form, discount_value: v })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.requires_video} onChange={(e) => setForm({ ...form, requires_video: e.target.checked })} /> Require a video (uncheck to also allow text-only feedback)
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.allow_instagram_repost} onChange={(e) => setForm({ ...form, allow_instagram_repost: e.target.checked })} /> Ask for separate permission to repost on Instagram
          </label>
          <Field label="Terms shown to customers before they participate">
            <textarea value={form.terms_text} onChange={(e) => setForm({ ...form, terms_text: e.target.value })} rows={3} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white" />
          </Field>
        </div>
        {error && <p className="text-xs text-chili-dark font-medium mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-ink/15 text-ink font-semibold py-2.5 rounded-card">Cancel</button>
          <button disabled={saving} onClick={save} className="flex-1 bg-chili text-white font-semibold py-2.5 rounded-card disabled:opacity-60">
            {saving ? "Saving..." : "Create campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Taxes ----------

function TaxesTab({ restaurant, taxes, setTaxes, askConfirm }) {
  const [name, setName] = useState("");
  const [percent, setPercent] = useState("");
  const [type, setType] = useState("percent"); // "percent" | "fixed"
  const [error, setError] = useState("");

  const activePercentTotal = taxes.filter((t) => t.active && (t.type || "percent") === "percent").reduce((s, t) => s + t.percent, 0);
  const activeFixedTotal = taxes.filter((t) => t.active && t.type === "fixed").reduce((s, t) => s + t.percent, 0);

  async function addTax() {
    setError("");
    if (!name.trim() || percent === "") { setError("Enter a name and amount."); return; }
    const res = await fetch(`/api/admin/${restaurant.slug}/taxes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), percent: Number(percent), type }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setTaxes((prev) => [...prev, data.tax]);
    setName(""); setPercent(""); setType("percent");
  }

  async function toggleActive(tax) {
    const res = await fetch(`/api/admin/${restaurant.slug}/taxes/${tax.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: tax.active ? 0 : 1 }),
    });
    if (res.ok) setTaxes((prev) => prev.map((t) => (t.id === tax.id ? { ...t, active: tax.active ? 0 : 1 } : t)));
  }

  async function updatePercent(tax, newPercent) {
    setTaxes((prev) => prev.map((t) => (t.id === tax.id ? { ...t, percent: newPercent } : t)));
  }
  async function savePercent(tax) {
    await fetch(`/api/admin/${restaurant.slug}/taxes/${tax.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ percent: Number(tax.percent) }),
    });
  }

  async function deleteTax(tax) {
    askConfirm(`Delete tax "${tax.name}"?`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/taxes/${tax.id}`, { method: "DELETE" });
      if (res.ok) {
        setTaxes((prev) => prev.filter((t) => t.id !== tax.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this tax.");
      }
    });
  }

  return (
    <div className="max-w-lg">
      <p className="text-sm text-ink/70 mb-4">
        Add as many taxes or charges as you need (GST, service charge, packaging fee, etc). Every
        <strong> active</strong> tax below is added to the customer's bill at checkout — shown as a
        separate line each. A tax can be a <strong>percentage</strong> of the order (like GST) or a{" "}
        <strong>flat ₹ amount</strong> added once per order (like a packaging charge). Currently
        active taxes add{" "}
        {activePercentTotal > 0 && <strong>{activePercentTotal}%</strong>}
        {activePercentTotal > 0 && activeFixedTotal > 0 && " + "}
        {activeFixedTotal > 0 && <strong>₹{activeFixedTotal}</strong>}
        {activePercentTotal === 0 && activeFixedTotal === 0 && <strong>nothing</strong>} to every order.
      </p>

      <div className="grid gap-2 mb-6">
        {taxes.length === 0 && <p className="text-clay text-sm">No taxes configured yet — orders will show 0% tax until you add one.</p>}
        {taxes.map((t) => (
          <Card key={t.id} className="p-3.5 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold text-ink text-sm">{t.name}</p>
              <p className="text-xs text-clay">{t.type === "fixed" ? "Flat amount" : "Percentage"}</p>
            </div>
            {t.type === "fixed" && <span className="text-xs text-clay">₹</span>}
            <input
              type="number"
              value={t.percent}
              onChange={(e) => updatePercent(t, e.target.value)}
              onBlur={() => savePercent(t)}
              className="w-20 border border-ink/15 rounded-card px-2 py-1.5 text-sm text-right"
            />
            {t.type !== "fixed" && <span className="text-xs text-clay">%</span>}
            <button onClick={() => toggleActive(t)} className={`text-xs font-semibold px-3 py-1 rounded-full ${t.active ? "bg-herb/15 text-herb" : "bg-clay-light text-clay"}`}>
              {t.active ? "Active" : "Off"}
            </button>
            <button onClick={() => deleteTax(t)} className="text-xs font-semibold text-chili-dark">Delete</button>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <p className="text-sm font-semibold text-ink mb-2.5">Add a tax or charge</p>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setType("percent")}
            className={`flex-1 text-xs font-semibold py-2 rounded-card border ${type === "percent" ? "bg-chili text-white border-chili" : "border-ink/15 text-ink/70"}`}
          >
            Percentage (%)
          </button>
          <button
            type="button"
            onClick={() => setType("fixed")}
            className={`flex-1 text-xs font-semibold py-2 rounded-card border ${type === "fixed" ? "bg-chili text-white border-chili" : "border-ink/15 text-ink/70"}`}
          >
            Flat amount (₹)
          </button>
        </div>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GST, Packaging charge" className="flex-1 border border-ink/15 rounded-card px-3 py-2 text-sm bg-white" />
          <input
            type="number"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            placeholder={type === "fixed" ? "₹15" : "%"}
            className="w-24 border border-ink/15 rounded-card px-3 py-2 text-sm bg-white"
          />
          <button onClick={addTax} className="bg-chili text-white px-4 rounded-card text-sm font-semibold">Add</button>
        </div>
        {error && <p className="text-xs text-chili-dark font-medium mt-2">{error}</p>}
      </Card>
    </div>
  );
}

// ---------- Customer View ----------

function CustomerViewTab({ restaurant, tables, onRestaurantUpdate }) {
  const activeTables = tables.filter((t) => t.active);
  const [selectedTableNumber, setSelectedTableNumber] = useState(activeTables[0]?.table_number || tables[0]?.table_number || null);
  const [reloadKey, setReloadKey] = useState(0);

  const [logoPreview, setLogoPreview] = useState(restaurant.logo_image_url || null);
  const [coverPreview, setCoverPreview] = useState(restaurant.cover_image_url || null);
  const [tagline, setTagline] = useState(restaurant.tagline || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  async function uploadAndSet(file, kind) {
    const dataUrl = await fileToDataUrl(file);
    if (kind === "logo") setLogoPreview(dataUrl);
    else setCoverPreview(dataUrl);

    setProfileError("");
    try {
      const upRes = await fetch("/api/uploads", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }),
      });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error);

      const patch = kind === "logo" ? { logo_image_url: upData.url } : { cover_image_url: upData.url };
      const res = await fetch(`/api/admin/${restaurant.slug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      onRestaurantUpdate?.(data.restaurant);
      setProfileSaved(true);
      setReloadKey((k) => k + 1);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e) {
      setProfileError(e.message);
    }
  }

  async function saveTagline() {
    setSavingProfile(true);
    setProfileError("");
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tagline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      onRestaurantUpdate?.(data.restaurant);
      setProfileSaved(true);
      setReloadKey((k) => k + 1);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e) {
      setProfileError(e.message);
    } finally {
      setSavingProfile(false);
    }
  }

  const profileSection = (
    <div className="bg-white border border-ink/10 rounded-2xl p-5 mb-5 max-w-2xl">
      <p className="text-sm font-semibold text-ink mb-1">Welcome screen — logo & background</p>
      <p className="text-xs text-clay mb-4">
        This is exactly what customers see the moment they scan your table QR code, before the
        menu loads. The cover photo fills the entire screen as the background — upload one so it's
        not just a plain color.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex flex-col items-center gap-2 border border-dashed border-ink/25 rounded-card p-4 cursor-pointer hover:border-chili/50 transition-colors">
          {logoPreview ? (
            <img src={logoPreview} className="w-16 h-16 rounded-xl object-cover" alt="" />
          ) : (
            <span className="w-16 h-16 rounded-xl bg-clay-light flex items-center justify-center"><Camera size={22} className="text-clay" /></span>
          )}
          <span className="text-xs text-clay text-center">Logo (small square, shown at the top)</span>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadAndSet(e.target.files[0], "logo")} className="hidden" />
        </label>
        <label className="flex flex-col items-center gap-2 border border-dashed border-ink/25 rounded-card p-4 cursor-pointer hover:border-chili/50 transition-colors">
          {coverPreview ? (
            <img src={coverPreview} className="w-full h-16 rounded-xl object-cover" alt="" />
          ) : (
            <span className="w-full h-16 rounded-xl bg-clay-light flex items-center justify-center"><Camera size={22} className="text-clay" /></span>
          )}
          <span className="text-xs text-clay text-center">Full-screen background photo</span>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadAndSet(e.target.files[0], "cover")} className="hidden" />
        </label>
      </div>
      <div className="mt-4">
        <label className="block text-xs font-semibold text-ink mb-1.5">Tagline (shown under your name)</label>
        <div className="flex gap-2">
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Discover today's delicious specials."
            className="flex-1 border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white"
          />
          <button
            onClick={saveTagline}
            disabled={savingProfile}
            className="bg-chili hover:bg-chili-dark disabled:opacity-60 transition-colors text-white font-semibold px-4 rounded-card text-sm"
          >
            Save
          </button>
        </div>
      </div>
      {profileError && <p className="text-xs text-chili-dark font-medium mt-2">{profileError}</p>}
      {profileSaved && <p className="text-xs text-herb font-medium mt-2">Saved — reflected in the preview below.</p>}
    </div>
  );

  if (tables.length === 0) {
    return (
      <div className="max-w-md">
        {profileSection}
        <p className="text-sm text-ink/70">
          This is exactly what your customers see when they scan a table's QR code. You haven't
          added any tables yet — go to the <strong>Tables & QR</strong> tab to add your first one,
          then come back here to see it live.
        </p>
      </div>
    );
  }

  const previewUrl = `/r/${restaurant.slug}/table/${selectedTableNumber}`;

  return (
    <div>
      {profileSection}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-ink">Live customer view</p>
          <p className="text-xs text-clay">This is a real, working preview — not a mockup.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedTableNumber || ""}
            onChange={(e) => { setSelectedTableNumber(e.target.value); setReloadKey((k) => k + 1); }}
            className="text-sm border border-ink/15 rounded-card px-2.5 py-1.5 bg-white"
          >
            {tables.map((t) => (
              <option key={t.id} value={t.table_number}>Table {t.table_number}{t.active ? "" : " (inactive)"}</option>
            ))}
          </select>
          <button onClick={() => setReloadKey((k) => k + 1)} className="text-xs font-semibold text-chili px-2">
            Reload
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold bg-ink text-paper px-3.5 py-2 rounded-full"
          >
            Open in new tab ↗
          </a>
        </div>
      </div>

      <div className="bg-ink rounded-[2rem] p-3 max-w-sm mx-auto shadow-xl">
        <div className="bg-paper rounded-[1.5rem] overflow-hidden" style={{ height: "70vh" }}>
          <iframe key={reloadKey} src={previewUrl} title="Customer view" className="w-full h-full border-0" />
        </div>
      </div>
    </div>
  );
}

// ---------- Tables & QR ----------

function TablesTab({ restaurant, tables, setTables }) {
  const [newTableNumber, setNewTableNumber] = useState("");

  async function addTable() {
    if (!newTableNumber.trim()) return;
    const res = await fetch(`/api/admin/${restaurant.slug}/tables`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table_number: newTableNumber.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setTables((prev) => [...prev, data.table]);
      setNewTableNumber("");
    }
  }
  async function toggleActive(table) {
    const res = await fetch(`/api/admin/${restaurant.slug}/tables/${table.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: table.active ? 0 : 1 }),
    });
    if (res.ok) setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, active: table.active ? 0 : 1 } : t)));
  }

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <input value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} placeholder="Table number, e.g. 7" className="border border-ink/15 rounded-card px-3.5 py-2 text-sm bg-white" />
        <button onClick={addTable} className="bg-ink text-paper px-4 rounded-card text-sm font-semibold">Add table</button>
      </div>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {tables.map((t) => (
          <Card key={t.id} className="p-4 text-center">
            <img src={`/api/admin/${restaurant.slug}/tables/${t.id}/qr`} alt={`QR for table ${t.table_number}`} className="w-32 h-32 mx-auto" />
            <p className="font-semibold text-ink mt-2">Table {t.table_number}</p>
            <p className="text-xs text-clay">/r/{restaurant.slug}/table/{t.table_number}</p>
            <div className="flex items-center justify-center gap-3 mt-2">
              <a href={`/r/${restaurant.slug}/table/${t.table_number}`} target="_blank" rel="noreferrer" className="text-xs text-ink/60 font-semibold">Preview</a>
              <a href={`/api/admin/${restaurant.slug}/tables/${t.id}/qr?download=1`} className="text-xs text-chili font-semibold">Download</a>
              <button onClick={() => toggleActive(t)} className="text-xs text-clay font-medium">{t.active ? "Deactivate" : "Activate"}</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Payment settings ----------

function PaymentSettingsTab({ restaurant, paymentSettings }) {
  const [upiId, setUpiId] = useState(paymentSettings?.upi_id || "");
  const [qrPreview, setQrPreview] = useState(paymentSettings?.phonepe_qr_image_url || null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleQrImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setQrDataUrl(dataUrl);
    setQrPreview(dataUrl);
  }

  async function save() {
    setSaving(true);
    try {
      let qrUrl = paymentSettings?.phonepe_qr_image_url || "";
      if (qrDataUrl) {
        const upRes = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: qrDataUrl }) });
        const upData = await upRes.json();
        if (upRes.ok) qrUrl = upData.url;
      }
      const res = await fetch(`/api/admin/${restaurant.slug}/payment-settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ upi_id: upiId, phonepe_qr_image_url: qrUrl }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-md">
      <p className="text-sm text-ink/70 mb-4">
        Upload your PhonePe / UPI QR code image so customers can scan it directly at checkout.
        Payments go straight to your account — TableServe doesn't process them, so remember to
        confirm each "pending" payment on the Orders tab once you've verified it in your UPI app.
      </p>
      <label className="block text-sm font-semibold text-ink mb-1">UPI ID (shown as backup text)</label>
      <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourrestaurant@upi" className="w-full border border-ink/15 rounded-card px-3.5 py-2 text-sm bg-white mb-4" />

      <label className="block text-sm font-semibold text-ink mb-1">QR code image</label>
      <label className="flex items-center gap-3 border border-dashed border-ink/25 rounded-card p-3 cursor-pointer mb-4">
        {qrPreview ? <img src={qrPreview} className="w-16 h-16 rounded-lg object-cover" alt="" /> : <span className="w-16 h-16 rounded-lg bg-clay-light flex items-center justify-center"><QrCode size={24} className="text-clay" /></span>}
        <span className="text-xs text-clay">Upload a screenshot of your PhonePe/UPI QR code</span>
        <input type="file" accept="image/*" onChange={handleQrImage} className="hidden" />
      </label>

      <button disabled={saving} onClick={save} className="bg-chili text-white px-5 py-2.5 rounded-card text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5">
        {saving ? "Saving..." : saved ? (<><Check size={15} /> Saved</>) : "Save"}
      </button>
    </div>
  );
}

// ---------- Billing ----------

function BillingTab({ restaurant, subscription, platformContact, orders, paymentProofs, setPaymentProofs }) {
  const [amountClaimed, setAmountClaimed] = useState("");
  const [note, setNote] = useState("");
  const [proofType, setProofType] = useState("subscription"); // "subscription" | "platform_fee"
  const [proofPreview, setProofPreview] = useState(null);
  const [proofDataUrl, setProofDataUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadDone, setUploadDone] = useState(false);

  // "This month's amount due" = the flat monthly subscription fee, PLUS
  // every per-order platform fee that hasn't been settled/collected yet.
  // Computed straight from the live `orders` list (already polling every
  // 2s), using the settled flag joined into each order — so it updates
  // within seconds of an order being placed or deleted, no page refresh
  // needed, and never resets to 0 on its own.
  const platformFeeEnabled = subscription ? subscription.platform_fee_enabled !== 0 : true;
  const platformFeesOwed = useMemo(() => {
    return orders.reduce((sum, o) => {
      if (o.platform_fee_settled) return sum;
      return sum + (o.platform_fee || 0);
    }, 0);
  }, [orders]);

  if (!subscription) return <p className="text-clay text-sm">No subscription record yet.</p>;

  const subscriptionAmountDue = Math.round(subscription.onboarding_paid ? subscription.monthly_fee : subscription.onboarding_fee);

  // Shows a "you paid successfully" confirmation the moment we acknowledge
  // a subscription payment proof, for as long as it's within the current
  // billing cycle (it clears again once a new cycle starts without a new
  // confirmed payment).
  const paidThisCycle =
    subscription.last_payment_confirmed_at &&
    (!subscription.billing_cycle_start || parseDbDate(subscription.last_payment_confirmed_at) >= parseDbDate(subscription.billing_cycle_start));

  async function handleProofImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setProofDataUrl(dataUrl);
    setProofPreview(dataUrl);
  }

  async function submitProof() {
    if (!proofDataUrl) {
      setUploadError("Please attach a screenshot of your payment first.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}/payment-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: proofDataUrl, amountClaimed: amountClaimed || null, note, type: proofType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit payment proof.");
      setPaymentProofs((prev) => [data.proof, ...prev]);
      setProofPreview(null);
      setProofDataUrl(null);
      setAmountClaimed("");
      setNote("");
      setProofType("subscription");
      setUploadDone(true);
      setTimeout(() => setUploadDone(false), 3000);
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-md grid gap-5">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="font-display font-bold text-ink">{subscription.plan_name} plan</p>
          <StatusPill status={restaurant.status} />
        </div>
        <div className="mt-4 grid gap-2 text-sm">
          <Row label="Onboarding fee" value={`₹${subscription.onboarding_fee} (${subscription.onboarding_paid ? "paid" : "pending"})`} />
          <Row label="Monthly fee" value={`₹${subscription.monthly_fee}/month`} />
          <Row label="Current cycle" value={`${subscription.billing_cycle_start} → ${subscription.billing_cycle_end}`} />
          <Row label="Grace period" value={`${subscription.grace_period_days} days after due date`} />
        </div>
        <div className="mt-4 pt-4 border-t border-ink/10 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Subscription due now</span>
          <span className="font-display text-xl font-bold text-chili-dark">₹{subscriptionAmountDue}</span>
        </div>
        {paidThisCycle && (
          <p className="text-xs font-semibold text-herb mt-3 bg-herb/10 rounded-card px-3 py-2">
            ✓ You paid successfully this month — thank you!
          </p>
        )}
      </Card>

      <Card className="p-5 text-center">
        <p className="font-semibold text-ink text-sm mb-3">Pay your subscription anytime</p>
        {platformContact?.phonepe_qr_image_url ? (
          <img src={platformContact.phonepe_qr_image_url} alt="Pay via UPI" className="w-36 h-36 mx-auto rounded-lg" />
        ) : (
          <div className="w-36 h-36 mx-auto rounded-lg bg-paper border border-dashed border-ink/20 flex items-center justify-center text-xs text-clay px-4">
            QR not available yet
          </div>
        )}
        <p className="text-sm font-semibold text-ink mt-3">₹{subscriptionAmountDue} due</p>
        {platformContact?.phone && (
          <p className="text-xs text-clay mt-1">Or call/WhatsApp {platformContact.phone}</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-ink text-sm">Platform fees</p>
          {!platformFeeEnabled && (
            <span className="text-xs font-semibold bg-herb/15 text-herb px-2.5 py-1 rounded-full">Waived for you</span>
          )}
        </div>

        {platformFeeEnabled ? (
          <>
            <p className="text-xs text-clay mt-1.5 mb-3">
              This is separate from your subscription above — it's the small per-order fee already
              built into what your customers pay you. It updates live as orders come in and is
              paid to us separately, whenever you're ready.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold text-ink">Platform fees owed</span>
              <span className="font-display text-xl font-bold text-chili-dark">₹{Math.round(platformFeesOwed)}</span>
            </div>
            {platformFeesOwed > 0 && (
              <div className="mt-4 pt-4 border-t border-ink/10 text-center">
                {platformContact?.phonepe_qr_image_url ? (
                  <img src={platformContact.phonepe_qr_image_url} alt="Pay via UPI" className="w-28 h-28 mx-auto rounded-lg" />
                ) : (
                  <div className="w-28 h-28 mx-auto rounded-lg bg-paper border border-dashed border-ink/20 flex items-center justify-center text-xs text-clay px-3">
                    QR not available yet
                  </div>
                )}
                {platformContact?.phone && (
                  <p className="text-xs text-clay mt-2">Or call/WhatsApp {platformContact.phone}</p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-clay mt-1.5">
            Platform fees have been switched off for your account — your customers won't be
            charged the extra per-order fee, and nothing accrues here.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <p className="font-semibold text-ink text-sm mb-1">Submit proof of payment</p>
        <p className="text-xs text-clay mb-3">
          After paying, upload a screenshot here — it appears instantly on our side with the date and
          time, so we can confirm and activate your account without you needing to message us separately.
        </p>
        <label className="flex items-center gap-3 border border-dashed border-ink/25 rounded-card p-3 cursor-pointer hover:border-chili/50 transition-colors">
          {proofPreview ? (
            <img src={proofPreview} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" alt="" />
          ) : (
            <span className="w-14 h-14 rounded-lg bg-clay-light flex items-center justify-center flex-shrink-0">
              <Upload size={20} className="text-clay" />
            </span>
          )}
          <span className="text-xs text-clay">Click to upload your payment screenshot</span>
          <input type="file" accept="image/*" onChange={handleProofImage} className="hidden" />
        </label>

        <div className="mt-3">
          <label className="block text-xs font-semibold text-ink mb-1.5">What is this payment for?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setProofType("subscription")}
              className={`flex-1 text-xs font-semibold py-2 rounded-card border ${proofType === "subscription" ? "bg-chili text-white border-chili" : "border-ink/15 text-ink/70"}`}
            >
              Subscription
            </button>
            <button
              type="button"
              onClick={() => setProofType("platform_fee")}
              className={`flex-1 text-xs font-semibold py-2 rounded-card border ${proofType === "platform_fee" ? "bg-chili text-white border-chili" : "border-ink/15 text-ink/70"}`}
            >
              Platform fee
            </button>
          </div>
        </div>
        <input
          type="number"
          value={amountClaimed}
          onChange={(e) => setAmountClaimed(e.target.value)}
          placeholder="Amount paid (optional)"
          className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white mt-3"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reference / note (optional)"
          rows={2}
          className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white mt-2"
        />
        {uploadError && <p className="text-xs text-chili-dark font-medium mt-2">{uploadError}</p>}
        <button
          onClick={submitProof}
          disabled={uploading}
          className="bg-chili hover:bg-chili-dark disabled:opacity-60 transition-colors text-white font-semibold px-5 py-2.5 rounded-card text-sm mt-3 w-full"
        >
          {uploading ? "Submitting..." : uploadDone ? "Submitted ✓" : "Submit payment proof"}
        </button>

        {paymentProofs.length > 0 && (
          <div className="mt-5 pt-4 border-t border-ink/10 grid gap-2">
            <p className="text-xs font-semibold text-ink">Your past submissions</p>
            {paymentProofs.map((p) => (
              <div key={p.id} className="flex items-center gap-3 text-xs">
                <img src={p.image_url} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt="" />
                <div className="flex-1">
                  <p className="text-ink font-medium">
                    {p.amount_claimed ? `₹${p.amount_claimed}` : "Payment proof"}
                    <span className="text-clay font-normal"> · {p.type === "platform_fee" ? "platform fee" : "subscription"}</span>
                  </p>
                  <p className="text-clay">{parseDbDate(p.created_at).toLocaleString()}</p>
                </div>
                <span className={`font-semibold px-2 py-1 rounded-full ${p.status === "acknowledged" ? "bg-herb/15 text-herb" : "bg-turmeric/25 text-chili-dark"}`}>
                  {p.status === "acknowledged" ? "Confirmed" : "Pending review"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-ink/70">
      <span>{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
