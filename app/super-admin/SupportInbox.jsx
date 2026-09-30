"use client";
import { useEffect, useRef, useState } from "react";
import { LifeBuoy, Mail, Phone, Check } from "lucide-react";

const STATUS = { open: "Open", in_progress: "In progress", resolved: "Resolved" };
const badge = { open: "bg-turmeric/25 text-chili-dark", in_progress: "bg-sprout/15 text-sprout-dark", resolved: "bg-ink/10 text-ink/60" };

// Problems raised by clients from their Customer Support page, shown with
// the client's details so you know who to call or reply to.
export default function SupportInbox() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("active");
  const [loaded, setLoaded] = useState(false);
  const typing = useRef(false); // don't overwrite a reply while you're typing it

  async function load() {
    if (typing.current) return;
    const res = await fetch("/api/super-admin/support");
    if (res.ok) { setTickets((await res.json()).tickets); setLoaded(true); }
  }
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  const shown = tickets.filter((t) => (filter === "active" ? t.status !== "resolved" : filter === "all" ? true : t.status === filter));
  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <section>
      <div className="flex items-center gap-3 flex-wrap mb-1">
        <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2"><LifeBuoy size={18} /> Support tickets</h2>
        {openCount > 0 && <span className="text-xs font-bold bg-chili text-white px-2 py-0.5 rounded-full">{openCount} new</span>}
      </div>
      <p className="text-sm text-clay mb-3 max-w-xl">Problems your clients raise from their Customer Support page appear here with their details.</p>
      <div className="flex gap-2 mb-4 flex-wrap">
        {[["active", "Needs attention"], ["resolved", "Resolved"], ["all", "All"]].map(([v, n]) => (
          <button key={v} onClick={() => setFilter(v)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${filter === v ? "bg-ink text-paper border-ink" : "bg-white text-ink/60 border-ink/10"}`}>{n}</button>
        ))}
      </div>
      {!loaded ? <p className="text-sm text-clay">Loading…</p> : shown.length === 0 ? (
        <p className="text-sm text-clay bg-white border border-ink/10 rounded-2xl p-6 text-center max-w-2xl">No tickets here.</p>
      ) : (
        <div className="grid gap-3 max-w-3xl">
          {shown.map((t) => <Ticket key={t.id} t={t} typing={typing} onChange={(nt) => setTickets((p) => p.map((x) => (x.id === nt.id ? { ...x, ...nt } : x)))} />)}
        </div>
      )}
    </section>
  );
}

function Ticket({ t, onChange, typing }) {
  const [reply, setReply] = useState(t.admin_reply || "");
  const [saved, setSaved] = useState(false);

  async function patch(body) {
    const res = await fetch(`/api/super-admin/support/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { const d = await res.json(); onChange(d.ticket); setSaved(true); setTimeout(() => setSaved(false), 1500); }
  }

  return (
    <div className="bg-white border border-ink/10 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-ink text-sm">{t.subject} <span className="text-[11px] font-normal text-clay">· {t.category}</span></p>
          <p className="text-xs text-clay mt-0.5">{t.restaurant_name} · {new Date(t.created_at.replace(" ", "T") + "Z").toLocaleString()}</p>
        </div>
        <select value={t.status} onChange={(e) => patch({ status: e.target.value })} className={`text-xs font-semibold rounded-full px-3 py-1.5 border-0 ${badge[t.status]}`}>
          {Object.entries(STATUS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
      </div>
      <p className="text-sm text-ink/80 mt-2 whitespace-pre-wrap">{t.message}</p>
      <div className="flex gap-4 flex-wrap text-xs text-clay mt-2.5 pt-2.5 border-t border-ink/10">
        {t.restaurant_email && <a href={`mailto:${t.restaurant_email}`} className="inline-flex items-center gap-1 hover:text-ink"><Mail size={12} /> {t.restaurant_email}</a>}
        {t.restaurant_phone && <a href={`tel:${t.restaurant_phone}`} className="inline-flex items-center gap-1 hover:text-ink"><Phone size={12} /> {t.restaurant_phone}</a>}
        {t.restaurant_gst && <span>GST: {t.restaurant_gst}</span>}
        {t.restaurant_address && <span>{t.restaurant_address}</span>}
      </div>
      <textarea value={reply} rows={2} placeholder="Write a reply (the client sees it on their Support page)"
        onFocus={() => (typing.current = true)} onBlur={() => (typing.current = false)}
        onChange={(e) => setReply(e.target.value)}
        className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm mt-3" />
      <button onClick={() => patch({ admin_reply: reply, status: t.status === "open" && reply.trim() ? "in_progress" : t.status })}
        className="mt-2 bg-ink text-paper text-xs font-semibold px-4 py-2 rounded-card inline-flex items-center gap-1.5">
        {saved ? <><Check size={13} /> Saved</> : "Send reply"}
      </button>
    </div>
  );
}
