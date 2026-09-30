"use client";
import { useMemo, useState } from "react";
import { Search, Plus, Minus, ShoppingBag, Check } from "lucide-react";
import Monogram from "@/components/Monogram";
import { Card, PageTitle, VegDot, categoryVisual, money } from "./shared";

// Swiggy-style ordering screen for staff: round category icons on top,
// square item cards below, cart on the right.
export default function OfflineMenu({ restaurant, categories, items, setOrders, goToOrders }) {
  const [activeCat, setActiveCat] = useState("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState({}); // itemId -> qty
  const [label, setLabel] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null);

  const cats = categories.filter((c) => c.active !== 0);
  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const visible = items.filter((i) => {
    if (!cats.some((c) => c.id === i.category_id)) return false;
    if (activeCat !== "all" && i.category_id !== activeCat) return false;
    if (query.trim() && !i.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  }).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const price = (i) => i.discounted_price || i.price;
  const lines = Object.entries(cart).map(([id, qty]) => ({ item: itemById[id], qty })).filter((l) => l.item);
  const subtotal = lines.reduce((s, l) => s + price(l.item) * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const setQty = (id, qty) => setCart((c) => {
    const n = { ...c };
    if (qty <= 0) delete n[id]; else n[id] = Math.min(qty, 99);
    return n;
  });

  async function place() {
    setPlacing(true); setError("");
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}/pos/orders`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines.map((l) => ({ itemId: l.item.id, qty: l.qty })), label, customerName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders((prev) => [data.order, ...prev.filter((o) => o.id !== data.order.id)]);
      setPlaced(data.order);
      setCart({}); setLabel(""); setCustomerName("");
      setTimeout(() => setPlaced(null), 6000);
    } catch (e) { setError(e.message || "Could not place the order."); }
    finally { setPlacing(false); }
  }

  return (
    <div>
      <PageTitle title="Offline Menu" subtitle="Tap items to build the customer's order, then place it. Payment and the receipt happen in My Orders." />

      {/* What's on your mind? -- round category icons */}
      <div className="mb-6">
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {[{ id: "all", name: "All" }, ...cats].map((c) => {
            const on = activeCat === c.id;
            const vis = c.id === "all" ? null : categoryVisual(c, items);
            return (
              <button key={c.id} onClick={() => setActiveCat(c.id)} className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[84px]">
                <span className={`w-[76px] h-[76px] rounded-full overflow-hidden flex items-center justify-center bg-clay-light text-3xl transition-all ${on ? "ring-4 ring-sprout scale-105" : "ring-1 ring-ink/10 hover:ring-ink/30"}`}>
                  {c.id === "all" ? "🍽️" : vis.img ? <img src={vis.img} alt="" className="w-full h-full object-cover" /> : vis.emoji}
                </span>
                <span className={`text-xs text-center leading-tight ${on ? "font-bold text-sprout-dark" : "font-medium text-ink/70"}`}>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div>
          <div className="relative mb-4 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-clay" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dishes"
              className="w-full border border-ink/15 rounded-full pl-9 pr-3 py-2 text-sm bg-white" />
          </div>

          {visible.length === 0 ? (
            <Card className="p-8 text-center text-sm text-clay">
              {cats.length === 0 ? "No menu yet. Add categories and items in Menu Manager." : "No items match."}
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {visible.map((it) => {
                const qty = cart[it.id] || 0;
                const off = !it.available;
                return (
                  <div key={it.id} className={`bg-white border border-ink/10 rounded-2xl overflow-hidden shadow-sm flex flex-col ${off ? "opacity-50" : ""}`}>
                    <div className="aspect-square bg-clay-light relative">
                      {it.image_url ? <img src={it.image_url} alt="" className="w-full h-full object-cover" />
                        : <Monogram name={it.name} className="w-full h-full rounded-none text-4xl" />}
                      {off && <span className="absolute inset-0 bg-white/60 flex items-center justify-center text-xs font-bold text-ink">Unavailable</span>}
                      {/* ADD button floats over the photo's bottom edge, like Swiggy */}
                      {!off && (
                        <div className="absolute -bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
                          {qty === 0 ? (
                            <button onClick={() => setQty(it.id, 1)} className="bg-white text-sprout-dark border border-ink/15 shadow-md font-bold text-sm px-7 py-1.5 rounded-lg hover:bg-sprout/5">ADD</button>
                          ) : (
                            <div className="bg-sprout text-white shadow-md rounded-lg flex items-center font-bold text-sm">
                              <button onClick={() => setQty(it.id, qty - 1)} className="px-2.5 py-1.5" aria-label="Less"><Minus size={14} /></button>
                              <span className="w-6 text-center">{qty}</span>
                              <button onClick={() => setQty(it.id, qty + 1)} className="px-2.5 py-1.5" aria-label="More"><Plus size={14} /></button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="p-3 pt-6">
                      <div className="flex items-start gap-1.5">
                        <VegDot veg={!!it.is_veg} />
                        <p className="font-semibold text-ink text-sm leading-tight">{it.name}</p>
                      </div>
                      <p className="text-sm text-ink mt-1 font-medium">
                        {money(price(it))}
                        {it.discounted_price ? <span className="line-through text-clay text-xs ml-1.5">{money(it.price)}</span> : null}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart */}
        <div id="pos-cart" className="lg:sticky lg:top-6">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag size={17} className="text-sprout-dark" />
              <h3 className="font-display font-bold text-ink">Current order</h3>
              {count > 0 && <span className="ml-auto text-xs font-semibold bg-sprout/10 text-sprout-dark px-2 py-0.5 rounded-full">{count} items</span>}
            </div>

            {lines.length === 0 ? (
              <p className="text-sm text-clay py-6 text-center">Cart is empty. Tap ADD on a dish.</p>
            ) : (
              <div className="grid gap-2.5 mb-3 max-h-72 overflow-y-auto pr-1">
                {lines.map(({ item, qty }) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <VegDot veg={!!item.is_veg} />
                    <p className="flex-1 text-sm text-ink leading-tight">{item.name}</p>
                    <div className="border border-ink/15 rounded-lg flex items-center text-sprout-dark font-bold text-xs">
                      <button onClick={() => setQty(item.id, qty - 1)} className="px-1.5 py-1" aria-label="Less"><Minus size={12} /></button>
                      <span className="w-5 text-center">{qty}</span>
                      <button onClick={() => setQty(item.id, qty + 1)} className="px-1.5 py-1" aria-label="More"><Plus size={12} /></button>
                    </div>
                    <span className="w-14 text-right text-sm font-medium">{money(price(item) * qty)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-2 border-t border-ink/10 pt-3">
              <div className="flex gap-1.5 flex-wrap">
                {["Parcel", "Counter"].map((t) => (
                  <button key={t} onClick={() => setLabel(t)} className={`text-xs px-2.5 py-1 rounded-full border ${label === t ? "bg-sprout text-white border-sprout" : "border-ink/15 text-ink/60"}`}>{t}</button>
                ))}
              </div>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Table no. / token (optional)" maxLength={40}
                className="border border-ink/15 rounded-card px-3 py-2 text-sm bg-white" />
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name (optional)" maxLength={60}
                className="border border-ink/15 rounded-card px-3 py-2 text-sm bg-white" />
              <div className="flex justify-between text-sm font-semibold text-ink mt-1">
                <span>Subtotal</span><span>{money(subtotal)}</span>
              </div>
              <p className="text-[11px] text-clay">Tax (GST) is added when you take payment.</p>
              {error && <p className="text-xs text-chili-dark">{error}</p>}
              <button onClick={place} disabled={!lines.length || placing}
                className="bg-sprout text-white font-bold py-2.5 rounded-card disabled:opacity-40 hover:bg-sprout-dark transition-colors">
                {placing ? "Placing…" : "Place order"}
              </button>
            </div>
          </Card>

          {placed && (
            <div className="mt-3 bg-sprout/10 border border-sprout/30 rounded-2xl p-3.5 flex items-start gap-2.5 animate-pop-in">
              <Check size={18} className="text-sprout-dark mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-ink">Order {placed.order_number} placed</p>
                <button onClick={goToOrders} className="text-sprout-dark font-semibold underline text-xs">Go to My Orders to take payment</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phone: quick jump to the cart */}
      {count > 0 && (
        <a href="#pos-cart" className="lg:hidden fixed bottom-4 left-4 right-4 z-40 bg-sprout text-white rounded-2xl px-5 py-3 flex items-center justify-between shadow-xl font-semibold text-sm">
          <span>{count} item{count > 1 ? "s" : ""} · {money(subtotal)}</span><span>View order →</span>
        </a>
      )}
    </div>
  );
}
