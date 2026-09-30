"use client";
import { useEffect, useState } from "react";
import { Printer, Bluetooth, Monitor, CheckCircle2, RefreshCw, Search } from "lucide-react";
import { Card, PageTitle, money } from "./shared";
import { ReceiptModal } from "./MyOrders";
import {
  loadPrinterSettings, savePrinterSettings, printReceipt, SAMPLE_ORDER, bluetoothSupported,
  connectBluetoothPrinter, bluetoothConnected, fmtDateTime, payLabel,
} from "@/lib/receiptPrint";

// Printer connection on top, billing history underneath.
export default function PrinterAndHistory({ restaurant }) {
  return (
    <div>
      <PageTitle title="Printer Connection" subtitle="Set up the receipt printer once on this device. Billing history is below." />
      <PrinterSection restaurant={restaurant} />
      <History restaurant={restaurant} />
    </div>
  );
}

function PrinterSection({ restaurant }) {
  const [s, setS] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setS(loadPrinterSettings()); }, []);
  if (!s) return null;

  const update = (patch) => { const n = { ...s, ...patch }; setS(n); savePrinterSettings(n); };

  async function connectBt() {
    setBusy(true); setStatus("");
    try { const name = await connectBluetoothPrinter(); update({ mode: "bluetooth", btName: name }); setStatus(`Connected to ${name}.`); }
    catch (e) { setStatus(e.message?.includes("cancelled") ? "Cancelled." : e.message || "Could not connect."); }
    finally { setBusy(false); }
  }

  async function testPrint() {
    setBusy(true); setStatus("");
    try { await printReceipt(SAMPLE_ORDER, restaurant, s); setStatus("Test receipt sent."); }
    catch (e) { setStatus(e.message || "Could not print."); }
    finally { setBusy(false); }
  }

  const opt = (active) => `text-left rounded-card border-2 p-3.5 transition-colors ${active ? "border-sprout bg-sprout/5" : "border-ink/10 bg-white hover:border-ink/25"}`;

  return (
    <Card className="p-5 mb-8">
      <p className="text-xs font-semibold text-ink mb-2">How is your printer connected?</p>
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <button onClick={() => update({ mode: "system" })} className={opt(s.mode === "system")}>
          <div className="flex items-center gap-2 font-bold text-sm text-ink"><Monitor size={16} /> Installed printer (USB / normal)</div>
          <p className="text-xs text-clay mt-1">Most hotels use this. The thermal printer is installed on this computer or phone, and receipts go to the default printer.</p>
        </button>
        <button onClick={() => update({ mode: "bluetooth" })} className={opt(s.mode === "bluetooth")}>
          <div className="flex items-center gap-2 font-bold text-sm text-ink"><Bluetooth size={16} /> Bluetooth thermal printer</div>
          <p className="text-xs text-clay mt-1">Pairs straight from the browser (Chrome / Edge). No driver needed.</p>
        </button>
      </div>

      {s.mode === "bluetooth" && (
        <div className="mb-5 bg-paper rounded-card p-3.5">
          {!bluetoothSupported() ? (
            <p className="text-xs text-chili-dark">This browser can't use Bluetooth printing. Use Chrome or Edge, or choose "Installed printer".</p>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={connectBt} disabled={busy} className="bg-ink text-paper text-sm font-semibold px-4 py-2 rounded-card inline-flex items-center gap-2 disabled:opacity-50">
                <Bluetooth size={15} /> {bluetoothConnected() ? "Reconnect" : "Find printer"}
              </button>
              <span className="text-xs text-clay">
                {bluetoothConnected() ? <span className="text-sprout-dark font-semibold inline-flex items-center gap-1"><CheckCircle2 size={13} /> {s.btName || "Connected"}</span> : s.btName ? `Last used: ${s.btName} (reconnect after refreshing the page)` : "Turn the printer on, then tap Find printer."}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-ink mb-1">Paper width</label>
          <select value={s.width} onChange={(e) => update({ width: Number(e.target.value) })} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white">
            <option value={80}>80 mm (most common)</option>
            <option value={58}>58 mm (small)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink mb-1">Copies</label>
          <select value={s.copies} onChange={(e) => update({ copies: Number(e.target.value) })} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white">
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-ink mt-5 cursor-pointer">
          <input type="checkbox" checked={s.autoPrint} onChange={(e) => update({ autoPrint: e.target.checked })} className="w-4 h-4" />
          Print automatically after payment
        </label>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={testPrint} disabled={busy} className="bg-sprout text-white font-semibold text-sm px-4 py-2 rounded-card inline-flex items-center gap-2 hover:bg-sprout-dark disabled:opacity-50">
          <Printer size={15} /> Print test receipt
        </button>
        {status && <span className="text-xs text-ink/70">{status}</span>}
      </div>
      {s.mode === "system" && (
        <p className="text-[11px] text-clay mt-3 max-w-xl">
          Tip: the browser normally asks you to confirm each print. For one-tap printing with no popup, open Chrome/Edge with the <code className="bg-paper px-1 rounded">--kiosk-printing</code> option and set the thermal printer as the default printer.
        </p>
      )}
      <p className="text-[11px] text-clay mt-2">These settings are saved on this device only.</p>
    </Card>
  );
}

function History({ restaurant }) {
  const [bills, setBills] = useState([]);
  const [date, setDate] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  async function load() {
    setLoading(true);
    const off = -new Date().getTimezoneOffset();
    const qs = date ? `?date=${date}&offset=${off}` : "";
    const res = await fetch(`/api/admin/${restaurant.slug}/pos/history${qs}`);
    if (res.ok) setBills((await res.json()).orders);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  const shown = bills.filter((b) => !q.trim() || b.order_number.toLowerCase().includes(q.trim().toLowerCase()) || (b.customer_name || "").toLowerCase().includes(q.trim().toLowerCase()));
  const total = shown.reduce((s, b) => s + b.total, 0);

  return (
    <div>
      <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="font-display text-xl font-bold text-ink">Billing history</h3>
          <p className="text-xs text-clay">{shown.length} bill{shown.length === 1 ? "" : "s"} · {money(total)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clay" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill no. or name" className="border border-ink/15 rounded-card pl-8 pr-3 py-2 text-sm bg-white w-44" />
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-ink/15 rounded-card px-3 py-2 text-sm bg-white" />
          {date && <button onClick={() => setDate("")} className="text-xs text-clay underline">All</button>}
          <button onClick={load} className="text-clay hover:text-ink" title="Refresh"><RefreshCw size={16} /></button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? <p className="p-6 text-sm text-clay">Loading…</p> : shown.length === 0 ? <p className="p-8 text-sm text-clay text-center">No bills found.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-xs text-clay text-left">
                <tr><th className="px-4 py-2.5 font-semibold">Bill</th><th className="px-4 py-2.5 font-semibold">Date</th><th className="px-4 py-2.5 font-semibold">For</th><th className="px-4 py-2.5 font-semibold">Payment</th><th className="px-4 py-2.5 font-semibold text-right">Total</th><th className="px-4 py-2.5" /></tr>
              </thead>
              <tbody>
                {shown.map((b) => (
                  <tr key={b.id} className="border-t border-ink/10">
                    <td className="px-4 py-2.5 font-semibold text-ink whitespace-nowrap">{b.order_number}</td>
                    <td className="px-4 py-2.5 text-ink/70 whitespace-nowrap">{fmtDateTime(b.paid_at || b.created_at)}</td>
                    <td className="px-4 py-2.5 text-ink/70">{b.customer_note || (b.table_number ? `Table ${b.table_number}` : "Counter")}{b.customer_name ? ` · ${b.customer_name}` : ""}</td>
                    <td className="px-4 py-2.5 text-ink/70">{payLabel(b.payment_method)}{b.payment_status !== "paid" && <span className="text-chili-dark text-xs ml-1">(unpaid)</span>}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{money(b.total)}</td>
                    <td className="px-4 py-2.5 text-right"><button onClick={() => setOpen(b)} className="text-xs font-semibold text-sprout-dark inline-flex items-center gap-1"><Printer size={13} /> Receipt</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {open && <ReceiptModal order={open} restaurant={restaurant} onClose={() => setOpen(null)} />}
    </div>
  );
}
