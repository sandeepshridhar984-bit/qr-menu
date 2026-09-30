"use client";
import { useMemo, useState } from "react";
import { Banknote, Smartphone, Printer, Receipt as ReceiptIcon, Trash2, CheckCircle2 } from "lucide-react";
import { Card, Modal, PageTitle, money } from "./shared";
import { loadPrinterSettings, printReceipt, buildReceiptHtml, fmtDateTime, payLabel } from "@/lib/receiptPrint";

// Client-side preview only; the server recomputes the real numbers.
function previewBill(subtotal, discount, taxes) {
  const d = Math.min(Math.max(Math.round(discount || 0), 0), subtotal);
  const taxable = subtotal - d;
  const lines = taxes.filter((t) => t.active !== 0).map((t) => ({
    name: t.name, type: t.type || "percent", percent: t.percent,
    amount: Math.round(t.type === "fixed" ? t.percent : (taxable * t.percent) / 100),
  }));
  const tax = lines.reduce((s, l) => s + l.amount, 0);
  return { discount: d, lines, total: taxable + tax };
}

export default function MyOrders({ restaurant, orders, setOrders, taxes, askConfirm }) {
  const pending = useMemo(
    () => orders.filter((o) => o.source === "offline" && !o.payment_method).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
    [orders]
  );
  const [billed, setBilled] = useState(null); // order whose receipt is showing

  return (
    <div>
      <PageTitle title="My Orders" subtitle="Orders waiting for payment. Pick Cash or Online, confirm, and the receipt is ready." />
      {pending.length === 0 ? (
        <Card className="p-10 text-center">
          <ReceiptIcon size={30} className="mx-auto text-clay mb-2" />
          <p className="font-semibold text-ink">No orders waiting for payment</p>
          <p className="text-sm text-clay mt-1">Place an order from Offline Menu and it will show up here.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
          {pending.map((o) => (
            <PendingCard key={o.id} order={o} restaurant={restaurant} taxes={taxes} askConfirm={askConfirm}
              setOrders={setOrders} onBilled={setBilled} />
          ))}
        </div>
      )}
      {billed && <ReceiptModal order={billed} restaurant={restaurant} onClose={() => setBilled(null)} />}
    </div>
  );
}

function PendingCard({ order, restaurant, taxes, setOrders, onBilled, askConfirm }) {
  const [method, setMethod] = useState("cash");
  const [discount, setDiscount] = useState("");
  const [receiptOn, setReceiptOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bill = previewBill(order.subtotal, Number(discount) || 0, taxes);
  const label = order.customer_note || "Counter";

  async function confirm() {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}/pos/orders/${order.order_number}/pay`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method, discount: Number(discount) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders((prev) => prev.map((o) => (o.id === data.order.id ? { ...o, ...data.order } : o)));
      // Receipt is prepared silently. Nothing about the printer is shown
      // here; the actual printing happens only on the Print button.
      if (receiptOn) {
        onBilled(data.order);
        const p = loadPrinterSettings();
        if (p.autoPrint) printReceipt(data.order, restaurant, p).catch(() => {});
      }
    } catch (e) { setError(e.message || "Could not confirm payment."); }
    finally { setBusy(false); }
  }

  function cancel() {
    askConfirm(`Cancel order ${order.order_number}? It will be deleted.`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/orders/${order.order_number}`, { method: "DELETE" });
      if (res.ok) setOrders((prev) => prev.filter((o) => o.id !== order.id));
    });
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-ink text-sm">{order.order_number}</p>
          <p className="text-xs text-clay">{label}{order.customer_name ? ` · ${order.customer_name}` : ""} · {fmtDateTime(order.created_at)}</p>
        </div>
        <button onClick={cancel} className="text-clay hover:text-chili-dark" title="Cancel order"><Trash2 size={15} /></button>
      </div>

      <div className="mt-3 grid gap-1 text-sm border-y border-dashed border-ink/15 py-2.5">
        {order.items.map((it) => (
          <div key={it.id} className="flex justify-between gap-2">
            <span className="text-ink">{it.quantity} × {it.name}</span>
            <span className="text-ink/70">{money(it.quantity * it.unit_price)}</span>
          </div>
        ))}
      </div>

      <div className="mt-2.5 grid gap-1 text-sm">
        <Row l="Subtotal" v={money(order.subtotal)} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink/70">Discount (₹)</span>
          <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0"
            className="w-20 text-right border border-ink/15 rounded-lg px-2 py-1 text-sm bg-white" />
        </div>
        {bill.lines.map((t) => <Row key={t.name} l={`${t.name}${t.type === "percent" ? ` (${t.percent}%)` : ""}`} v={money(t.amount)} />)}
        {bill.lines.length === 0 && <p className="text-[11px] text-clay">No tax set. Add GST in the Taxes tab.</p>}
        <div className="flex justify-between font-bold text-ink text-base border-t border-ink/10 pt-1.5 mt-1">
          <span>Total</span><span>{money(bill.total)}</span>
        </div>
      </div>

      <p className="text-xs font-semibold text-ink mt-3 mb-1.5">Payment</p>
      <div className="grid grid-cols-2 gap-2">
        {[["cash", "Cash", Banknote], ["online_upi", "Online", Smartphone]].map(([v, name, Icon]) => (
          <button key={v} onClick={() => setMethod(v)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-card border text-sm font-semibold transition-colors ${method === v ? "bg-sprout text-white border-sprout" : "bg-white text-ink/70 border-ink/15 hover:border-ink/30"}`}>
            <Icon size={16} /> {name}
          </button>
        ))}
      </div>

      {/* Highlighted receipt toggle */}
      <button onClick={() => setReceiptOn(!receiptOn)}
        className={`mt-3 w-full flex items-center justify-between rounded-card px-3.5 py-2.5 border-2 transition-colors ${receiptOn ? "bg-turmeric/15 border-turmeric" : "bg-white border-ink/15"}`}>
        <span className="flex items-center gap-2 text-sm font-bold text-ink"><ReceiptIcon size={16} /> Receipt</span>
        <span className={`relative w-11 h-6 rounded-full transition-colors ${receiptOn ? "bg-sprout" : "bg-ink/25"}`}>
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${receiptOn ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>

      {error && <p className="text-xs text-chili-dark mt-2">{error}</p>}
      <button onClick={confirm} disabled={busy}
        className="mt-3 w-full bg-ink text-paper font-bold py-2.5 rounded-card hover:bg-ink/90 disabled:opacity-50 inline-flex items-center justify-center gap-2">
        <CheckCircle2 size={16} /> {busy ? "Confirming…" : `Confirm ${method === "cash" ? "cash" : "online"} payment`}
      </button>
    </Card>
  );
}

function Row({ l, v }) {
  return <div className="flex justify-between"><span className="text-ink/70">{l}</span><span className="text-ink">{v}</span></div>;
}

// Shows the finished bill. The printer is only touched when the client
// presses "Print receipt".
export function ReceiptModal({ order, restaurant, onClose }) {
  const [state, setState] = useState("idle"); // idle | printing | done | error
  const [msg, setMsg] = useState("");
  const html = useMemo(() => buildReceiptHtml(order, restaurant, loadPrinterSettings().width), [order, restaurant]);

  async function print() {
    setState("printing"); setMsg("");
    try { await printReceipt(order, restaurant); setState("done"); }
    catch (e) { setState("error"); setMsg(e.message || "Could not print."); }
  }

  return (
    <Modal title="Bill ready" onClose={onClose} wide>
      <div className="flex items-center gap-2 bg-sprout/10 text-sprout-dark rounded-card px-3 py-2 text-sm font-semibold mb-3">
        <CheckCircle2 size={16} /> {payLabel(order.payment_method)} payment received · {money(order.total)}
      </div>
      <iframe title="Receipt" srcDoc={html} className="w-full bg-white border border-ink/10 rounded-xl" style={{ height: 380 }} />
      {state === "error" && <p className="text-xs text-chili-dark mt-2">{msg}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={print} disabled={state === "printing"}
          className="flex-1 bg-sprout text-white font-bold py-2.5 rounded-card inline-flex items-center justify-center gap-2 hover:bg-sprout-dark disabled:opacity-60">
          <Printer size={16} /> {state === "printing" ? "Sending…" : state === "done" ? "Print again" : "Print receipt"}
        </button>
        <button onClick={onClose} className="px-5 py-2.5 rounded-card border border-ink/15 text-sm font-semibold text-ink/70">Done</button>
      </div>
    </Modal>
  );
}
