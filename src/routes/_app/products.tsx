import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtKES, fmtNum } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Plus, X, Pencil, PackagePlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
  head: () => ({ meta: [{ title: "Inventory · Bei Poa" }] }),
});

type Cat = { id: string; name: string };
type Product = { id: string; sku: string; barcode: string | null; name: string; category_id: string | null;
  unit: string; bulk_unit: string | null; units_per_bulk: number;
  cost_price: number; retail_price: number; wholesale_price: number; stock_quantity: number;
  min_stock: number; is_active: boolean; image_url: string | null; };

const COMMON_BULK = ["bag", "sack", "carton", "box", "crate", "case", "pack", "bale", "bundle", "tray", "dozen"];

function ProductsPage() {
  const { isAdmin, user } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [search, setSearch] = useState("");

  const load = () => {
    supabase.from("products").select("*").order("name").then(({ data }) => setItems((data as any) ?? []));
    supabase.from("product_categories").select("id, name").order("name").then(({ data }) => setCats((data as any) ?? []));
  };
  useEffect(load, []);

  const save = async () => {
    if (!editing) return;
    const payload: any = {
      sku: editing.sku?.trim() || undefined,
      barcode: editing.barcode || null,
      name: editing.name, category_id: editing.category_id || null,
      unit: editing.unit || "pcs",
      bulk_unit: editing.bulk_unit || null,
      units_per_bulk: Number(editing.units_per_bulk ?? 1) || 1,
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
                <th className="px-4 py-3 text-left">Pack</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Retail</th>
                <th className="px-4 py-3 text-right">Wholesale</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-left">Status</th>
                {isAdmin && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && <tr><td colSpan={isAdmin ? 9 : 8} className="text-center py-12 text-xs text-muted-foreground">No products. {isAdmin && "Click ADD PRODUCT to start."}</td></tr>}
              {filtered.map(p => {
                const low = Number(p.stock_quantity) <= Number(p.min_stock);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-3 font-semibold">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {p.bulk_unit ? `1 ${p.bulk_unit} = ${fmtNum(p.units_per_bulk)} ${p.unit}` : `—`}
                    </td>
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
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setStockTarget(p)} title="Add stock" className="p-1.5 hover:bg-primary/10 text-primary"><PackagePlus className="size-3.5" /></button>
                        <button onClick={() => setEditing(p)} title="Edit" className="p-1.5 hover:bg-muted"><Pencil className="size-3.5" /></button>
                        <button onClick={() => remove(p.id)} title="Delete" className="p-1.5 hover:bg-destructive/10 text-destructive"><X className="size-3.5" /></button>
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
          <div className="bg-card border border-border w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-display font-extrabold">{editing.id ? "EDIT PRODUCT" : "NEW PRODUCT"}</h2>
              <button onClick={() => setEditing(null)}><X className="size-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Name" full><input value={editing.name ?? ""} onChange={e => setEditing({ ...editing, name: e.target.value })} className={inputCls} /></Field>
              <Field label="Serial #"><input value={editing.sku ?? ""} onChange={e => setEditing({ ...editing, sku: e.target.value })} placeholder="auto (e.g. 001)" className={inputCls} /></Field>
              <Field label="Barcode"><input value={editing.barcode ?? ""} onChange={e => setEditing({ ...editing, barcode: e.target.value })} className={inputCls} /></Field>
              <Field label="Category">
                <select value={editing.category_id ?? ""} onChange={e => setEditing({ ...editing, category_id: e.target.value })} className={inputCls}>
                  <option value="">—</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Base Unit (piece)"><input value={editing.unit ?? "pcs"} onChange={e => setEditing({ ...editing, unit: e.target.value })} placeholder="pcs, kg, ltr" className={inputCls} /></Field>
              <Field label="Bulk Unit (optional)">
                <input list="bulk-units" value={editing.bulk_unit ?? ""} onChange={e => setEditing({ ...editing, bulk_unit: e.target.value })} placeholder="bag, carton…" className={inputCls} />
                <datalist id="bulk-units">{COMMON_BULK.map(u => <option key={u} value={u} />)}</datalist>
              </Field>
              <Field label={`Pieces per ${editing.bulk_unit || "bulk"}`}><input type="number" min={1} value={editing.units_per_bulk ?? 1} onChange={e => setEditing({ ...editing, units_per_bulk: Number(e.target.value) })} className={inputCls} /></Field>
              <Field label="Cost (KES)"><input type="number" value={editing.cost_price ?? 0} onChange={e => setEditing({ ...editing, cost_price: Number(e.target.value) })} className={inputCls} /></Field>
              <Field label="Retail Price (KES)"><input type="number" value={editing.retail_price ?? 0} onChange={e => setEditing({ ...editing, retail_price: Number(e.target.value) })} className={inputCls} /></Field>
              <Field label="Wholesale Price (KES)"><input type="number" value={editing.wholesale_price ?? 0} onChange={e => setEditing({ ...editing, wholesale_price: Number(e.target.value) })} className={inputCls} /></Field>
              <Field label="Opening Stock (pieces)"><input type="number" value={editing.stock_quantity ?? 0} onChange={e => setEditing({ ...editing, stock_quantity: Number(e.target.value) })} className={inputCls} /></Field>
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

      {stockTarget && (
        <AddStockDialog product={stockTarget} userId={user?.id} onClose={() => setStockTarget(null)} onDone={() => { setStockTarget(null); load(); }} />
      )}
    </div>
  );
}

function AddStockDialog({ product, userId, onClose, onDone }: { product: Product; userId?: string; onClose: () => void; onDone: () => void }) {
  const hasBulk = !!product.bulk_unit && Number(product.units_per_bulk) > 1;
  const [mode, setMode] = useState<"piece" | "bulk">(hasBulk ? "bulk" : "piece");
  const [qty, setQty] = useState<number>(1);
  const [reason, setReason] = useState("Stock-in");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const pieces = mode === "bulk" ? Number(qty) * Number(product.units_per_bulk || 1) : Number(qty);

  const submit = async () => {
    if (!pieces || pieces <= 0) { toast.error("Enter a quantity"); return; }
    setBusy(true);
    const newQty = Number(product.stock_quantity) + pieces;
    const { error: e1 } = await supabase.from("products").update({ stock_quantity: newQty, updated_at: new Date().toISOString() }).eq("id", product.id);
    if (e1) { toast.error(e1.message); setBusy(false); return; }
    const { error: e2 } = await supabase.from("stock_movements").insert({
      product_id: product.id, type: "in", quantity: pieces,
      reason: mode === "bulk" ? `${reason} (${qty} ${product.bulk_unit})` : reason,
      reference: reference || null, created_by: userId,
    });
    if (e2) { toast.error(e2.message); setBusy(false); return; }
    toast.success(`Added ${fmtNum(pieces)} ${product.unit}`);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-lg font-display font-extrabold">ADD STOCK</h2>
          <button onClick={onClose}><X className="size-5" /></button>
        </div>
        <div className="text-xs text-muted-foreground mb-4 font-mono">
          {product.name} · current: <span className="text-foreground font-bold">{fmtNum(product.stock_quantity)} {product.unit}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => setMode("piece")}
            className={`py-2 text-xs font-bold uppercase tracking-widest border ${mode === "piece" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            By {product.unit}
          </button>
          <button onClick={() => setMode("bulk")} disabled={!hasBulk}
            className={`py-2 text-xs font-bold uppercase tracking-widest border disabled:opacity-40 disabled:cursor-not-allowed ${mode === "bulk" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            By {product.bulk_unit || "bulk"}
          </button>
        </div>

        {!hasBulk && (
          <div className="text-[11px] text-muted-foreground mb-3">
            Tip: set a Bulk Unit (e.g. bag, carton) on this product to receive stock in bulks.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label={`Quantity (${mode === "bulk" ? product.bulk_unit : product.unit})`}>
            <input type="number" min={0} step="any" value={qty} onChange={e => setQty(Number(e.target.value))} autoFocus className={inputCls} />
          </Field>
          <Field label="= Pieces added">
            <div className={`${inputCls} bg-muted font-bold`}>{fmtNum(pieces)} {product.unit}</div>
          </Field>
          <Field label="Reason"><input value={reason} onChange={e => setReason(e.target.value)} className={inputCls} /></Field>
          <Field label="Reference (PO, supplier…)"><input value={reference} onChange={e => setReference(e.target.value)} className={inputCls} /></Field>
        </div>

        <div className="flex justify-between items-center mt-6">
          <div className="text-xs font-mono text-muted-foreground">
            New total: <span className="text-foreground font-bold">{fmtNum(Number(product.stock_quantity) + pieces)} {product.unit}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-muted">Cancel</button>
            <button onClick={submit} disabled={busy} className="bg-primary text-primary-foreground px-6 py-2 text-xs font-display font-extrabold tracking-tight disabled:opacity-50">ADD STOCK</button>
          </div>
        </div>
      </div>
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
