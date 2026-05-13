import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES, fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_app/sales")({
  component: SalesPage,
  head: () => ({ meta: [{ title: "Sales · Bei Poa" }] }),
});

type Sale = { id: string; sale_number: string; total: number; subtotal: number; tax: number; discount: number;
  payment_method: string; status: string; is_wholesale: boolean; created_at: string; customers: { name: string } | null };

function SalesPage() {
  const [items, setItems] = useState<Sale[]>([]);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0,10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));

  useEffect(() => {
    const fromD = new Date(from); fromD.setHours(0,0,0,0);
    const toD = new Date(to); toD.setHours(23,59,59,999);
    supabase.from("sales").select("*, customers(name)")
      .gte("created_at", fromD.toISOString()).lte("created_at", toD.toISOString())
      .order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setItems((data as any) ?? []));
  }, [from, to]);

  const totalSales = items.reduce((s, x) => s + Number(x.total), 0);
  const totalTax = items.reduce((s, x) => s + Number(x.tax), 0);
  const mpesa = items.filter(x => x.payment_method === "mpesa").reduce((s, x) => s + Number(x.total), 0);
  const cash = items.filter(x => x.payment_method === "cash").reduce((s, x) => s + Number(x.total), 0);

  const exportCsv = () => {
    const rows = [
      ["Sale #", "Date", "Customer", "Method", "Type", "Subtotal", "Discount", "Tax", "Total", "Status"],
      ...items.map(s => [s.sale_number, fmtDateTime(s.created_at), s.customers?.name ?? "Walk-in",
        s.payment_method, s.is_wholesale ? "Wholesale" : "Retail",
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

        <div className="border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Sale #</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-xs text-muted-foreground">No sales in this range.</td></tr>}
              {items.map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{s.sale_number}</td>
                  <td className="px-4 py-3 text-xs">{fmtDateTime(s.created_at)}</td>
                  <td className="px-4 py-3">{s.customers?.name ?? "Walk-in"}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold tracking-widest uppercase ${s.payment_method === "mpesa" ? "text-primary" : ""}`}>{s.payment_method}</span></td>
                  <td className="px-4 py-3 text-xs">{s.is_wholesale ? "Wholesale" : "Retail"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{fmtKES(s.total)}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold uppercase tracking-widest ${s.status === "completed" ? "text-primary" : "text-warning"}`}>{s.status}</span></td>
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
