import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtKES, fmtNum } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Plus, X, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
  head: () => ({ meta: [{ title: "Inventory · Bei Poa" }] }),
});

type Cat = { id: string; name: string };
type Product = { id: string; sku: string; barcode: string | null; name: string; category_id: string | null;
  unit: string; cost_price: number; retail_price: number; wholesale_price: number; stock_quantity: number;
  min_stock: number; is_active: boolean; image_url: string | null; };

function ProductsPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [search, setSearch] = useState("");

  const load = () => {
    supabase.from("products").select("*").order("name").then(({ data }) => setItems((data as any) ?? []));
    supabase.from("product_categories").select("id, name").order("name").then(({ data }) => setCats((data as any) ?? []));
  };
  useEffect(load, []);

  const save = async () => {
    if (!editing) return;
    const payload: any = {
      sku: editing.sku || `SKU-${Date.now().toString().slice(-6)}`,
      barcode: editing.barcode || null,
      name: editing.name, category_id: editing.category_id || null,
      unit: editing.unit || "pcs",
      cost_price: Number(editing.cost_price ?? 0),
      retail_price: Number(editing.retail_price ?? 0),
      wholesale_price: Number(editing.wholesale_price ?? 0),
      stock_quantity: Number(editing.stock_quantity ?? 0),
      min_stock: Number(editing.min_stock ?? 5),
      image_url: editing.image_url || null,
      is_active: editing.is_active ?? true,
    };
    if (!payload.name) { toast.error("Name required"); return; }
    const { error } = editing.id
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const filtered = items.filter(p => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  return (
    <div className="animate-in">
      <PageHeader title="Inventory" subtitle={`${items.length} products`}
        actions={isAdmin && (
          <button onClick={() => setEditing({})} className="bg-primary text-primary-foreground px-4 py-2 text-xs font-display font-extrabold tracking-tight flex items-center gap-2 hover:bg-primary/90">
            <Plus className="size-4" /> ADD PRODUCT
          </button>
        )} />
      <div className="p-8">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
          className="w-full max-w-md bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary mb-4" />
        <div className="border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Retail</th>
                <th className="px-4 py-3 text-right">Wholesale</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-left">Status</th>
                {isAdmin && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-12 text-xs text-muted-foreground">No products. {isAdmin && "Click ADD PRODUCT to start."}</td></tr>}
              {filtered.map(p => {
                const low = Number(p.stock_quantity) <= Number(p.min_stock);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-3 font-semibold">{p.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtKES(p.cost_price)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtKES(p.retail_price)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtKES(p.wholesale_price)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${low ? "text-destructive" : ""}`}>{fmtNum(p.stock_quantity)} {p.unit}</td>
                    <td className="px-4 py-3">
                      {!p.is_active ? <span className="text-[10px] bg-muted px-2 py-0.5 font-bold uppercase">Inactive</span> :
                       low ? <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 font-bold uppercase">Low</span> :
                       <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 font-bold uppercase">OK</span>}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setEditing(p)} className="p-1.5 hover:bg-muted"><Pencil className="size-3.5" /></button>
                        <button onClick={() => remove(p.id)} className="p-1.5 hover:bg-destructive/10 text-destructive"><X className="size-3.5" /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card border border-border w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-display font-extrabold">{editing.id ? "EDIT PRODUCT" : "NEW PRODUCT"}</h2>
              <button onClick={() => setEditing(null)}><X className="size-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Name" full><input value={editing.name ?? ""} onChange={e => setEditing({ ...editing, name: e.target.value })} className={inputCls} /></Field>
              <Field label="SKU"><input value={editing.sku ?? ""} onChange={e => setEditing({ ...editing, sku: e.target.value })} placeholder="auto" className={inputCls} /></Field>
              <Field label="Barcode"><input value={editing.barcode ?? ""} onChange={e => setEditing({ ...editing, barcode: e.target.value })} className={inputCls} /></Field>
              <Field label="Category">
                <select value={editing.category_id ?? ""} onChange={e => setEditing({ ...editing, category_id: e.target.value })} className={inputCls}>
                  <option value="">—</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Unit"><input value={editing.unit ?? "pcs"} onChange={e => setEditing({ ...editing, unit: e.target.value })} className={inputCls} /></Field>
              <Field label="Cost (KES)"><input type="number" value={editing.cost_price ?? 0} onChange={e => setEditing({ ...editing, cost_price: Number(e.target.value) })} className={inputCls} /></Field>
              <Field label="Retail Price (KES)"><input type="number" value={editing.retail_price ?? 0} onChange={e => setEditing({ ...editing, retail_price: Number(e.target.value) })} className={inputCls} /></Field>
              <Field label="Wholesale Price (KES)"><input type="number" value={editing.wholesale_price ?? 0} onChange={e => setEditing({ ...editing, wholesale_price: Number(e.target.value) })} className={inputCls} /></Field>
              <Field label="Stock Qty"><input type="number" value={editing.stock_quantity ?? 0} onChange={e => setEditing({ ...editing, stock_quantity: Number(e.target.value) })} className={inputCls} /></Field>
              <Field label="Min Stock"><input type="number" value={editing.min_stock ?? 5} onChange={e => setEditing({ ...editing, min_stock: Number(e.target.value) })} className={inputCls} /></Field>
              <Field label="Image URL" full><input value={editing.image_url ?? ""} onChange={e => setEditing({ ...editing, image_url: e.target.value })} className={inputCls} /></Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-muted">Cancel</button>
              <button onClick={save} className="bg-primary text-primary-foreground px-6 py-2 text-xs font-display font-extrabold tracking-tight">SAVE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full bg-secondary border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={full ? "col-span-2" : ""}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
