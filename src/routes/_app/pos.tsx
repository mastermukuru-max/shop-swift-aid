import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtKES } from "@/lib/format";
import { Search, Trash2, Plus, Minus, X, Printer } from "lucide-react";
import { toast } from "sonner";
import { printThermalReceipt } from "@/lib/receipt";

export const Route = createFileRoute("/_app/pos")({
  component: POS,
  head: () => ({ meta: [{ title: "POS Terminal · Bei Poa" }] }),
});

type Product = {
  id: string; sku: string; name: string; barcode: string | null;
  retail_price: number; wholesale_price: number; stock_quantity: number; image_url: string | null;
};
type CartItem = { product: Product; qty: number; price: number };
type Customer = { id: string; name: string; type: "retail" | "wholesale" };

function POS() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [isWholesale, setIsWholesale] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paying, setPaying] = useState<null | "cash" | "mpesa" | "credit">(null);
  const [mpesaRef, setMpesaRef] = useState("");
  const [deposit, setDeposit] = useState(0);
  const [autoPrint, setAutoPrint] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    supabase.from("products").select("id, sku, name, barcode, retail_price, wholesale_price, stock_quantity, image_url").eq("is_active", true).order("name").then(({ data }) => setProducts((data as any) ?? []));
    supabase.from("customers").select("id, name, type").order("name").then(({ data }) => setCustomers((data as any) ?? []));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 24);
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode?.toLowerCase() ?? "").includes(q)).slice(0, 24);
  }, [products, search]);

  const addToCart = (p: Product) => {
    if (Number(p.stock_quantity) <= 0) { toast.error("Out of stock"); return; }
    const price = Number(isWholesale ? p.wholesale_price || p.retail_price : p.retail_price);
    setCart(c => {
      const ex = c.find(x => x.product.id === p.id);
      if (ex) {
        if (ex.qty + 1 > Number(p.stock_quantity)) { toast.error("Insufficient stock"); return c; }
        return c.map(x => x.product.id === p.id ? { ...x, qty: x.qty + 1 } : x);
      }
      return [...c, { product: p, qty: 1, price }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setCart(c => c.flatMap(x => {
      if (x.product.id !== id) return [x];
      if (qty <= 0) return [];
      if (qty > Number(x.product.stock_quantity)) { toast.error("Insufficient stock"); return [x]; }
      return [{ ...x, qty }];
    }));
  };

  const subtotal = cart.reduce((s, x) => s + x.qty * x.price, 0);
  const tax = 0;
  const total = Math.max(0, subtotal - discount);

  const completeSale = async (method: "cash" | "mpesa" | "credit", opts?: { reference?: string; deposit?: number }) => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (!user) { toast.error("Not signed in"); return; }
    if (method === "mpesa" && !opts?.reference?.trim()) { toast.error("Enter M-Pesa SMS code"); return; }
    if (method === "credit") {
      if (!customerId) { toast.error("Select a customer for credit sale"); return; }
      const cust = customers.find(c => c.id === customerId);
      if (!cust || cust.type !== "wholesale") { toast.error("Credit sales require a wholesale customer"); return; }
    }
    const depositAmt = method === "credit" ? Math.min(Math.max(0, opts?.deposit ?? 0), total) : total;
    const balanceOwed = method === "credit" ? Math.max(0, total - depositAmt) : 0;
    setBusy(true);
    try {
      const saleNumber = `S-${Date.now().toString().slice(-8)}`;
      const { data: sale, error: saleErr } = await supabase.from("sales").insert({
        sale_number: saleNumber,
        customer_id: customerId || null,
        cashier_id: user.id,
        subtotal, tax, discount, total,
        amount_paid: depositAmt,
        payment_method: method,
        status: method === "credit" && balanceOwed > 0 ? "pending" : "completed",
        is_wholesale: isWholesale,
        mpesa_reference: method === "mpesa" ? opts!.reference!.trim().toUpperCase() : null,
        notes: method === "credit" ? `Credit sale. Deposit: ${depositAmt}. Balance: ${balanceOwed}` : null,
      }).select().single();
      if (saleErr) throw saleErr;

      const items = cart.map(x => ({
        sale_id: sale.id, product_id: x.product.id, product_name: x.product.name,
        quantity: x.qty, unit_price: x.price, total: x.qty * x.price,
      }));
      const { error: itemsErr } = await supabase.from("sale_items").insert(items);
      if (itemsErr) throw itemsErr;

      if (method === "credit" && balanceOwed > 0) {
        const cust = customers.find(c => c.id === customerId);
        const { data: cur } = await supabase.from("customers").select("balance").eq("id", customerId).single();
        const newBal = Number(cur?.balance ?? 0) + balanceOwed;
        const { error: balErr } = await supabase.from("customers").update({ balance: newBal }).eq("id", customerId);
        if (balErr) throw balErr;
        void cust;
      }

      const cust = customers.find(c => c.id === customerId)?.name;
      const receipt = {
        saleNumber, createdAt: sale.created_at ?? new Date().toISOString(),
        cashier: user.email ?? undefined, customer: cust, isWholesale,
        paymentMethod: method === "credit" ? "cash" as const : method,
        mpesaReference: opts?.reference?.trim().toUpperCase(),
        items: cart.map(x => ({ name: x.product.name, qty: x.qty, price: x.price })),
        subtotal, discount, tax, total,
      };
      if (autoPrint) printThermalReceipt(receipt);

      if (method === "credit") {
        toast.success(`Credit sale ${saleNumber} — deposit ${fmtKES(depositAmt)}, balance ${fmtKES(balanceOwed)}`);
      } else {
        toast.success(`Sale ${saleNumber} completed — ${fmtKES(total)}`);
      }
      setCart([]); setDiscount(0); setCustomerId(""); setPaying(null); setMpesaRef(""); setDeposit(0);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Sale failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] h-screen">
      {/* Products area */}
      <div className="flex flex-col bg-background overflow-hidden">
        <div className="border-b border-border p-4 bg-card">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="SEARCH NAME, SKU OR SCAN BARCODE…"
                className="w-full bg-secondary pl-10 pr-3 py-3 font-mono text-sm uppercase outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/60"
              />
            </div>
            <label className="flex items-center gap-2 px-4 py-3 bg-secondary cursor-pointer text-xs font-bold uppercase tracking-widest">
              <input type="checkbox" checked={isWholesale} onChange={e => setIsWholesale(e.target.checked)} />
              Wholesale
            </label>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-sm text-muted-foreground">
              No products. Add some in <a href="/products" className="text-primary font-bold underline">Inventory →</a>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(p => {
                const low = Number(p.stock_quantity) <= 5;
                const out = Number(p.stock_quantity) <= 0;
                const price = isWholesale ? p.wholesale_price || p.retail_price : p.retail_price;
                return (
                  <button key={p.id} onClick={() => addToCart(p)} disabled={out}
                    className="text-left bg-card border border-border p-3 hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <div className="aspect-square bg-secondary mb-2 grid place-items-center text-[10px] font-mono text-muted-foreground tracking-widest">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : "NO IMAGE"}
                    </div>
                    <p className="text-xs font-bold uppercase truncate">{p.name}</p>
                    <p className={`text-sm font-mono mt-1 font-semibold ${low ? "text-destructive" : ""}`}>{fmtKES(price)}</p>
                    <p className={`text-[10px] font-mono ${low ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                      {out ? "OUT OF STOCK" : `STOCK: ${p.stock_quantity}`}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="bg-surface text-surface-foreground flex flex-col overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-extrabold tracking-tight">CURRENT CART</h2>
            <p className="text-xs font-mono text-white/50">{cart.length} items</p>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-[10px] font-bold text-red-400 uppercase tracking-widest hover:text-red-300">
              Clear
            </button>
          )}
        </div>

        <div className="px-5 py-3 border-b border-white/10">
          <select value={customerId} onChange={e => setCustomerId(e.target.value)}
            className="w-full bg-white/10 px-3 py-2 text-sm outline-none">
            <option value="" className="text-foreground">Walk-in customer</option>
            {customers.map(c => <option key={c.id} value={c.id} className="text-foreground">{c.name} ({c.type})</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {cart.length === 0 && <p className="text-xs text-white/40 text-center mt-12 font-mono uppercase tracking-widest">Cart empty</p>}
          {cart.map(x => (
            <div key={x.product.id} className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{x.product.name}</p>
                <p className="text-xs font-mono text-white/50">{fmtKES(x.price)} × {x.qty}</p>
                <div className="flex items-center gap-1 mt-2">
                  <button onClick={() => setQty(x.product.id, x.qty - 1)} className="p-1 bg-white/10 hover:bg-white/20"><Minus className="size-3" /></button>
                  <input type="number" value={x.qty} onChange={e => setQty(x.product.id, Number(e.target.value))}
                    className="w-14 bg-white/5 text-center text-sm py-1 outline-none" />
                  <button onClick={() => setQty(x.product.id, x.qty + 1)} className="p-1 bg-white/10 hover:bg-white/20"><Plus className="size-3" /></button>
                  <button onClick={() => setQty(x.product.id, 0)} className="p-1 ml-1 hover:text-red-400"><Trash2 className="size-3" /></button>
                </div>
              </div>
              <p className="font-mono font-bold text-sm shrink-0">{fmtKES(x.qty * x.price)}</p>
            </div>
          ))}
        </div>

        <div className="p-5 bg-white/5 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Discount</label>
            <input type="number" value={discount} onChange={e => setDiscount(Math.max(0, Number(e.target.value)))} className="flex-1 bg-white/10 px-2 py-1 text-xs font-mono outline-none" />
          </div>
          <div className="flex justify-between text-white/60 font-mono text-xs"><span>SUBTOTAL</span><span>{fmtKES(subtotal)}</span></div>
          <div className="flex justify-between items-end pt-3 border-t border-white/10">
            <span className="font-display font-extrabold">TOTAL</span>
            <span className="text-2xl font-display font-extrabold text-primary">{fmtKES(total)}</span>
          </div>

          <label className="flex items-center gap-2 text-[10px] font-mono text-white/60 uppercase tracking-widest cursor-pointer pt-1">
            <input type="checkbox" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} />
            <Printer className="size-3" /> Auto-print receipt
          </label>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button disabled={busy || cart.length === 0} onClick={() => setPaying("mpesa")}
              className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground py-3 font-display font-extrabold text-sm flex flex-col items-center">
              <span>M-PESA</span>
              <span className="text-[9px] font-mono font-normal opacity-80">ENTER SMS CODE</span>
            </button>
            <button disabled={busy || cart.length === 0} onClick={() => completeSale("cash")}
              className="bg-white text-foreground hover:bg-white/90 disabled:opacity-40 py-3 font-display font-extrabold text-sm flex flex-col items-center">
              <span>CASH</span>
              <span className="text-[9px] font-mono font-normal opacity-70">PRINT RECEIPT</span>
            </button>
          </div>
          <button disabled={busy || cart.length === 0} onClick={() => { setDeposit(0); setPaying("credit"); }}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black py-3 font-display font-extrabold text-sm flex flex-col items-center mt-2">
            <span>CREDIT · WHOLESALE DEBT</span>
            <span className="text-[9px] font-mono font-normal opacity-70">SAVE UNPAID BALANCE TO CUSTOMER</span>
          </button>
        </div>
      </div>

      {paying === "mpesa" && (
        <div className="fixed inset-0 bg-black/70 z-50 grid place-items-center p-4" onClick={() => !busy && setPaying(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-extrabold text-xl">CONFIRM M-PESA</h3>
                <p className="text-xs font-mono text-muted-foreground mt-1">Enter the SMS confirmation code from the customer.</p>
              </div>
              <button onClick={() => !busy && setPaying(null)} className="p-1 hover:bg-muted"><X className="size-4" /></button>
            </div>
            <div className="bg-secondary p-4 flex items-baseline justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Amount</span>
              <span className="text-2xl font-display font-extrabold text-primary">{fmtKES(total)}</span>
            </div>
            <label className="block">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">M-Pesa SMS Code</div>
              <input autoFocus value={mpesaRef} onChange={e => setMpesaRef(e.target.value.toUpperCase())}
                placeholder="e.g. SGH7K2M4LP"
                className="w-full bg-secondary border border-border px-3 py-3 font-mono uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary" />
              <p className="text-[10px] font-mono text-muted-foreground mt-1">10-character reference from the Safaricom SMS.</p>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={busy} onClick={() => setPaying(null)}
                className="border border-border py-3 font-display font-extrabold text-sm hover:bg-muted">CANCEL</button>
              <button disabled={busy || !mpesaRef.trim()} onClick={() => completeSale("mpesa", { reference: mpesaRef })}
                className="bg-primary text-primary-foreground py-3 font-display font-extrabold text-sm disabled:opacity-40 hover:bg-primary/90">
                {busy ? "PROCESSING…" : "CONFIRM & PRINT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {paying === "credit" && (() => {
        const cust = customers.find(c => c.id === customerId);
        const isWholesaleCust = cust?.type === "wholesale";
        const dep = Math.min(Math.max(0, deposit), total);
        const balance = Math.max(0, total - dep);
        return (
          <div className="fixed inset-0 bg-black/70 z-50 grid place-items-center p-4" onClick={() => !busy && setPaying(null)}>
            <div onClick={e => e.stopPropagation()} className="bg-card border border-border w-full max-w-md p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-extrabold text-xl">CREDIT SALE</h3>
                  <p className="text-xs font-mono text-muted-foreground mt-1">Unpaid balance is added to the customer's account.</p>
                </div>
                <button onClick={() => !busy && setPaying(null)} className="p-1 hover:bg-muted"><X className="size-4" /></button>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Wholesale Customer</div>
                <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                  className="w-full bg-secondary border border-border px-3 py-3 outline-none">
                  <option value="">Select customer…</option>
                  {customers.filter(c => c.type === "wholesale").map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {!isWholesaleCust && customerId && (
                  <p className="text-[10px] font-mono text-destructive mt-1">Selected customer is not wholesale.</p>
                )}
              </div>

              <div className="bg-secondary p-4 flex items-baseline justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Total</span>
                <span className="text-2xl font-display font-extrabold text-primary">{fmtKES(total)}</span>
              </div>

              <label className="block">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Deposit (optional)</div>
                <input type="number" autoFocus value={deposit}
                  onChange={e => setDeposit(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="w-full bg-secondary border border-border px-3 py-3 font-mono outline-none focus:ring-2 focus:ring-primary" />
              </label>

              <div className="bg-amber-500/10 border border-amber-500/30 p-4 flex items-baseline justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-600">Balance owed</span>
                <span className="text-2xl font-display font-extrabold text-amber-600">{fmtKES(balance)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button disabled={busy} onClick={() => setPaying(null)}
                  className="border border-border py-3 font-display font-extrabold text-sm hover:bg-muted">CANCEL</button>
                <button disabled={busy || !isWholesaleCust} onClick={() => completeSale("credit", { deposit: dep })}
                  className="bg-amber-500 text-black py-3 font-display font-extrabold text-sm disabled:opacity-40 hover:bg-amber-400">
                  {busy ? "SAVING…" : "SAVE CREDIT SALE"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
