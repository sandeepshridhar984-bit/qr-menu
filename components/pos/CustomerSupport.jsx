"use client";
import { useEffect, useState } from "react";
import { Phone, Mail, Send, CheckCircle2, Clock, LifeBuoy } from "lucide-react";
import { Card, PageTitle, TextField } from "./shared";
import { fmtDateTime } from "@/lib/receiptPrint";

const CATS = [["billing", "Billing / payment"], ["printer", "Printer / receipt"], ["menu", "Menu / items"], ["gst", "GST / tax"], ["account", "Account"], ["other", "Something else"]];
const STATUS = {
  open: { label: "Open", cls: "bg-turmeric/25 text-chili-dark" },
  in_progress: { label: "In progress", cls: "bg-sprout/15 text-sprout-dark" },
  resolved: { label: "Resolved", cls: "bg-ink/10 text-ink/60" },
};

export default function CustomerSupport({ restaurant, platformContact }) {
  const [tickets, setTickets] = useState([]);
  const [contact, setContact] = useState(platformContact || {});
  const [form, setForm] = useState({ category: "billing", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/${restaurant.slug}/support`);
    if (res.ok) { const d = await res.json(); setTickets(d.tickets); if (d.contact) setContact(d.contact); }
  }
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); /* eslint-disable-next-line */ }, []);

  async function submit() {
    setSending(true); setError("");
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}/support`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTickets((p) => [data.ticket, ...p]);
      setForm({ category: form.category, subject: "", message: "" });
      setSent(true); setTimeout(() => setSent(false), 3000);
    } catch (e) { setError(e.message || "Could not send."); }
    finally { setSending(false); }
  }

  return (
    <div>
      <PageTitle title="Customer Support" subtitle="Having a problem? Tell us here and we'll get back to you." />
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="grid gap-6">
          <Card className="p-5">
            <h3 className="font-display font-bold text-ink mb-3 flex items-center gap-2"><LifeBuoy size={17} /> Raise a problem</h3>
            <div className="grid gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">What is it about?</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white">
                  {CATS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              </div>
              <TextField label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="Short summary" maxLength={120} />
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Describe the problem</label>
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} maxLength={2000}
                  placeholder="What happened? What did you expect?" className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white" />
              </div>
              {error && <p className="text-xs text-chili-dark">{error}</p>}
              <button onClick={submit} disabled={sending} className="bg-sprout text-white font-bold px-5 py-2.5 rounded-card text-sm w-fit inline-flex items-center gap-2 disabled:opacity-50">
                {sent ? <><CheckCircle2 size={15} /> Sent</> : <><Send size={15} /> {sending ? "Sending…" : "Submit"}</>}
              </button>
            </div>
          </Card>

          <div>
            <h3 className="font-display font-bold text-ink mb-3">Your requests</h3>
            {tickets.length === 0 ? <Card className="p-6 text-sm text-clay text-center">No requests yet.</Card> : (
              <div className="grid gap-3">
                {tickets.map((t) => {
                  const st = STATUS[t.status] || STATUS.open;
                  return (
                    <Card key={t.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink text-sm">{t.subject}</p>
                          <p className="text-[11px] text-clay flex items-center gap-1 mt-0.5"><Clock size={11} /> {fmtDateTime(t.created_at)}</p>
                        </div>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="text-sm text-ink/70 mt-2 whitespace-pre-wrap">{t.message}</p>
                      {t.admin_reply && (
                        <div className="mt-3 bg-sprout/10 border border-sprout/25 rounded-card p-3">
                          <p className="text-[11px] font-semibold text-sprout-dark mb-0.5">Reply from support</p>
                          <p className="text-sm text-ink whitespace-pre-wrap">{t.admin_reply}</p>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <Card className="p-5 lg:sticky lg:top-6">
          <h3 className="font-display font-bold text-ink mb-1">Talk to us directly</h3>
          <p className="text-xs text-clay mb-4">For anything urgent, call or email.</p>
          <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-sprout/10 text-sprout-dark flex items-center justify-center"><Phone size={16} /></span>
              <div><p className="text-[11px] text-clay">Phone</p>
                {contact.phone ? <a href={`tel:${contact.phone}`} className="text-sm font-semibold text-ink">{contact.phone}</a> : <p className="text-sm text-clay">Not available yet</p>}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-sprout/10 text-sprout-dark flex items-center justify-center"><Mail size={16} /></span>
              <div className="min-w-0"><p className="text-[11px] text-clay">Email</p>
                {contact.email ? <a href={`mailto:${contact.email}`} className="text-sm font-semibold text-ink break-all">{contact.email}</a> : <p className="text-sm text-clay">Not available yet</p>}</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
