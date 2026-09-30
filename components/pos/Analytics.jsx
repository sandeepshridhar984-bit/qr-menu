"use client";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Receipt, IndianRupee, Wallet, Percent } from "lucide-react";
import { Card, PageTitle, money } from "./shared";

const RANGES = [["today", "Today"], ["week", "Last 7 days"], ["month", "This month"], ["3m", "Last 3 months"], ["year", "Last year"]];
const PREV = { today: "yesterday", week: "previous 7 days", month: "last month", "3m": "previous 3 months", year: "the year before" };
const hourName = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const short = (n) => (n >= 10000000 ? `${(n / 10000000).toFixed(1)}Cr` : n >= 100000 ? `${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n)));

export default function Analytics({ restaurant }) {
  const [range, setRange] = useState("week");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    async function load() {
      const off = -new Date().getTimezoneOffset();
      try {
        const res = await fetch(`/api/admin/${restaurant.slug}/analytics?range=${range}&offset=${off}`);
        const d = await res.json();
        if (!live) return;
        if (!res.ok) throw new Error(d.error);
        setData(d); setError("");
      } catch (e) { if (live) setError(e.message || "Could not load analytics."); }
      finally { if (live) setLoading(false); }
    }
    setLoading(true); load();
    const t = setInterval(load, 30000);
    return () => { live = false; clearInterval(t); };
  }, [range, restaurant.slug]);

  const k = data?.kpis;
  const delta = k && k.prevRevenue > 0 ? ((k.revenue - k.prevRevenue) / k.prevRevenue) * 100 : null;

  return (
    <div>
      <PageTitle title="Analytics" subtitle="How your business is doing. Counts paid bills only."
        right={
          <div className="flex bg-white border border-ink/10 rounded-full p-1 overflow-x-auto no-scrollbar max-w-full">
            {RANGES.map(([v, n]) => (
              <button key={v} onClick={() => setRange(v)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${range === v ? "bg-sprout text-white" : "text-ink/60 hover:text-ink"}`}>{n}</button>
            ))}
          </div>
        } />

      {error && <p className="text-sm text-chili-dark mb-3">{error}</p>}
      {!data ? <p className="text-sm text-clay">{loading ? "Loading…" : ""}</p> : (
        <div className={`grid gap-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi icon={IndianRupee} label="Revenue" value={money(k.revenue)}
              sub={delta === null ? `No sales in ${PREV[range]}` : <span className={`inline-flex items-center gap-1 font-semibold ${delta >= 0 ? "text-sprout-dark" : "text-chili-dark"}`}>{delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(delta).toFixed(0)}% vs {PREV[range]}</span>} />
            <Kpi icon={Receipt} label="Bills" value={k.orders} sub={`${k.prevOrders} in ${PREV[range]}`} />
            <Kpi icon={Wallet} label="Average bill" value={money(k.avg)} sub="Revenue ÷ bills" />
            <Kpi icon={Percent} label="Tax collected" value={money(k.tax)} sub={k.discount ? `${money(k.discount)} discounts given` : "GST etc. included in revenue"} />
          </div>

          <Card className="p-5">
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-1">
              <h3 className="font-display font-bold text-ink">Revenue</h3>
              <p className="text-xs text-clay">{data.from} to {data.to}</p>
            </div>
            <BarChart buckets={data.buckets} />
          </Card>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="p-5">
              <h3 className="font-display font-bold text-ink mb-3">Cash vs online</h3>
              <Split cash={k.cash} online={k.online} />
              {data.peakHour !== null && <p className="text-xs text-clay mt-4">Busiest hour: <b className="text-ink">{hourName(data.peakHour)}</b></p>}
            </Card>
            <Card className="p-5">
              <h3 className="font-display font-bold text-ink mb-3">Top selling items</h3>
              {data.topItems.length === 0 ? <p className="text-sm text-clay">No sales yet.</p> : <Bars rows={data.topItems.map((t) => ({ name: t.name, value: t.qty, right: `${t.qty} sold` }))} />}
            </Card>
            <Card className="p-5">
              <h3 className="font-display font-bold text-ink mb-3">Sales by category</h3>
              {data.categories.length === 0 ? <p className="text-sm text-clay">No sales yet.</p> : <Bars rows={data.categories.map((c) => ({ name: c.name, value: c.amount, right: money(c.amount) }))} />}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-clay text-xs font-semibold mb-1.5"><Icon size={14} /> {label}</div>
      <p className="font-display text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-clay mt-1">{sub}</p>
    </Card>
  );
}

function BarChart({ buckets }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...buckets.map((b) => b.revenue), 1);
  const W = 720, H = 220, padL = 42, padB = 26, padT = 12;
  const iw = W - padL - 8, ih = H - padB - padT;
  const bw = iw / buckets.length;
  const every = Math.ceil(buckets.length / 12);
  const nice = (m) => { const p = Math.pow(10, Math.floor(Math.log10(m))); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
  const top = nice(max);
  const total = buckets.reduce((s, b) => s + b.revenue, 0);
  if (total === 0) return <p className="text-sm text-clay py-10 text-center">No paid bills in this period yet.</p>;
  const h = hover !== null ? buckets[hover] : null;

  return (
    <div className="relative overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label="Revenue chart">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = padT + ih - ih * f;
          return <g key={f}><line x1={padL} x2={W - 8} y1={y} y2={y} stroke="#20261F" strokeOpacity="0.08" /><text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#8C7B63">{short(top * f)}</text></g>;
        })}
        {buckets.map((b, i) => {
          const bh = (b.revenue / top) * ih;
          const x = padL + i * bw + bw * 0.16;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
              <rect x={padL + i * bw} y={padT} width={bw} height={ih} fill="transparent" />
              <rect x={x} y={padT + ih - bh} width={bw * 0.68} height={Math.max(bh, b.revenue > 0 ? 2 : 0)} rx="3" fill={hover === i ? "#2E7D53" : "#43A06D"} />
              {i % every === 0 && <text x={padL + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#8C7B63">{b.label}</text>}
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-clay mt-1 h-4">{h ? <><b className="text-ink">{h.label}</b>: {money(h.revenue)} from {h.orders} bill{h.orders === 1 ? "" : "s"}</> : "Hover or tap a bar for details"}</p>
    </div>
  );
}

function Split({ cash, online }) {
  const t = cash + online;
  if (!t) return <p className="text-sm text-clay">No sales yet.</p>;
  const cp = (cash / t) * 100;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-ink/10">
        <div style={{ width: `${cp}%` }} className="bg-turmeric" /><div style={{ width: `${100 - cp}%` }} className="bg-sprout" />
      </div>
      <div className="grid gap-2 mt-3 text-sm">
        <div className="flex justify-between"><span className="inline-flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-turmeric" /> Cash</span><b>{money(cash)} <span className="text-clay font-normal text-xs">({cp.toFixed(0)}%)</span></b></div>
        <div className="flex justify-between"><span className="inline-flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-sprout" /> Online</span><b>{money(online)} <span className="text-clay font-normal text-xs">({(100 - cp).toFixed(0)}%)</span></b></div>
      </div>
    </div>
  );
}

function Bars({ rows }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="grid gap-2.5">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="flex justify-between text-xs mb-1"><span className="text-ink truncate pr-2">{r.name}</span><span className="text-clay whitespace-nowrap">{r.right}</span></div>
          <div className="h-1.5 rounded-full bg-ink/10"><div className="h-full rounded-full bg-sprout" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
