import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES, fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Download, Printer, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { printThermalReceipt } from "@/lib/receipt";

export const Route = createFileRoute("/_app/sales")({
  component: SalesPage,
  head: () => ({ meta: [{ title: "Sales · Bei Poa" }] }),
});

type Sale = {
  id: string; sale_number: string; total: number; subtotal: number; tax: number; discount: number;
  payment_method: string; status: string; is_wholesale: boolean; created_at: string;
  mpesa_reference: string | null;
  customers: { name: string } | null;
};

function SalesPage() {
  const [items, setItems] = useState<Sale[]>([]);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0,10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const load = () => {
    const fromD = new Date(from); fromD.setHours(0,0,0,0);
    const toD = new Date(to); toD.setHours(23,59,59,999);
    supabase.from("sales").select("*, customers(name)")
      .gte("created_at", fromD.toISOString()).lte("created_at", toD.toISOString())
      .order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setItems((data as any) ?? []));
  };
  useEffect(load, [from, to]);

  const totalSales = items.reduce((s, x) => s + Number(x.total), 0);
  const totalTax = items.reduce((s, x) => s + Number(x.tax), 0);
  const mpesa = items.filter(x => x.payment_method === "mpesa").reduce((s, x) => s + Number(x.total), 0);
  const cash = items.filter(x => x.payment_method === "cash").reduce((s, x) => s + Number(x.total), 0);

  const saveRef = async (id: string) => {
    const ref = editVal.trim().toUpperCase();
    const { error } = await supabase.from("sales").update({ mpesa_reference: ref || null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("M-Pesa reference saved");
    setEditing(null); setEditVal(""); load();
  };

  const reprint = async (s: Sale) => {
    const { data } = await supabase.from("sale_items").select("product_name, quantity, unit_price").eq("sale_id", s.id);
    printThermalReceipt({
      saleNumber: s.sale_number, createdAt: s.created_at,
      customer: s.customers?.name, isWholesale: s.is_wholesale,
      paymentMethod: s.payment_method as "cash" | "mpesa",
      mpesaReference: s.mpesa_reference ?? undefined,
      items: (data ?? []).map((i: any) => ({ name: i.product_name, qty: Number(i.quantity), price: Number(i.unit_price) })),
      subtotal: Number(s.subtotal), discount: Number(s.discount), tax: Number(s.tax), total: Number(s.total),
    });
  };

  const exportCsv = () => {
    const rows = [
      ["Sale #", "Date", "Customer", "Method", "M-Pesa Ref", "Type", "Subtotal", "Discount", "Tax", "Total", "Status"],
      ...items.map(s => [s.sale_number, fmtDateTime(s.created_at), s.customers?.name ?? "Walk-in",
        s.payment_method, s.mpesa_reference ?? "", s.is_wholesale ? "Wholesale" : "Retail",
        s.subtotal, s.discount, s.tax, s.total, s.status]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `sales-${from}-to-${to}.csv`; a.click();
  };

  return (
    <div className="animate-in">
      <PageHeader title="Sales Report" subtitle={`${items.length} transactions`}
        actions={
          <button onClick={exportCsv} className="border border-border px-4 py-2 text-xs font-display font-extrabold tracking-tight flex items-center gap-2 hover:bg-muted">
            <Download className="size-4" /> EXPORT CSV
          </button>
        } />
      <div className="p-8 space-y-6">
        <div className="flex gap-3 items-end">
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">From</div>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-secondary border border-border px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">To</div>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-secondary border border-border px-3 py-2 text-sm" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card label="Total Sales" value={fmtKES(totalSales)} />
          <Card label="Mpesa" value={fmtKES(mpesa)} />
          <Card label="Cash" value={fmtKES(cash)} />
          <Card label="VAT Collected" value={fmtKES(totalTax)} />
        </div>

        <div className="border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Sale #</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">M-Pesa Ref</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-xs text-muted-foreground">No sales in this range.</td></tr>}
              {items.map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{s.sale_number}</td>
                  <td className="px-4 py-3 text-xs">{fmtDateTime(s.created_at)}</td>
                  <td className="px-4 py-3">{s.customers?.name ?? "Walk-in"}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold tracking-widest uppercase ${s.payment_method === "mpesa" ? "text-primary" : ""}`}>{s.payment_method}</span></td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {editing === s.id ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value.toUpperCase())}
                          onKeyDown={e => { if (e.key === "Enter") saveRef(s.id); if (e.key === "Escape") setEditing(null); }}
                          placeholder="SGH7K2M4LP"
                          className="bg-secondary border border-border px-2 py-1 w-32 uppercase tracking-widest outline-none focus:ring-1 focus:ring-primary" />
                        <button onClick={() => saveRef(s.id)} className="p-1 text-primary hover:bg-muted"><Check className="size-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditing(s.id); setEditVal(s.mpesa_reference ?? ""); }}
                        className="inline-flex items-center gap-1 hover:text-primary group">
                        <span>{s.mpesa_reference ?? <span className="text-muted-foreground italic normal-case">add…</span>}</span>
                        <Pencil className="size-3 opacity-0 group-hover:opacity-100" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{s.is_wholesale ? "Wholesale" : "Retail"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{fmtKES(s.total)}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold uppercase tracking-widest ${s.status === "completed" ? "text-primary" : "text-warning"}`}>{s.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => reprint(s)} title="Reprint receipt"
                      className="p-1.5 border border-border hover:bg-muted hover:border-primary"><Printer className="size-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card p-5">
      <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">{label}</p>
      <p className="text-2xl font-display font-extrabold tracking-tight mt-2">{value}</p>
    </div>
  );
}
