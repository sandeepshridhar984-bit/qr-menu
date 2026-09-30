"use client";
import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import Monogram from "@/components/Monogram";
import { Card, PageTitle, VegDot, categoryVisual, money } from "./shared";

// Category boxes across the top; pick one to see and edit its items as
// square cards. Uses the same category / item APIs as the older Menu tab,
// so both stay in sync.
export default function MenuManager({ restaurant, categories, setCategories, items, setItems, askConfirm, ItemFormModal }) {
  const [selected, setSelected] = useState(categories[0]?.id || null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [editingItem, setEditingItem] = useState(null); // null | "new" | item
  const [error, setError] = useState("");

  useEffect(() => {
    if (!categories.some((c) => c.id === selected)) setSelected(categories[0]?.id || null);
  }, [categories, selected]);

  const cat = categories.find((c) => c.id === selected);
  const catItems = items.filter((i) => i.category_id === selected).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const api = `/api/admin/${restaurant.slug}`;
  const json = { "Content-Type": "application/json" };

  async function addCategory() {
    if (!newName.trim()) return;
    setError("");
    const res = await fetch(`${api}/categories`, { method: "POST", headers: json, body: JSON.stringify({ name: newName.trim() }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Could not add category.");
    setCategories((p) => [...p, data.category]);
    setSelected(data.category.id);
    setNewName(""); setAdding(false);
  }

  async function saveRename() {
    if (!renameValue.trim() || !cat) return setRenaming(false);
    const res = await fetch(`${api}/categories/${cat.id}`, { method: "PATCH", headers: json, body: JSON.stringify({ name: renameValue.trim() }) });
    if (res.ok) setCategories((p) => p.map((c) => (c.id === cat.id ? { ...c, name: renameValue.trim() } : c)));
    setRenaming(false);
  }

  function deleteCategory() {
    const n = catItems.length;
    const msg = n > 0
      ? `Delete category "${cat.name}" and its ${n} item${n === 1 ? "" : "s"}? This cannot be undone. Past bills are not affected.`
      : `Delete category "${cat.name}"?`;
    askConfirm(msg, async () => {
      const res = await fetch(`${api}/categories/${cat.id}?force=1`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "Could not delete.");
      setItems((p) => p.filter((i) => i.category_id !== cat.id));
      setCategories((p) => p.filter((c) => c.id !== cat.id));
    });
  }

  function deleteItem(item) {
    askConfirm(`Delete "${item.name}"?`, async () => {
      const res = await fetch(`${api}/menu-items/${item.id}`, { method: "DELETE" });
      if (res.ok) setItems((p) => p.filter((i) => i.id !== item.id));
      else { const d = await res.json().catch(() => ({})); setError(d.error || "Could not delete this item."); }
    });
  }

  async function toggleAvailable(item) {
    const next = item.available ? 0 : 1;
    const res = await fetch(`${api}/menu-items/${item.id}`, { method: "PATCH", headers: json, body: JSON.stringify({ available: next }) });
    if (res.ok) setItems((p) => p.map((i) => (i.id === item.id ? { ...i, available: next } : i)));
  }

  return (
    <div>
      <PageTitle title="Menu Manager" subtitle="Pick a category box to manage the items inside it. Everything here can be edited any time." />

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-3 mb-5">
        {categories.map((c) => {
          const on = c.id === selected;
          const v = categoryVisual(c, items);
          const n = items.filter((i) => i.category_id === c.id).length;
          return (
            <button key={c.id} onClick={() => { setSelected(c.id); setRenaming(false); }}
              className={`flex-shrink-0 w-28 h-28 rounded-2xl border-2 p-2 flex flex-col items-center justify-center gap-1 transition-all ${on ? "border-sprout bg-sprout/5 shadow-md" : "border-ink/10 bg-white hover:border-ink/30"}`}>
              <span className="w-12 h-12 rounded-xl overflow-hidden bg-clay-light flex items-center justify-center text-2xl">
                {v.img ? <img src={v.img} alt="" className="w-full h-full object-cover" /> : v.emoji}
              </span>
              <span className="text-xs font-bold text-ink text-center leading-tight line-clamp-1 w-full">{c.name}</span>
              <span className="text-[10px] text-clay">{n} item{n === 1 ? "" : "s"}</span>
            </button>
          );
        })}
        {adding ? (
          <div className="flex-shrink-0 w-44 h-28 rounded-2xl border-2 border-dashed border-sprout p-2.5 flex flex-col justify-center gap-2 bg-white">
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()}
              placeholder="e.g. Coffee" className="border border-ink/15 rounded-lg px-2 py-1.5 text-sm" />
            <div className="flex gap-1.5">
              <button onClick={addCategory} className="flex-1 bg-sprout text-white rounded-lg py-1 text-xs font-bold">Add</button>
              <button onClick={() => { setAdding(false); setNewName(""); }} className="px-2.5 border border-ink/15 rounded-lg text-xs">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex-shrink-0 w-28 h-28 rounded-2xl border-2 border-dashed border-ink/25 text-clay hover:border-sprout hover:text-sprout-dark flex flex-col items-center justify-center gap-1">
            <Plus size={22} /><span className="text-xs font-semibold">New category</span>
          </button>
        )}
      </div>

      {error && <p className="text-sm text-chili-dark mb-3">{error}</p>}

      {!cat ? (
        <Card className="p-10 text-center text-sm text-clay">Create your first category (for example Drinks, Coffee, Dosa) to start adding items.</Card>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {renaming ? (
              <div className="flex items-center gap-1.5">
                <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveRename()}
                  className="border border-ink/15 rounded-lg px-2.5 py-1.5 text-sm font-bold" />
                <button onClick={saveRename} className="text-sprout-dark"><Check size={18} /></button>
                <button onClick={() => setRenaming(false)} className="text-clay"><X size={18} /></button>
              </div>
            ) : (
              <>
                <h3 className="font-display text-xl font-bold text-ink">{cat.name}</h3>
                <button onClick={() => { setRenameValue(cat.name); setRenaming(true); }} className="text-clay hover:text-ink" title="Rename"><Pencil size={15} /></button>
              </>
            )}
            <button onClick={deleteCategory} className="text-xs font-semibold text-chili-dark border border-chili/30 hover:bg-chili/5 rounded-full px-3 py-1.5 inline-flex items-center gap-1.5 ml-auto"><Trash2 size={13} /> Delete category</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {catItems.map((it) => (
              <div key={it.id} className="bg-white border border-ink/10 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div className="aspect-square bg-clay-light relative">
                  {it.image_url ? <img src={it.image_url} alt="" className="w-full h-full object-cover" />
                    : <Monogram name={it.name} className="w-full h-full rounded-none text-4xl" />}
                  {!it.available && <span className="absolute top-2 left-2 text-[10px] font-bold bg-ink text-paper px-2 py-0.5 rounded-full">Hidden</span>}
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <div className="flex items-start gap-1.5">
                    <VegDot veg={!!it.is_veg} />
                    <p className="font-semibold text-ink text-sm leading-tight">{it.name}</p>
                  </div>
                  <p className="text-sm font-medium text-ink mt-1">
                    {money(it.discounted_price || it.price)}
                    {it.discounted_price ? <span className="line-through text-clay text-xs ml-1.5">{money(it.price)}</span> : null}
                  </p>
                  <label className="flex items-center gap-1.5 text-xs text-clay mt-2">
                    <input type="checkbox" checked={!!it.available} onChange={() => toggleAvailable(it)} /> Available
                  </label>
                  <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-ink/10">
                    <button onClick={() => setEditingItem(it)} className="flex-1 text-xs font-semibold text-ink/70 hover:text-ink inline-flex items-center justify-center gap-1"><Pencil size={12} /> Edit</button>
                    <button onClick={() => deleteItem(it)} className="flex-1 text-xs font-semibold text-chili-dark inline-flex items-center justify-center gap-1"><Trash2 size={12} /> Delete</button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setEditingItem("new")}
              className="aspect-square min-h-[200px] rounded-2xl border-2 border-dashed border-ink/25 text-clay hover:border-sprout hover:text-sprout-dark flex flex-col items-center justify-center gap-2">
              <Plus size={28} /><span className="text-sm font-semibold">Add item</span>
            </button>
          </div>
        </div>
      )}

      {editingItem && (
        <ItemFormModal
          restaurant={restaurant}
          categoryId={selected}
          categories={categories}
          item={editingItem === "new" ? null : editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={(saved) => {
            setItems((p) => (p.some((i) => i.id === saved.id) ? p.map((i) => (i.id === saved.id ? saved : i)) : [...p, saved]));
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}
