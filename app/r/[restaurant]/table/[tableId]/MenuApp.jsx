"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Monogram from "@/components/Monogram";
import {
  Volume2, ArrowRight, Search, Sparkles, ShoppingCart, Minus, Plus,
  Star, Tag, Video, CheckCheck, Banknote, QrCode, CheckCircle2,
  ChevronLeft, X, UtensilsCrossed, Armchair, ChefHat, Instagram,
} from "lucide-react";

const FILTERS = [
  { key: "veg", label: "Vegetarian" },
  { key: "non-veg", label: "Non-veg" },
  { key: "spicy", label: "Spicy" },
  { key: "popular", label: "Popular" },
  { key: "budget", label: "Under ₹200" },
];

function money(n, currency = "INR") {
  const symbol = currency === "INR" ? "₹" : currency + " ";
  return `${symbol}${Math.round(n)}`;
}

export default function MenuApp({ restaurant, table, categories, items, offers, payment, campaign, taxes, platformFeeRate }) {
  const [sessionId] = useState(() => `sess_${Math.random().toString(36).slice(2)}`);
  const [view, setView] = useState("welcome");
  const [entered, setEntered] = useState(false);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [order, setOrder] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [paidClicked, setPaidClicked] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [campaignFeedback, setCampaignFeedback] = useState(null); // set once customer completes the campaign at checkout
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const subtotal = cart.reduce((s, c) => s + c.qty * c.price, 0);

  const eligibleOffers = useMemo(
    () => offers.filter((o) => subtotal >= o.min_order_value),
    [offers, subtotal]
  );

  const selectedOffer = eligibleOffers.find((o) => o.id === selectedOfferId) || null;

  // Mirrors the server's rounding exactly (see app/api/orders/route.js) so
  // what the customer sees here always matches what actually gets charged
  // — no surprise rupee differences between preview and receipt.
  const roundMoney = (n) => Math.round(n);

  const discount = roundMoney(
    campaignFeedback
      ? campaign.discount_type === "percent"
        ? (subtotal * campaign.discount_value) / 100
        : campaign.discount_value
      : selectedOffer
      ? selectedOffer.discount_type === "percent"
        ? (subtotal * selectedOffer.discount_value) / 100
        : selectedOffer.discount_value
      : 0
  );

  const taxable = Math.max(subtotal - discount, 0);
  const taxBreakdown = (taxes || []).map((t) => ({
    name: t.name,
    type: t.type || "percent",
    percent: t.percent,
    amount: roundMoney(t.type === "fixed" ? t.percent : (taxable * t.percent) / 100),
  }));
  const tax = taxBreakdown.reduce((s, t) => s + t.amount, 0);
  const platformFee = roundMoney(platformFeeRate || 0);
  const total = roundMoney(taxable + tax + platformFee);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (query && !it.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (activeCategory && it.category_id !== activeCategory && (query || filters.length)) {
        // when searching/filtering, ignore category tab restriction
      } else if (activeCategory && !query && filters.length === 0 && it.category_id !== activeCategory) {
        return false;
      }
      for (const f of filters) {
        if (f === "veg" && !it.is_veg) return false;
        if (f === "non-veg" && it.is_veg) return false;
        if (f === "spicy" && !(it.spice_level === "medium" || it.spice_level === "hot")) return false;
        if (f === "popular" && !it.is_popular) return false;
        if (f === "budget" && it.price >= 200) return false;
      }
      return true;
    });
  }, [items, query, filters, activeCategory]);

  function toggleFilter(key) {
    setFilters((f) => (f.includes(key) ? f.filter((x) => x !== key) : [...f, key]));
  }

  function addToCart(item, qty = 1, note = "") {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id && c.note === note);
      if (existing) {
        return prev.map((c) => (c === existing ? { ...c, qty: c.qty + qty } : c));
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          price: item.discounted_price || item.price,
          qty,
          note,
          imageUrl: item.image_url,
        },
      ];
    });
  }

  function updateQty(idx, delta) {
    setCart((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + delta };
      return next.filter((c) => c.qty > 0);
    });
  }

  async function placeOrder() {
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          tableId: table.id,
          items: cart,
          subtotal,
          offerId: campaignFeedback ? null : selectedOffer?.id || null,
          campaignId: campaignFeedback ? campaign.id : null,
          campaignFeedback: campaignFeedback || null,
          sessionId,
          paymentMethod: payMethod,
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server error (${res.status}). Please try again.`);
      }
      if (!res.ok) throw new Error(data.error || "Order failed");
      setOrder(data.order);
      setCart([]);
      setSelectedOfferId(null);
      setCampaignFeedback(null);
      setView("confirmation");
    } catch (e) {
      alert("Could not place order: " + e.message);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      {view === "welcome" && (
        <WelcomeScreen
          restaurant={restaurant}
          table={table}
          entered={entered}
          onEnter={() => {
            setEntered(true);
            setView("menu");
          }}
        />
      )}

      {view === "menu" && (
        <MenuScreen
          restaurant={restaurant}
          table={table}
          categories={categories}
          items={filteredItems}
          allItemsCount={items.length}
          query={query}
          setQuery={setQuery}
          filters={filters}
          toggleFilter={toggleFilter}
          activeCategory={activeCategory}
          setActiveCategory={(id) => {
            setActiveCategory(id);
            setQuery("");
            setFilters([]);
          }}
          offers={offers}
          onOpenItem={(it) => setSelectedItem(it)}
          onOpenAssistant={() => setAssistantOpen(true)}
          cartCount={cartCount}
          cartTotal={total}
          onOpenCart={() => setView("cart")}
        />
      )}

      {selectedItem && (
        <ItemDetail
          item={selectedItem}
          currency={restaurant.currency}
          onClose={() => setSelectedItem(null)}
          onAdd={(qty, note) => {
            addToCart(selectedItem, qty, note);
            setSelectedItem(null);
          }}
        />
      )}

      {assistantOpen && (
        <AssistantModal
          restaurantId={restaurant.id}
          items={items}
          currency={restaurant.currency}
          onClose={() => setAssistantOpen(false)}
          onAdd={(item) => addToCart(item, 1)}
        />
      )}

      {view === "cart" && (
        <CartScreen
          cart={cart}
          currency={restaurant.currency}
          subtotal={subtotal}
          eligibleOffers={eligibleOffers}
          selectedOfferId={selectedOfferId}
          onSelectOffer={(id) => { setSelectedOfferId(id); setCampaignFeedback(null); }}
          campaign={campaign}
          campaignFeedback={campaignFeedback}
          onRemoveCampaign={() => setCampaignFeedback(null)}
          onOpenCampaign={() => setCampaignModalOpen(true)}
          discount={discount}
          taxBreakdown={taxBreakdown}
          tax={tax}
          platformFee={platformFee}
          total={total}
          onBack={() => setView("menu")}
          onUpdateQty={updateQty}
          onCheckout={() => setView("checkout")}
        />
      )}

      {campaignModalOpen && campaign && (
        <CampaignModal
          campaign={campaign}
          onClose={() => setCampaignModalOpen(false)}
          onDone={(feedback) => {
            setCampaignFeedback(feedback);
            setSelectedOfferId(null);
            setCampaignModalOpen(false);
          }}
        />
      )}

      {view === "checkout" && (
          <CheckoutScreen
          currency={restaurant.currency}
          instagramUrl={restaurant.instagram_url}
          subtotal={subtotal}
          discount={discount}
          discountLabel={campaignFeedback ? "Campaign discount" : selectedOffer ? "Offer discount" : null}
          taxBreakdown={taxBreakdown}
          platformFee={platformFee}
          total={total}
          payMethod={payMethod}
          setPayMethod={setPayMethod}
          payment={payment}
          paidClicked={paidClicked}
          setPaidClicked={setPaidClicked}
          placing={placing}
          onBack={() => setView("cart")}
          onPlaceOrder={placeOrder}
        />
      )}

      {view === "confirmation" && order && (
        <ConfirmationScreen
          order={order}
          restaurant={restaurant}
          table={table}
          onNewOrder={() => setView("menu")}
        />
      )}
    </main>
  );
}

// ---------- Welcome ----------

function WelcomeScreen({ restaurant, table, onEnter }) {
  const hasCover = !!restaurant.cover_image_url;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden bg-ink">
      {hasCover ? (
        <>
          <img
            src={restaurant.cover_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/60 to-ink" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-ink via-[#1c2519] to-[#0f140e]" />
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-chili/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-turmeric/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.04] flex items-center justify-center select-none">
            <UtensilsCrossed size={280} strokeWidth={1} className="text-paper" />
          </div>
        </>
      )}

      <div className="relative z-10 animate-rise-in">
        {restaurant.logo_image_url ? (
          <img
            src={restaurant.logo_image_url}
            alt={restaurant.name}
            className="w-20 h-20 rounded-2xl object-cover mx-auto mb-5 shadow-xl ring-1 ring-white/10"
          />
        ) : (
          <div className="w-20 h-20 mx-auto mb-5 shadow-xl ring-1 ring-white/10 rounded-2xl overflow-hidden">
            <Monogram name={restaurant.name} size="lg" className="rounded-none text-3xl" />
          </div>
        )}
        <p className="text-turmeric tracking-[0.15em] uppercase text-xs font-semibold mb-3">Table {table.table_number}</p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-paper leading-[1.1]">
          Welcome to<br />{restaurant.name}
        </h1>
        <p className="mt-4 text-paper/60 max-w-xs mx-auto">
          {restaurant.tagline || "Discover today's delicious specials."}
        </p>
        <button
          onClick={onEnter}
          className="mt-10 bg-chili hover:bg-chili-dark transition-all hover:scale-[1.03] active:scale-[0.98] text-white font-semibold px-9 py-4 rounded-full shadow-lg shadow-chili/30 inline-flex items-center gap-2"
        >
          {restaurant.welcome_sound_enabled ? (
            <>Tap to Enter <Volume2 size={18} /></>
          ) : (
            <>Explore Menu <ArrowRight size={18} /></>
          )}
        </button>
      </div>
    </div>
  );
}

// ---------- Menu ----------

function MenuScreen({
  restaurant, table, categories, items, allItemsCount, query, setQuery,
  filters, toggleFilter, activeCategory, setActiveCategory, offers,
  onOpenItem, onOpenAssistant, cartCount, cartTotal, onOpenCart,
}) {
  return (
    <div className="pb-28">
      <div className="bg-white/90 backdrop-blur-md border-b border-ink/10 sticky top-0 z-20 shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-bold text-ink leading-tight">{restaurant.name}</p>
              <p className="text-xs text-clay">Table {table.table_number}</p>
            </div>
            {restaurant.logo_image_url ? (
              <img src={restaurant.logo_image_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
            ) : (
              <Monogram name={restaurant.name} size="sm" className="w-9 h-9 text-sm" />
            )}
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the menu..."
            className="mt-3 w-full bg-paper border border-ink/10 rounded-card px-4 py-2.5 text-sm outline-none focus:border-chili"
          />

          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => toggleFilter(f.key)}
                className={`whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  filters.includes(f.key)
                    ? "bg-chili text-white border-chili"
                    : "border-ink/15 text-ink/70"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {!query && filters.length === 0 && (
          <div className="flex gap-1 overflow-x-auto no-scrollbar px-4 pb-3">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`whitespace-nowrap text-sm font-medium px-3.5 py-1.5 rounded-full transition-colors ${
                  activeCategory === c.id ? "bg-ink text-paper" : "text-ink/60 hover:bg-ink/5"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {offers.length > 0 && (
        <div className="px-4 pt-4">
          {offers.map((o) => (
            <div key={o.id} className="bg-turmeric/15 border border-turmeric/30 rounded-card px-4 py-2.5 text-sm text-chili-dark font-medium mb-2 flex items-center gap-2">
              <Tag size={15} className="flex-shrink-0" /> {o.title}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 pt-4">
        <button
          onClick={onOpenAssistant}
          className="w-full bg-ink text-paper rounded-card px-4 py-3.5 flex items-center justify-center gap-2 font-semibold hover:bg-ink/90 transition-colors"
        >
          <Sparkles size={18} /> Help me choose
        </button>
      </div>

      <div className="px-4 pt-5 grid gap-3">
        {items.length === 0 && (
          <p className="text-center text-clay text-sm py-10">
            No dishes match right now — try a different search or filter.
          </p>
        )}
        {items.map((item) => (
          <MenuItemCard key={item.id} item={item} currency={restaurant.currency} onOpen={() => onOpenItem(item)} />
        ))}
      </div>

      {cartCount > 0 && (
        <button
          onClick={onOpenCart}
          className="fixed bottom-5 left-4 right-4 bg-chili text-white rounded-card px-5 py-3.5 flex items-center justify-between shadow-lg font-semibold z-30"
        >
          <span>{cartCount} item{cartCount > 1 ? "s" : ""} in cart</span>
          <span>{money(cartTotal, restaurant.currency)} · View cart</span>
        </button>
      )}
    </div>
  );
}

function MenuItemCard({ item, currency, onOpen }) {
  const hasDiscount = item.discounted_price && item.discounted_price < item.price;
  return (
    <button
      onClick={onOpen}
      className="text-left bg-white border border-ink/10 rounded-2xl p-3.5 flex gap-3 hover:border-chili/40 hover:shadow-md transition-all"
    >
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <Monogram name={item.name} size="md" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-ink text-sm">{item.name}</p>
          <VegDot veg={item.is_veg} />
        </div>
        <p className="text-xs text-clay mt-0.5 line-clamp-2">{item.description}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {hasDiscount ? (
            <>
              <span className="font-semibold text-ink text-sm">{money(item.discounted_price, currency)}</span>
              <span className="text-xs text-clay line-through">{money(item.price, currency)}</span>
            </>
          ) : (
            <span className="font-semibold text-ink text-sm">{money(item.price, currency)}</span>
          )}
          {item.is_popular ? <Badge label="Popular" tone="turmeric" /> : null}
          {(item.spice_level === "medium" || item.spice_level === "hot") ? (
            <Badge label={item.spice_level === "hot" ? "Very spicy" : "Spicy"} tone="chili" />
          ) : null}
        </div>
      </div>
    </button>
  );
}

function VegDot({ veg }) {
  return (
    <span
      className={`flex-shrink-0 w-4 h-4 border-2 rounded-[3px] flex items-center justify-center ${
        veg ? "border-herb" : "border-chili"
      }`}
      title={veg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${veg ? "bg-herb" : "bg-chili"}`} />
    </span>
  );
}

function Badge({ label, tone }) {
  const toneClasses = tone === "turmeric" ? "bg-turmeric/20 text-chili-dark" : "bg-chili/10 text-chili-dark";
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${toneClasses}`}>{label}</span>;
}

// ---------- Item Detail ----------

function ItemDetail({ item, currency, onClose, onAdd }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const price = item.discounted_price || item.price;

  return (
    <div className="fixed inset-0 z-40 bg-ink/50 flex items-end" onClick={onClose}>
      <div
        className="bg-paper w-full rounded-t-3xl max-h-[88vh] overflow-y-auto animate-rise-in"
        onClick={(e) => e.stopPropagation()}
      >
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="h-52 w-full object-cover" />
        ) : (
          <div className="h-40 border-b border-ink/10">
            <Monogram name={item.name} size="lg" className="rounded-none" />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-ink">{item.name}</h2>
            <VegDot veg={item.is_veg} />
          </div>
          <p className="text-ink/60 mt-1.5 text-sm">{item.description}</p>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="font-semibold text-lg text-ink">{money(price, currency)}</span>
            {item.discounted_price ? (
              <span className="text-sm text-clay line-through">{money(item.price, currency)}</span>
            ) : null}
            {item.is_popular ? <Badge label="Popular" tone="turmeric" /> : null}
            <Badge label={`${item.prep_time_minutes} min`} tone="chili" />
          </div>

          {JSON.parse(item.allergens || "[]").length > 0 && (
            <p className="text-xs text-clay mt-3">
              Allergens: {JSON.parse(item.allergens || "[]").join(", ")}
            </p>
          )}

          <div className="mt-5">
            <p className="text-sm font-semibold text-ink mb-1.5">Add a note (optional)</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {["Less spicy", "No onions", "Extra sauce"].map((s) => (
                <button
                  key={s}
                  onClick={() => setNote(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    note === s ? "bg-ink text-paper border-ink" : "border-ink/15 text-ink/70"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. no coriander"
              className="w-full bg-white border border-ink/10 rounded-card px-3.5 py-2 text-sm outline-none focus:border-chili"
            />
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center border border-ink/15 rounded-card">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3.5 py-2 text-lg">−</button>
              <span className="px-2 font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="px-3.5 py-2 text-lg">+</button>
            </div>
            <button
              onClick={() => onAdd(qty, note)}
              className="flex-1 bg-chili text-white font-semibold py-3 rounded-card"
            >
              Add {money(price * qty, currency)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- AI Assistant ----------

function AssistantModal({ restaurantId, items, currency, onClose, onAdd }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [added, setAdded] = useState({});

  const quickPrompts = [
    "I want something spicy",
    "Something under ₹250",
    "I'm very hungry",
    "Vegetarian and light",
  ];

  async function ask(text) {
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, query: text }),
      });
      const data = await res.json();
      setResults(data);
    } catch (e) {
      setResults({ message: "Couldn't get recommendations right now.", recommendations: [] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-end" onClick={onClose}>
      <div
        className="bg-paper w-full rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 animate-rise-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold text-ink flex items-center gap-2"><Sparkles size={20} /> Help me choose</h2>
          <button onClick={onClose} className="text-ink/50 hover:text-ink transition-colors p-1"><X size={20} /></button>
        </div>

        <div className="flex gap-2 flex-wrap mb-3">
          {quickPrompts.map((p) => (
            <button
              key={p}
              onClick={() => { setInput(p); ask(p); }}
              className="text-xs border border-ink/15 text-ink/70 px-3 py-1.5 rounded-full"
            >
              {p}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (input.trim()) ask(input); }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me what you're craving..."
            className="flex-1 bg-white border border-ink/10 rounded-card px-3.5 py-2.5 text-sm outline-none focus:border-chili"
          />
          <button type="submit" className="bg-ink text-paper px-4 rounded-card text-sm font-semibold">Ask</button>
        </form>

        <div className="mt-5">
          {loading && <p className="text-sm text-clay">Thinking about what's available right now...</p>}

          {results && (
            <>
              <p className="text-sm text-ink/70 mb-3">{results.message}</p>
              <div className="grid gap-3">
                {results.recommendations?.map((r) => (
                  <div key={r.item.id} className="bg-white border border-ink/10 rounded-card p-3.5 flex gap-3">
                    {r.item.image_url ? (
                      <img src={r.item.image_url} alt={r.item.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <Monogram name={r.item.name} size="sm" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-ink text-sm">{r.item.name}</p>
                        <span className="font-semibold text-sm text-ink">
                          {money(r.item.discounted_price || r.item.price, currency)}
                        </span>
                      </div>
                      <p className="text-xs text-clay mt-0.5">{r.reason}</p>
                      <button
                        onClick={() => { onAdd(r.item); setAdded((a) => ({ ...a, [r.item.id]: true })); }}
                        className="mt-2 text-xs font-semibold bg-chili/10 text-chili-dark px-3 py-1.5 rounded-full inline-flex items-center gap-1"
                      >
                        {added[r.item.id] ? (<><CheckCheck size={13} /> Added</>) : "Add to cart"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Cart ----------

function CartScreen({
  cart, currency, subtotal, eligibleOffers, selectedOfferId, onSelectOffer,
  campaign, campaignFeedback, onRemoveCampaign, onOpenCampaign,
  discount, taxBreakdown, tax, platformFee, total, onBack, onUpdateQty, onCheckout,
}) {
  return (
    <div className="min-h-screen pb-32">
      <div className="bg-white border-b border-ink/10 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-ink/60 flex items-center gap-1 hover:text-ink transition-colors"><ChevronLeft size={18} /> Back</button>
        <h1 className="font-display text-lg font-bold text-ink">Your order</h1>
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-20 px-6">
          <ShoppingCart size={40} className="text-clay-light mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-ink/60">Your cart is empty.</p>
          <button onClick={onBack} className="mt-4 text-chili font-semibold text-sm">Browse the menu</button>
        </div>
      ) : (
        <>
          <div className="px-4 pt-4 grid gap-2.5">
            {cart.map((c, idx) => (
              <div key={idx} className="bg-white border border-ink/10 rounded-card p-3.5 flex items-center gap-3">
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt={c.name} className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <Monogram name={c.name} size="sm" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink text-sm">{c.name}</p>
                  {c.note && <p className="text-xs text-clay">Note: {c.note}</p>}
                  <p className="text-xs text-clay">{money(c.price, currency)} each</p>
                </div>
                <div className="flex items-center border border-ink/15 rounded-card">
                  <button onClick={() => onUpdateQty(idx, -1)} className="px-2.5 py-1.5">−</button>
                  <span className="px-1.5 font-semibold text-sm">{c.qty}</span>
                  <button onClick={() => onUpdateQty(idx, 1)} className="px-2.5 py-1.5">+</button>
                </div>
              </div>
            ))}
          </div>

          {(eligibleOffers.length > 0 || campaign) && (
            <div className="px-4 mt-5">
              <p className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5"><Tag size={15} /> Deals for this order</p>
              <p className="text-xs text-clay mb-2 -mt-1">Pick at most one — offer or campaign, not both.</p>
              <div className="grid gap-2">
                {eligibleOffers.map((o) => {
                  const isSelected = selectedOfferId === o.id && !campaignFeedback;
                  return (
                    <button
                      key={o.id}
                      onClick={() => onSelectOffer(isSelected ? null : o.id)}
                      className={`text-left border rounded-card p-3.5 flex items-center justify-between gap-3 transition-colors ${
                        isSelected ? "border-chili bg-chili/5" : "border-ink/10 bg-white"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-ink text-sm">{o.title}</p>
                        <p className="text-xs text-clay mt-0.5">
                          {o.discount_type === "percent" ? `${o.discount_value}% off` : `${money(o.discount_value, currency)} off`}
                          {" "}· min order {money(o.min_order_value, currency)}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${isSelected ? "bg-chili text-white" : "bg-paper text-ink/60"}`}>
                        {isSelected ? (<span className="inline-flex items-center gap-1"><CheckCheck size={13} /> Applied</span>) : "Select"}
                      </span>
                    </button>
                  );
                })}

                {campaign && (
                  campaignFeedback ? (
                    <div className="text-left border border-herb bg-herb/5 rounded-card p-3.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink text-sm flex items-center gap-1.5"><Video size={15} /> {campaign.title}</p>
                        <p className="text-xs text-herb mt-0.5">
                          {campaign.discount_type === "percent" ? `${campaign.discount_value}% off` : `${money(campaign.discount_value, currency)} off`} applied
                        </p>
                      </div>
                      <button onClick={onRemoveCampaign} className="text-xs font-semibold text-clay flex-shrink-0">Remove</button>
                    </div>
                  ) : (
                    <button
                      onClick={onOpenCampaign}
                      className="text-left border border-ink/10 bg-white rounded-card p-3.5 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-ink text-sm flex items-center gap-1.5"><Video size={15} /> {campaign.title}</p>
                        <p className="text-xs text-clay mt-0.5">
                          {campaign.description || "Share a quick video review for a discount on this order."}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-paper text-ink/60 flex-shrink-0">Participate</span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          <div className="px-4 mt-5">
            <div className="bg-white border border-ink/10 rounded-card p-4 text-sm">
              <Row label="Subtotal" value={money(subtotal, currency)} />
              {discount > 0 && <Row label="Discount" value={"− " + money(discount, currency)} />}
              {taxBreakdown.map((t) => (
                <Row key={t.name} label={`${t.name} (${t.type === "fixed" ? "flat" : t.percent + "%"})`} value={money(t.amount, currency)} />
              ))}
              {platformFee > 0 && <Row label="Platform fee" value={money(platformFee, currency)} />}
              <div className="border-t border-ink/10 my-2" />
              <Row label="Total" value={money(total, currency)} bold />
            </div>
          </div>

          <button
            onClick={onCheckout}
            className="fixed bottom-5 left-4 right-4 bg-chili text-white rounded-card px-5 py-3.5 font-semibold"
          >
            Proceed to checkout · {money(total, currency)}
          </button>
        </>
      )}
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex items-center justify-between py-1 ${bold ? "font-bold text-ink text-base" : "text-ink/70"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ---------- Checkout ----------

function CheckoutScreen({ currency, instagramUrl, subtotal, discount, discountLabel, taxBreakdown, platformFee, total, payMethod, setPayMethod, payment, paidClicked, setPaidClicked, placing, onBack, onPlaceOrder }) {
  const canPlace = payMethod === "cash" || (payMethod === "online_upi" && paidClicked);

  return (
    <div className="min-h-screen pb-32">
      <div className="bg-white border-b border-ink/10 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-ink/60 flex items-center gap-1 hover:text-ink transition-colors"><ChevronLeft size={18} /> Back</button>
        <h1 className="font-display text-lg font-bold text-ink">Checkout</h1>
      </div>

      <div className="px-4 pt-5">
        <div className="bg-white border border-ink/10 rounded-card p-4 text-sm mb-5">
          <Row label="Subtotal" value={money(subtotal, currency)} />
          {discount > 0 && <Row label={discountLabel || "Discount"} value={"− " + money(discount, currency)} />}
          {taxBreakdown.map((t) => (
            <Row key={t.name} label={`${t.name} (${t.type === "fixed" ? "flat" : t.percent + "%"})`} value={money(t.amount, currency)} />
          ))}
          {platformFee > 0 && <Row label="Platform fee" value={money(platformFee, currency)} />}
          <div className="border-t border-ink/10 my-2" />
          <Row label="Total to pay" value={money(total, currency)} bold />
        </div>

        {instagramUrl && (
          
           <a href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 border border-ink/10 bg-white rounded-card p-3.5 mb-5 text-sm font-semibold text-ink hover:border-chili/40 transition-colors"
          >
            <Instagram size={18} className="text-chili" />
            Follow us on Instagram
          </a>
        )}

        <p className="text-sm font-semibold text-ink mb-2">How would you like to pay?</p>
        <div className="grid gap-2.5">
          {payment.cash_enabled && (
            <button
              onClick={() => setPayMethod("cash")}
              className={`text-left border rounded-card p-4 flex items-center justify-between ${
                payMethod === "cash" ? "border-chili bg-chili/5" : "border-ink/10 bg-white"
              }`}
            >
              <div>
                <p className="font-semibold text-ink text-sm">Pay with cash</p>
                <p className="text-xs text-clay">Pay at the table when your order arrives.</p>
              </div>
              <Banknote size={22} className="text-herb flex-shrink-0" />
            </button>
          )}

          {payment.online_enabled && (
            <button
              onClick={() => setPayMethod("online_upi")}
              className={`text-left border rounded-card p-4 flex items-center justify-between ${
                payMethod === "online_upi" ? "border-chili bg-chili/5" : "border-ink/10 bg-white"
              }`}
            >
              <div>
                <p className="font-semibold text-ink text-sm">Pay online (UPI)</p>
                <p className="text-xs text-clay">Scan the restaurant's QR to pay directly.</p>
              </div>
              <QrCode size={22} className="text-ink/60 flex-shrink-0" />
            </button>
          )}
        </div>

        {payMethod === "online_upi" && (
          <div className="mt-4 bg-white border border-ink/10 rounded-card p-5 text-center">
            {payment.phonepe_qr_image_url ? (
              <img src={payment.phonepe_qr_image_url} alt="UPI QR" className="w-44 h-44 mx-auto rounded-lg" />
            ) : (
              <div className="w-44 h-44 mx-auto rounded-lg bg-paper border border-dashed border-ink/20 flex items-center justify-center text-clay text-xs px-4">
                Restaurant hasn't uploaded a payment QR yet — ask staff for their UPI ID.
              </div>
            )}
            <p className="mt-3 text-sm font-semibold text-ink">Pay {money(total, currency)}</p>
            {payment.upi_id && <p className="text-xs text-clay mt-0.5">UPI ID: {payment.upi_id}</p>}
            <label className="mt-4 flex items-start gap-2 text-left text-xs text-clay">
              <input
                type="checkbox"
                checked={paidClicked}
                onChange={(e) => setPaidClicked(e.target.checked)}
                className="mt-0.5"
              />
              I've completed the payment via UPI. I understand the restaurant will confirm receipt.
            </label>
          </div>
        )}
      </div>

      <button
        disabled={!canPlace || placing}
        onClick={onPlaceOrder}
        className="fixed bottom-5 left-4 right-4 bg-chili disabled:bg-ink/20 text-white rounded-card px-5 py-3.5 font-semibold"
      >
        {placing ? "Placing order..." : `Place order · ${money(total, currency)}`}
      </button>
    </div>
  );
}

// ---------- Confirmation ----------

function ConfirmationScreen({ order, restaurant, table, onNewOrder }) {
  const [status, setStatus] = useState(order.status);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.order_number}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.order) setStatus(data.order.status);
      } catch {
        // network hiccup — just try again next tick
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [order.order_number]);

  const statusLabels = {
    pending: "Pending",
    completed: "Completed",
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-6 pt-16 pb-10 text-center">
      <div className="w-16 h-16 rounded-full bg-herb/15 flex items-center justify-center mb-4 animate-rise-in">
        <CheckCircle2 size={34} className="text-herb" />
      </div>
      <h1 className="font-display text-2xl font-bold text-ink">Order placed successfully!</h1>
      <p className="text-ink/60 mt-1.5">Your order has been sent to the restaurant.</p>

      <div className="mt-7 bg-white border border-ink/10 rounded-card p-5 w-full max-w-sm text-left">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-ink">#{order.order_number}</p>
          <span className="text-xs font-semibold bg-turmeric/20 text-chili-dark px-2.5 py-1 rounded-full">
            {statusLabels[status] || status}
          </span>
        </div>
        <p className="text-xs text-clay mt-1">Table {table.table_number} · {restaurant.name}</p>
        <div className="border-t border-ink/10 my-3" />
        <div className="grid gap-1 text-sm">
          {order.items?.map((it) => (
            <div key={it.name + it.quantity} className="flex justify-between text-ink/70">
              <span>{it.name} × {it.quantity}</span>
              <span>{money(it.unit_price * it.quantity, restaurant.currency)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-ink/10 my-3" />
        <div className="grid gap-1 text-sm text-ink/70">
          {order.discount_amount > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>− {money(order.discount_amount, restaurant.currency)}</span>
            </div>
          )}
          {(order.tax_breakdown || []).map((t) => (
            <div key={t.name} className="flex justify-between">
              <span>{t.name} ({t.type === "fixed" ? "flat" : `${t.percent}%`})</span>
              <span>{money(t.amount, restaurant.currency)}</span>
            </div>
          ))}
          {order.platform_fee > 0 && (
            <div className="flex justify-between">
              <span>Platform fee</span>
              <span>{money(order.platform_fee, restaurant.currency)}</span>
            </div>
          )}
        </div>
        <div className="border-t border-ink/10 my-3" />
        <div className="flex justify-between font-bold text-ink">
          <span>Total</span>
          <span>{money(order.total, restaurant.currency)}</span>
        </div>
        <p className="text-xs text-clay mt-2 capitalize">
          Payment: {order.payment_method.replace("_", " ")}
          {order.payment_method === "online_upi" ? " (pending confirmation)" : ""}
        </p>
      </div>

      <button onClick={onNewOrder} className="mt-8 text-chili font-semibold text-sm">
        Order something else
      </button>
    </div>
  );
}

// ---------- Campaign (video feedback / Instagram) — completed at checkout,
// discount applies to THIS order immediately ----------

function CampaignModal({ campaign, onClose, onDone }) {
  const [step, setStep] = useState("terms"); // terms -> feedback
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedInsta, setAgreedInsta] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewName, setVideoPreviewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB

  function handleVideo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) {
      setError(`That video is too large (max 200MB). Please choose a shorter clip or lower quality.`);
      e.target.value = "";
      return;
    }
    setError("");
    setVideoPreviewName(file.name);
    const reader = new FileReader();
    reader.onload = () => setVideoFile(reader.result);
    reader.readAsDataURL(file);
  }

  async function submit() {
    setError("");
    if (campaign.requires_video && !videoFile) {
      setError("Please attach a short video to continue.");
      return;
    }
    setSubmitting(true);
    try {
      let videoUrl = "";
      if (videoFile) {
        const upRes = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: videoFile, maxBytes: MAX_VIDEO_BYTES }),
        });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error);
        videoUrl = upData.url;
      }

      // Not submitted to the server yet — collected here and sent together
      // with the order itself, so the discount and the review are created
      // atomically once the customer actually places the order.
      onDone({
        rating,
        textFeedback: text,
        videoUrl,
        agreedToSubmitContent: agreedTerms,
        agreedToInstagramUse: campaign.allow_instagram_repost ? agreedInsta : undefined,
      });
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-end" onClick={onClose}>
      <div className="bg-paper w-full rounded-t-3xl max-h-[88vh] overflow-y-auto p-5 animate-rise-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-ink">{campaign.title}</h2>
          <button onClick={onClose} className="text-ink/50 hover:text-ink transition-colors p-1"><X size={20} /></button>
        </div>

        {step === "terms" && (
          <>
            <div className="bg-white border border-ink/10 rounded-card p-4 text-xs text-ink/70 max-h-40 overflow-y-auto">
              {campaign.terms_text ||
                "By submitting, you agree to share honest feedback about your order. We're not asking for a positive review — just your real experience."}
            </div>
            <label className="flex items-start gap-2 text-sm text-ink mt-4">
              <input type="checkbox" className="mt-0.5" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} />
              I agree to the campaign terms and understand what content I'm submitting and how it may be used.
            </label>
            {!!campaign.allow_instagram_repost && (
              <label className="flex items-start gap-2 text-sm text-ink mt-3">
                <input type="checkbox" className="mt-0.5" checked={agreedInsta} onChange={(e) => setAgreedInsta(e.target.checked)} />
                Separately, I'm okay with this restaurant reposting my content on Instagram/social media.
              </label>
            )}
            <button
              disabled={!agreedTerms}
              onClick={() => setStep("feedback")}
              className="mt-5 w-full bg-chili disabled:bg-ink/20 text-white font-semibold py-3 rounded-card"
            >
              Continue
            </button>
          </>
        )}

        {step === "feedback" && (
          <>
            <p className="text-sm font-semibold text-ink mb-1.5">How was your experience? (honest feedback welcome)</p>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className="transition-transform hover:scale-110">
                  <Star size={26} className={n <= rating ? "fill-turmeric text-turmeric" : "text-clay-light"} />
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tell us what you liked or what we can improve..."
              rows={3}
              className="w-full bg-white border border-ink/10 rounded-card px-3.5 py-2.5 text-sm outline-none focus:border-chili"
            />

            <p className="text-sm font-semibold text-ink mt-4 mb-1.5">
              {campaign.requires_video ? "Upload a short video" : "Upload a photo or video (optional)"}
            </p>
            <label className="flex items-center gap-3 border border-dashed border-ink/25 rounded-card p-3 cursor-pointer">
              <span className="w-10 h-10 rounded-lg bg-clay-light flex items-center justify-center flex-shrink-0">
                {videoPreviewName ? <CheckCircle2 size={18} className="text-herb" /> : <Video size={18} className="text-clay" />}
              </span>
              <span className="text-xs text-clay truncate">{videoPreviewName || "Tap to record or choose a video"}</span>
              <input type="file" accept="video/*" onChange={handleVideo} className="hidden" />
            </label>

            {error && <p className="text-xs text-chili-dark font-medium mt-3">{error}</p>}

            <button
              disabled={submitting}
              onClick={submit}
              className="mt-5 w-full bg-chili disabled:opacity-60 text-white font-semibold py-3 rounded-card"
            >
              {submitting ? "Applying discount..." : `Get ${campaign.discount_type === "percent" ? campaign.discount_value + "%" : money(campaign.discount_value, "INR")} off this order`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
