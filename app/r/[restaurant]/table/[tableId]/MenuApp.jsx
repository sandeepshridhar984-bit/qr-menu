"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Monogram from "@/components/Monogram";
import { parseDbDate } from "@/lib/clientDates";
import {
  Volume2, ArrowRight, Search, Sparkles, ShoppingCart, Minus, Plus,
  Star, Tag, Video, Mic, CheckCheck, Banknote, QrCode, CheckCircle2,
  ChevronLeft, X, UtensilsCrossed, Armchair, ChefHat, Instagram,
  ChefHat as ChefHatIcon, Flame, Truck,
} from "lucide-react";

const FILTERS = [
  { key: "veg", label: "Vegetarian" },
  { key: "non-veg", label: "Non-veg" },
  { key: "spicy", label: "Spicy" },
  { key: "popular", label: "Popular" },
  { key: "budget", label: "Under ₹200" },
];

// A menu item counts as "new" for this many days after it's added -- shown
// in its own row at the top of the menu, plus a small badge on the card.
const NEW_ITEM_WINDOW_DAYS = 10;

function money(n, currency = "INR") {
  const symbol = currency === "INR" ? "₹" : currency + " ";
  return `${symbol}${Math.round(n)}`;
}

function isNewItem(item) {
  if (!item.created_at) return false;
  const ageMs = Date.now() - parseDbDate(item.created_at).getTime();
  return ageMs >= 0 && ageMs < NEW_ITEM_WINDOW_DAYS * 24 * 60 * 60 * 1000;
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

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const subtotal = cart.reduce((s, c) => s + c.qty * c.price, 0);

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

  const newItems = useMemo(() => items.filter(isNewItem), [items]);

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
          sessionId,
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
      setView("tracking");
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
          allItems={items}
          newItems={newItems}
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
          cartTotal={subtotal}
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
          onBack={() => setView("menu")}
          onUpdateQty={updateQty}
          onPlaceOrder={placeOrder}
          placing={placing}
        />
      )}

      {view === "tracking" && order && (
        <OrderTrackingScreen
          initialOrder={order}
          restaurant={restaurant}
          table={table}
          offers={offers}
          campaign={campaign}
          payment={payment}
          sessionId={sessionId}
          onNewOrder={() => { setOrder(null); setView("menu"); }}
        />
      )}
    </main>
  );
}

// ---------- Scrolling banner ----------

function ScrollingBanner({ messages }) {
  if (!messages || messages.length === 0) return null;
  return (
    <div className="relative w-full overflow-hidden py-2 bg-gradient-to-r from-chili-dark via-chili to-chili-dark shadow-md">
      {/* A glossy sweep of light drifting across the banner -- reads as
          "something exciting is happening here" rather than a plain static bar. */}
      <div className="absolute inset-0 banner-shine pointer-events-none" />
      <div className="flex whitespace-nowrap animate-marquee relative z-10">
        {[0, 1].map((dup) => (
          <span key={dup} className="flex items-center">
            {messages.map((m, i) => (
              <span key={i} className="flex items-center gap-2 mx-5">
                <Sparkles size={13} className="text-turmeric flex-shrink-0 animate-pulse-soft" />
                <span
                  className="text-xs font-bold tracking-wide text-paper uppercase"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
                >
                  {m}
                </span>
              </span>
            ))}
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 22s linear infinite;
          width: max-content;
        }
        @keyframes shine {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
        .banner-shine {
          width: 55%;
          background: linear-gradient(
            100deg,
            transparent 30%,
            rgba(255, 255, 255, 0.3) 45%,
            rgba(255, 255, 255, 0.55) 50%,
            rgba(255, 255, 255, 0.3) 55%,
            transparent 70%
          );
          animation: shine 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// ---------- Welcome ----------

function WelcomeScreen({ restaurant, table, onEnter }) {
  const hasCover = !!restaurant.cover_image_url;
  return (
    <div className="min-h-screen flex flex-col bg-ink">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
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
      {restaurant.banner_messages?.length > 0 && <ScrollingBanner messages={restaurant.banner_messages} />}
    </div>
  );
}

// ---------- Menu ----------

function MenuScreen({
  restaurant, table, categories, items, allItems, newItems, allItemsCount, query, setQuery,
  filters, toggleFilter, activeCategory, setActiveCategory, offers,
  onOpenItem, onOpenAssistant, cartCount, cartTotal, onOpenCart,
}) {
  const activeCategoryName = categories.find((c) => c.id === activeCategory)?.name;

  return (
    <div className="pb-28 bg-paper">
      <HeroSection
        restaurant={restaurant}
        table={table}
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        allItems={allItems}
        currency={restaurant.currency}
        onOpenItem={onOpenItem}
        cartCount={cartCount}
        onOpenCart={onOpenCart}
      />

      {restaurant.banner_messages?.length > 0 && <ScrollingBanner messages={restaurant.banner_messages} />}

      {/* Slim sticky search + filter bar -- stays reachable once the hero scrolls away */}
      <div className="bg-white/95 backdrop-blur-md border-b border-ink/10 sticky top-0 z-20 px-4 py-3 shadow-sm">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-clay" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the menu..."
            className="w-full bg-paper border border-ink/10 rounded-full pl-9 pr-4 py-2.5 text-sm outline-none focus:border-herb"
          />
        </div>

        <div className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`whitespace-nowrap text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors flex-shrink-0 ${
                activeCategory === c.id && !query && filters.length === 0
                  ? "bg-herb text-white border-herb"
                  : "border-ink/15 text-ink/60"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => toggleFilter(f.key)}
              className={`whitespace-nowrap text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors flex-shrink-0 ${
                filters.includes(f.key)
                  ? "bg-chili text-white border-chili"
                  : "border-ink/15 text-ink/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
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

      {!query && filters.length === 0 && newItems.length > 0 && (
        <div className="pt-5">
          <p className="px-4 text-sm font-semibold text-ink mb-2.5 flex items-center gap-1.5">
            <Sparkles size={15} className="text-turmeric" /> New on the menu
          </p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
            {newItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenItem(item)}
                className="flex-shrink-0 w-36 text-left bg-white border border-ink/10 rounded-2xl overflow-hidden hover:border-herb/40 hover:shadow-md transition-all"
              >
                <div className="relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-36 h-24 object-cover" />
                  ) : (
                    <div className="w-36 h-24"><Monogram name={item.name} size="md" className="rounded-none" /></div>
                  )}
                  <span className="absolute top-1.5 left-1.5 text-[10px] font-bold text-white bg-herb px-1.5 py-0.5 rounded-full">NEW</span>
                </div>
                <div className="p-2.5">
                  <p className="font-semibold text-ink text-xs truncate">{item.name}</p>
                  <p className="text-xs text-clay mt-0.5">{money(item.discounted_price || item.price, restaurant.currency)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pt-5">
        <h2 className="font-display text-lg font-bold text-ink mb-3">
          {query || filters.length > 0 ? "Results" : activeCategoryName || "Menu"}
        </h2>
        <div className="grid gap-3">
          {items.length === 0 && (
            <p className="text-center text-clay text-sm py-10">
              No dishes match right now — try a different search or filter.
            </p>
          )}
          {items.map((item) => (
            <MenuItemCard key={item.id} item={item} currency={restaurant.currency} onOpen={() => onOpenItem(item)} isNew={isNewItem(item)} />
          ))}
        </div>
      </div>

      {cartCount > 0 && (
        <button
          onClick={onOpenCart}
          className="fixed bottom-5 left-4 right-4 bg-herb text-white rounded-full px-5 py-3.5 flex items-center justify-between shadow-lg font-semibold z-30"
        >
          <span>{cartCount} item{cartCount > 1 ? "s" : ""} in cart</span>
          <span>{money(cartTotal, restaurant.currency)} · View cart</span>
        </button>
      )}
    </div>
  );
}

// The whole "green dome" header: brand row + headline on white, then a
// curved herb-green panel holding the category chips, with the featured
// item's photo floating so it spills out past the curve onto the white
// area below (name / price / dots live there). Whatever the restaurant
// adds in the dashboard -- new categories, new dishes -- flows straight
// into this via the `categories` / `allItems` props, nothing here is
// hardcoded.
function HeroSection({ restaurant, table, categories, activeCategory, setActiveCategory, allItems, currency, onOpenItem, cartCount, onOpenCart }) {
  return (
    <div>
      <div className="bg-paper px-5 pt-5 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {restaurant.logo_image_url ? (
              <img src={restaurant.logo_image_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-herb/15 flex-shrink-0" />
            ) : (
              <Monogram name={restaurant.name} size="sm" className="w-10 h-10 rounded-full flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-display font-bold text-ink text-sm leading-tight truncate">{restaurant.name}</p>
              <p className="text-clay text-[11px]">Table {table.table_number}</p>
            </div>
          </div>
          <button
            onClick={onOpenCart}
            className="relative w-10 h-10 rounded-full bg-white border border-ink/10 flex items-center justify-center text-ink shadow-sm flex-shrink-0"
          >
            <ShoppingCart size={17} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-chili text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        <h1 className="font-display text-[22px] font-bold text-herb leading-[1.2] mt-4 whitespace-pre-line">
          {restaurant.tagline || "Fresh flavors,\nmade just for you"}
        </h1>
      </div>

      <div className="relative mt-4">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-herb to-[#2c4f34] rounded-b-[45%] overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute top-6 -left-8 w-24 h-24 rounded-full bg-white/5" />
        </div>

        <div className="relative pt-4 px-5">
          {categories.length > 0 && (
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
              {categories.map((c) => {
                const active = activeCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16"
                  >
                    <span
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold bg-white transition-all ${
                        active ? "text-herb shadow-md scale-105 ring-2 ring-white" : "text-herb/70"
                      }`}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <span className={`text-[10px] font-semibold text-center leading-tight truncate w-full ${active ? "text-white" : "text-white/70"}`}>
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <HeroCarousel items={allItems} currency={currency} onOpenItem={onOpenItem} />
        </div>
      </div>
    </div>
  );
}

// The floating featured-dish carousel underneath the category row -- a
// product photo on a soft circle, its name/price on the white area below
// (since the photo spills past the curve), with dots to page through a
// handful of picks. Tapping it opens the same item detail sheet as
// tapping a regular card.
function HeroCarousel({ items, currency, onOpenItem }) {
  const picks = useMemo(() => {
    const popular = items.filter((it) => it.is_popular && it.image_url);
    const withImage = items.filter((it) => it.image_url);
    const pool = popular.length ? popular : withImage.length ? withImage : items;
    return pool.slice(0, 6);
  }, [items]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [picks.length]);

  useEffect(() => {
    if (picks.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % picks.length), 4200);
    return () => clearInterval(t);
  }, [picks.length]);

  if (picks.length === 0) return null;
  const item = picks[index];
  const price = item.discounted_price || item.price;

  return (
    <div className="flex flex-col items-center -mt-1 pb-1">
      <button onClick={() => onOpenItem(item)} className="relative w-40 h-40 rounded-full bg-white/20 flex items-center justify-center transition-transform active:scale-95 overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-32 h-32 object-cover rounded-full shadow-xl ring-4 ring-white/40"
          />
        ) : (
          <div className="w-32 h-32 rounded-full overflow-hidden">
            <Monogram name={item.name} size="lg" className="text-3xl" />
          </div>
        )}
      </button>
      <span className="mt-3 text-ink font-display font-bold text-base">{item.name}</span>
      <span className="text-herb text-sm font-semibold mt-0.5">{money(price, currency)}</span>

      {picks.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {picks.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-herb" : "w-1.5 bg-ink/15"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItemCard({ item, currency, onOpen, isNew }) {
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
          {isNew ? <Badge label="New" tone="chili" /> : null}
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

const NOTE_OPTIONS = ["Less spicy", "No onions", "Extra sauce"];

function ItemDetail({ item, currency, onClose, onAdd }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [justAdded, setJustAdded] = useState(false);
  const price = item.discounted_price || item.price;
  const allergens = JSON.parse(item.allergens || "[]");

  function handleAdd() {
    setJustAdded(true);
  }

  function confirmAdd() {
    onAdd(qty, note);
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink/50 flex items-end" onClick={onClose}>
      <div
        className="relative bg-paper w-full rounded-t-[32px] max-h-[92vh] overflow-y-auto animate-rise-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Back / close + centered "Details" title, like the reference's detail page */}
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur-md flex items-center justify-center px-4 pt-4 pb-2">
          <button
            onClick={onClose}
            className="absolute left-4 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-ink"
          >
            <ChevronLeft size={19} />
          </button>
          <span className="text-sm font-bold text-ink">Details</span>
          <span className="absolute right-4 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-ink">
            <VegDot veg={item.is_veg} />
          </span>
        </div>

        {/* Product image floating on a soft green circle, like the reference's hero shot */}
        <div className="pt-2 pb-3 flex justify-center bg-gradient-to-b from-herb/15 to-transparent">
          <div className="relative w-52 h-52 rounded-full bg-herb/15 flex items-center justify-center overflow-hidden">
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="w-44 h-44 object-cover rounded-full shadow-xl" />
            ) : (
              <div className="w-44 h-44 rounded-full overflow-hidden">
                <Monogram name={item.name} size="lg" className="text-4xl" />
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pt-2 pb-32">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-ink leading-tight">{item.name}</h2>
            <span className="font-display text-xl font-bold text-herb flex-shrink-0">{money(price, currency)}</span>
          </div>
          <p className="text-ink/60 mt-1.5 text-sm">{item.description}</p>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {item.discounted_price ? (
              <span className="text-sm text-clay line-through">{money(item.price, currency)}</span>
            ) : null}
            {item.is_popular ? <Badge label="Popular" tone="turmeric" /> : null}
            <Badge label={`${item.prep_time_minutes} min`} tone="chili" />
          </div>

          {allergens.length > 0 && (
            <p className="text-xs text-clay mt-3">Allergens: {allergens.join(", ")}</p>
          )}

          {/* "Size Options"-style row from the reference, reused here for customization chips */}
          <div className="mt-6">
            <p className="text-sm font-semibold text-ink mb-2.5">Options</p>
            <div className="flex gap-3">
              {NOTE_OPTIONS.map((s) => {
                const active = note === s;
                return (
                  <button
                    key={s}
                    onClick={() => setNote(active ? "" : s)}
                    className="flex flex-col items-center gap-1.5 flex-1"
                  >
                    <span
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                        active ? "bg-herb border-herb text-white" : "bg-white border-ink/10 text-ink/50"
                      }`}
                    >
                      <Tag size={16} />
                    </span>
                    <span className={`text-[11px] font-semibold text-center leading-tight ${active ? "text-ink" : "text-ink/45"}`}>
                      {s}
                    </span>
                  </button>
                );
              })}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Or type your own note, e.g. no coriander"
              className="mt-3 w-full bg-white border border-ink/10 rounded-card px-3.5 py-2.5 text-sm outline-none focus:border-herb"
            />
          </div>
        </div>

        {/* Sticky quantity + Add to order bar, pinned like the reference's bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-paper border-t border-ink/10 px-5 py-4 flex items-center gap-3">
          <div className="flex items-center border-2 border-ink/10 rounded-full flex-shrink-0">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-10 h-10 flex items-center justify-center text-ink/70"
            >
              <Minus size={16} />
            </button>
            <span className="w-6 text-center font-bold text-ink">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="w-10 h-10 flex items-center justify-center text-ink/70"
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="flex-1 bg-herb text-white font-semibold py-3.5 rounded-full transition-transform active:scale-[0.98]"
          >
            {`Add to Order · ${money(price * qty, currency)}`}
          </button>
        </div>

        {/* Success confirmation, styled after the reference's green "thank you" card */}
        {justAdded && (
          <div
            className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center px-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-b from-herb to-[#2c4f34] rounded-3xl px-6 py-8 text-center max-w-xs w-full animate-rise-in shadow-2xl">
              <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={30} className="text-white" />
              </div>
              <p className="font-display text-lg font-bold text-white">Thank you for your order!</p>
              <p className="text-sm text-white/75 mt-1">
                {item.name} × {qty} has been added.
              </p>
              <button
                onClick={confirmAdd}
                className="mt-5 w-full bg-white text-herb font-semibold py-3 rounded-full"
              >
                Close
              </button>
            </div>
          </div>
        )}
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

// ---------- Cart (items only -- no discounts/payment here anymore; those
// come after the food is served) ----------

function CartScreen({ cart, currency, subtotal, onBack, onUpdateQty, onPlaceOrder, placing }) {
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

          <div className="px-4 mt-5">
            <div className="bg-white border border-ink/10 rounded-card p-4 text-sm">
              <Row label="Subtotal" value={money(subtotal, currency)} bold />
            </div>
            <p className="text-xs text-clay mt-2.5 px-1">
              Tax and any discount are added to your final bill after your food is served — you'll
              have a chance to get a discount then too.
            </p>
          </div>

          <button
            disabled={placing}
            onClick={onPlaceOrder}
            className="fixed bottom-5 left-4 right-4 bg-chili disabled:opacity-60 text-white rounded-card px-5 py-3.5 font-semibold"
          >
            {placing ? "Sending to kitchen..." : `Send order to kitchen · ${money(subtotal, currency)}`}
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

// ---------- Order tracking + post-meal bill (the whole journey after
// "Send order to kitchen", in one polling screen) ----------

const STAGES = [
  { key: "pending", label: "Received", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: Flame },
  { key: "served", label: "Served", icon: Truck },
];

function OrderTrackingScreen({ initialOrder, restaurant, table, offers, campaign, payment, sessionId, onNewOrder }) {
  const [order, setOrder] = useState(initialOrder);
  const [billOpen, setBillOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.order_number}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.order) setOrder((prev) => ({ ...prev, ...data.order }));
      } catch {
        // network hiccup — just try again next tick
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [order.order_number]);

  const stageIndex = STAGES.findIndex((s) => s.key === order.status);
  const isServedOrLater = ["served", "completed"].includes(order.status);
  const billFinalized = !!order.payment_method;

  // The moment the food is marked served, offer the bill/discount step
  // automatically (only once, and only if it hasn't been finalized yet).
  useEffect(() => {
    if (isServedOrLater && !billFinalized) setBillOpen(true);
  }, [isServedOrLater, billFinalized]);

  if (isServedOrLater && !billFinalized && billOpen) {
    return (
      <BillScreen
        order={order}
        restaurant={restaurant}
        offers={offers}
        campaign={campaign}
        payment={payment}
        sessionId={sessionId}
        onFinalized={(updatedOrder) => { setOrder((prev) => ({ ...prev, ...updatedOrder })); setBillOpen(false); }}
      />
    );
  }

  if (billFinalized) {
    return (
      <ReceiptScreen order={order} restaurant={restaurant} table={table} payment={payment} onNewOrder={onNewOrder} />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 pt-14 pb-10 text-center">
      <div className="w-16 h-16 rounded-full bg-herb/15 flex items-center justify-center mb-4 animate-rise-in">
        <CheckCircle2 size={34} className="text-herb" />
      </div>
      <h1 className="font-display text-2xl font-bold text-ink">Order sent to the kitchen!</h1>
      <p className="text-ink/60 mt-1.5">#{order.order_number} · Table {table.table_number}</p>

      <div className="mt-8 w-full max-w-sm">
        <div className="flex items-center justify-between">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const reached = i <= (stageIndex < 0 ? 0 : stageIndex);
            return (
              <div key={s.key} className="flex-1 flex flex-col items-center relative">
                {i > 0 && (
                  <div className={`absolute top-4 right-1/2 w-full h-0.5 ${reached ? "bg-herb" : "bg-ink/10"}`} style={{ zIndex: 0 }} />
                )}
                <div
                  className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                    reached ? "bg-herb border-herb text-white" : "bg-white border-ink/15 text-ink/30"
                  }`}
                >
                  <Icon size={16} />
                </div>
                <p className={`text-xs mt-2 font-medium ${reached ? "text-ink" : "text-ink/40"}`}>{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 bg-white border border-ink/10 rounded-card p-5 w-full max-w-sm text-left">
        <p className="text-xs font-semibold text-ink mb-2">Your order</p>
        <div className="grid gap-1 text-sm">
          {order.items?.map((it) => (
            <div key={it.name + it.quantity} className="flex justify-between text-ink/70">
              <span>{it.name} × {it.quantity}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-clay mt-6 max-w-xs">
        Sit back and relax — once your food is on its way to the table, you'll see the bill here,
        with a chance to get a discount for sharing quick feedback.
      </p>
    </div>
  );
}

// ---------- Bill screen (shown once food is served): pick an offer or
// complete a campaign for a discount, then choose how to pay ----------

function BillScreen({ order, restaurant, offers, campaign, payment, sessionId, onFinalized }) {
  const [step, setStep] = useState("offers"); // offers -> pay
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [campaignFeedback, setCampaignFeedback] = useState(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [payMethod, setPayMethod] = useState(payment.cash_enabled ? "cash" : "online_upi");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const currency = restaurant.currency;
  const subtotal = order.subtotal;
  const eligibleOffers = useMemo(() => offers.filter((o) => subtotal >= o.min_order_value), [offers, subtotal]);
  const selectedOffer = eligibleOffers.find((o) => o.id === selectedOfferId) || null;

  const roundMoney = (n) => Math.round(n);
  const discount = roundMoney(
    campaignFeedback
      ? campaign.discount_type === "percent" ? (subtotal * campaign.discount_value) / 100 : campaign.discount_value
      : selectedOffer
      ? selectedOffer.discount_type === "percent" ? (subtotal * selectedOffer.discount_value) / 100 : selectedOffer.discount_value
      : 0
  );
  // (Tax and total are intentionally not previewed here -- the server
  // computes the trusted final figures at finalize time; the customer
  // sees those on the receipt screen right after confirming.)

  async function submitBill() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${order.order_number}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: campaignFeedback ? null : selectedOffer?.id || null,
          campaignId: campaignFeedback ? campaign.id : null,
          campaignFeedback: campaignFeedback || null,
          paymentMethod: payMethod,
          sessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not finalize your bill.");
      onFinalized(data.order);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="bg-white border-b border-ink/10 px-4 py-4 sticky top-0 z-10">
        <h1 className="font-display text-lg font-bold text-ink">Your food has arrived!</h1>
        <p className="text-xs text-clay mt-0.5">#{order.order_number} · Table {order.table_number}</p>
      </div>

      <div className="px-4 pt-5">
        {(eligibleOffers.length > 0 || campaign) && (
          <div className="mb-5">
            <p className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5"><Tag size={15} /> Want a discount on this bill?</p>
            <p className="text-xs text-clay mb-2 -mt-1">Pick at most one — offer or campaign, not both.</p>
            <div className="grid gap-2">
              {eligibleOffers.map((o) => {
                const isSelected = selectedOfferId === o.id && !campaignFeedback;
                return (
                  <button
                    key={o.id}
                    onClick={() => { setSelectedOfferId(isSelected ? null : o.id); setCampaignFeedback(null); }}
                    className={`text-left border rounded-card p-3.5 flex items-center justify-between gap-3 transition-colors ${
                      isSelected ? "border-chili bg-chili/5" : "border-ink/10 bg-white"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-ink text-sm">{o.title}</p>
                      <p className="text-xs text-clay mt-0.5">
                        {o.discount_type === "percent" ? `${o.discount_value}% off` : `${money(o.discount_value, currency)} off`}
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
                      <p className="font-semibold text-ink text-sm flex items-center gap-1.5">
                        {campaign.media_type === "audio" ? <Mic size={15} /> : <Video size={15} />} {campaign.title}
                      </p>
                      <p className="text-xs text-herb mt-0.5">
                        {campaign.discount_type === "percent" ? `${campaign.discount_value}% off` : `${money(campaign.discount_value, currency)} off`} applied
                      </p>
                    </div>
                    <button onClick={() => setCampaignFeedback(null)} className="text-xs font-semibold text-clay flex-shrink-0">Remove</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCampaignModalOpen(true)}
                    className="text-left border border-ink/10 bg-white rounded-card p-3.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-ink text-sm flex items-center gap-1.5">
                        {campaign.media_type === "audio" ? <Mic size={15} /> : <Video size={15} />} {campaign.title}
                      </p>
                      <p className="text-xs text-clay mt-0.5">
                        {campaign.description || "Share quick feedback about your meal for a discount."}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-paper text-ink/60 flex-shrink-0">Participate</span>
                  </button>
                )
              )}
            </div>
          </div>
        )}

        <div className="bg-white border border-ink/10 rounded-card p-4 text-sm mb-5">
          {order.items?.map((it) => (
            <Row key={it.name} label={`${it.name} × ${it.quantity}`} value={money(it.unit_price * it.quantity, currency)} />
          ))}
          <div className="border-t border-ink/10 my-2" />
          <Row label="Subtotal" value={money(subtotal, currency)} />
          {discount > 0 && <Row label="Discount" value={"− " + money(discount, currency)} />}
          <p className="text-xs text-clay mt-1">Tax and any platform fee are added to your final receipt.</p>
        </div>

        <p className="text-sm font-semibold text-ink mb-2">How would you like to pay?</p>
        <div className="grid gap-2.5 mb-4">
          {payment.cash_enabled && (
            <button
              onClick={() => setPayMethod("cash")}
              className={`text-left border rounded-card p-4 flex items-center justify-between ${
                payMethod === "cash" ? "border-chili bg-chili/5" : "border-ink/10 bg-white"
              }`}
            >
              <div>
                <p className="font-semibold text-ink text-sm">Pay with cash</p>
                <p className="text-xs text-clay">Pay at the table now.</p>
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

        {error && <p className="text-xs text-chili-dark font-medium mb-3">{error}</p>}
      </div>

      <button
        disabled={submitting}
        onClick={submitBill}
        className="fixed bottom-5 left-4 right-4 bg-chili disabled:opacity-60 text-white rounded-card px-5 py-3.5 font-semibold"
      >
        {submitting ? "Preparing your bill..." : "Confirm & see final bill"}
      </button>

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
    </div>
  );
}

// ---------- Receipt (after the bill is finalized: pay online now, or wait
// for staff to confirm cash) ----------

function ReceiptScreen({ order, restaurant, table, payment, onNewOrder }) {
  const [marking, setMarking] = useState(false);
  const currency = restaurant.currency;
  const isDone = order.status === "completed";

  async function markPaid() {
    setMarking(true);
    try {
      await fetch(`/api/orders/${order.order_number}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerMarkedPaid: true }),
      });
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 pt-14 pb-10 text-center">
      <div className="w-16 h-16 rounded-full bg-herb/15 flex items-center justify-center mb-4 animate-rise-in">
        <CheckCircle2 size={34} className="text-herb" />
      </div>
      <h1 className="font-display text-2xl font-bold text-ink">
        {isDone ? "All done — thank you!" : "Here's your bill"}
      </h1>
      <p className="text-ink/60 mt-1.5">#{order.order_number} · Table {table.table_number}</p>

      <div className="mt-7 bg-white border border-ink/10 rounded-card p-5 w-full max-w-sm text-left">
        <div className="grid gap-1 text-sm">
          {order.items?.map((it) => (
            <div key={it.name + it.quantity} className="flex justify-between text-ink/70">
              <span>{it.name} × {it.quantity}</span>
              <span>{money(it.unit_price * it.quantity, currency)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-ink/10 my-3" />
        <div className="grid gap-1 text-sm text-ink/70">
          {order.discount_amount > 0 && (
            <div className="flex justify-between"><span>Discount</span><span>− {money(order.discount_amount, currency)}</span></div>
          )}
          {(order.tax_breakdown || []).map((t) => (
            <div key={t.name} className="flex justify-between">
              <span>{t.name} ({t.type === "fixed" ? "flat" : `${t.percent}%`})</span>
              <span>{money(t.amount, currency)}</span>
            </div>
          ))}
          {order.platform_fee > 0 && (
            <div className="flex justify-between"><span>Platform fee</span><span>{money(order.platform_fee, currency)}</span></div>
          )}
        </div>
        <div className="border-t border-ink/10 my-3" />
        <div className="flex justify-between font-bold text-ink">
          <span>Total</span>
          <span>{money(order.total, currency)}</span>
        </div>
      </div>

      {!isDone && order.payment_method === "online_upi" && order.payment_status !== "paid" && (
        <div className="mt-5 bg-white border border-ink/10 rounded-card p-5 w-full max-w-sm text-center">
          {payment.phonepe_qr_image_url ? (
            <img src={payment.phonepe_qr_image_url} alt="UPI QR" className="w-44 h-44 mx-auto rounded-lg" />
          ) : (
            <div className="w-44 h-44 mx-auto rounded-lg bg-paper border border-dashed border-ink/20 flex items-center justify-center text-clay text-xs px-4">
              Restaurant hasn't uploaded a payment QR yet — ask staff for their UPI ID.
            </div>
          )}
          <p className="mt-3 text-sm font-semibold text-ink">Pay {money(order.total, currency)}</p>
          {payment.upi_id && <p className="text-xs text-clay mt-0.5">UPI ID: {payment.upi_id}</p>}
          {order.payment_status !== "pending_confirmation" ? (
            <button
              onClick={markPaid}
              disabled={marking}
              className="mt-4 w-full bg-herb disabled:opacity-60 text-white font-semibold py-2.5 rounded-card text-sm"
            >
              {marking ? "Marking..." : "I've completed the payment via UPI"}
            </button>
          ) : (
            <p className="text-xs text-herb font-semibold mt-4">Marked as paid — waiting for staff to confirm.</p>
          )}
        </div>
      )}

      {!isDone && order.payment_method === "cash" && (
        <p className="text-sm text-clay mt-5 max-w-xs">Please pay the staff at your table with cash.</p>
      )}

      {isDone && (
        <button onClick={onNewOrder} className="mt-8 text-chili font-semibold text-sm">
          Order something else
        </button>
      )}

      {!isDone && (
        <p className="text-xs text-clay mt-6">This page updates automatically once staff confirm your payment.</p>
      )}
    </div>
  );
}

// ---------- Campaign (video or audio feedback, completed after the meal;
// discount applies to THIS order's final bill) ----------

function CampaignModal({ campaign, onClose, onDone }) {
  const [step, setStep] = useState("terms"); // terms -> feedback
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedInsta, setAgreedInsta] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewName, setMediaPreviewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isAudio = campaign.media_type === "audio";
  const MAX_MEDIA_BYTES = 200 * 1024 * 1024; // 200MB

  function handleMedia(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MEDIA_BYTES) {
      setError(`That file is too large (max 200MB). Please choose a shorter clip or lower quality.`);
      e.target.value = "";
      return;
    }
    setError("");
    setMediaPreviewName(file.name);
    const reader = new FileReader();
    reader.onload = () => setMediaFile(reader.result);
    reader.readAsDataURL(file);
  }

  async function submit() {
    setError("");
    if (campaign.requires_video && !mediaFile) {
      setError(isAudio ? "Please attach a short voice note to continue." : "Please attach a short video to continue.");
      return;
    }
    setSubmitting(true);
    try {
      let mediaUrl = "";
      if (mediaFile) {
        const upRes = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: mediaFile, maxBytes: MAX_MEDIA_BYTES }),
        });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error);
        mediaUrl = upData.url;
      }

      onDone({
        rating,
        textFeedback: text,
        mediaUrl,
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
              {campaign.requires_video
                ? (isAudio ? "Record a short voice note" : "Upload a short video")
                : (isAudio ? "Add a voice note (optional)" : "Upload a photo or video (optional)")}
            </p>
            <label className="flex items-center gap-3 border border-dashed border-ink/25 rounded-card p-3 cursor-pointer">
              <span className="w-10 h-10 rounded-lg bg-clay-light flex items-center justify-center flex-shrink-0">
                {mediaPreviewName ? (
                  <CheckCircle2 size={18} className="text-herb" />
                ) : isAudio ? (
                  <Mic size={18} className="text-clay" />
                ) : (
                  <Video size={18} className="text-clay" />
                )}
              </span>
              <span className="text-xs text-clay truncate">
                {mediaPreviewName || (isAudio ? "Tap to record or choose a voice note" : "Tap to record or choose a video")}
              </span>
              <input type="file" accept={isAudio ? "audio/*" : "video/*"} onChange={handleMedia} className="hidden" />
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
