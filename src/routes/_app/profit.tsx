import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES, fmtNum } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { TrendingUp, Wallet, Receipt, Download } from "lucide-react";

export const Route = createFileRoute("/_app/profit")({
  component: ProfitReport,
  head: () => ({ meta: [{ title: "Profit Report · Bei Poa" }] }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!data) throw redirect({ to: "/dashboard" });
  },
});

type Row = {
  product_id: string;
  name: string;
  sku: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
};

function ProfitReport() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); })();
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const fromIso = new Date(from + "T00:00:00").toISOString();
    const toIso = new Date(to + "T23:59:59").toISOString();
    const { data: items } = await supabase
      .from("sale_items")
      .select("product_id, product_name, quantity, unit_price, total, sales!inner(created_at, status)")
      .gte("sales.created_at", fromIso)
      .lte("sales.created_at", toIso)
      .eq("sales.status", "completed");
    const ids = Array.from(new Set((items ?? []).map((i: any) => i.product_id)));
    const { data: prods } = ids.length
      ? await supabase.from("products").select("id, sku, cost_price").in("id", ids)
      : { data: [] as any[] };
    const cost: Record<string, { sku: string; cost: number }> = {};
    (prods ?? []).forEach((p: any) => { cost[p.id] = { sku: p.sku, cost: Number(p.cost_price) }; });

    const agg: Record<string, Row> = {};
    (items ?? []).forEach((it: any) => {
      const c = cost[it.product_id];
      const qty = Number(it.quantity);
      const rev = Number(it.total);
      const itemCost = (c?.cost ?? 0) * qty;
      agg[it.product_id] ??= {
        product_id: it.product_id, name: it.product_name, sku: c?.sku ?? "—",
        qty: 0, revenue: 0, cost: 0, profit: 0,
      };
      agg[it.product_id].qty += qty;
      agg[it.product_id].revenue += rev;
      agg[it.product_id].cost += itemCost;
      agg[it.product_id].profit += rev - itemCost;
    });
    setRows(Object.values(agg).sort((a, b) => b.profit - a.profit));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const totals = useMemo(() => rows.reduce(
    (a, r) => ({ revenue: a.revenue + r.revenue, cost: a.cost + r.cost, profit: a.profit + r.profit }),
    { revenue: 0, cost: 0, profit: 0 },
  ), [rows]);
  const margin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  const exportCSV = () => {
    const head = ["SKU", "Product", "Qty Sold", "Revenue (KES)", "Cost (KES)", "Profit (KES)", "Margin %"];
    const lines = rows.map(r => [
      r.sku, `"${r.name.replace(/"/g, '""')}"`, r.qty, r.revenue.toFixed(2), r.cost.toFixed(2), r.profit.toFixed(2),
      r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(1) : "0",
    ].join(","));
    const csv = [head.join(","), ...lines, "", `TOTAL,,,${totals.revenue.toFixed(2)},${totals.cost.toFixed(2)},${totals.profit.toFixed(2)},${margin.toFixed(1)}`].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `profit-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const Stat = ({ label, value, icon: Icon, tone = "default" }: any) => (
    <div className="p-5 border border-border bg-card">
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">{label}</p>
        <Icon className={`size-4 ${tone === "good" ? "text-primary" : tone === "warn" ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <p className={`text-2xl font-display font-extrabold tracking-tight mt-2 ${tone === "warn" ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );

  return (
    <div className="animate-in">
      <PageHeader
        title="Profit Report"
        subtitle="Revenue minus cost of goods sold"
        actions={
          <button onClick={exportCSV} disabled={!rows.length} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase flex items-center gap-2 disabled:opacity-50">
            <Download className="size-4" /> Export CSV
          </button>
        }
      />
      <div className="p-8 space-y-6">
        {/* Filters */}
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-border bg-card px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-border bg-card px-3 py-2 text-sm" />
          </div>
          <button onClick={load} className="px-4 py-2 border border-border bg-card text-xs font-bold tracking-widest uppercase hover:bg-muted">
            Apply
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Stat label="Revenue" value={fmtKES(totals.revenue)} icon={Receipt} />
          <Stat label="Cost of Goods" value={fmtKES(totals.cost)} icon={Wallet} />
          <Stat label="Gross Profit" value={fmtKES(totals.profit)} icon={TrendingUp} tone={totals.profit >= 0 ? "good" : "warn"} />
          <Stat label="Margin" value={`${margin.toFixed(1)}%`} icon={TrendingUp} tone={margin >= 0 ? "good" : "warn"} />
        </div>

        {/* Table */}
        <div className="border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-display font-extrabold tracking-tight">PROFIT BY PRODUCT</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-5 py-2 text-left">Serial</th>
                <th className="px-5 py-2 text-left">Product</th>
                <th className="px-5 py-2 text-right">Qty</th>
                <th className="px-5 py-2 text-right">Revenue</th>
                <th className="px-5 py-2 text-right">Cost</th>
                <th className="px-5 py-2 text-right">Profit</th>
                <th className="px-5 py-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-muted-foreground">No sales in this period.</td></tr>}
              {rows.map(r => {
                const m = r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0;
                return (
                  <tr key={r.product_id}>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.sku}</td>
                    <td className="px-5 py-3 font-semibold">{r.name}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmtNum(r.qty)}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmtKES(r.revenue)}</td>
                    <td className="px-5 py-3 text-right font-mono text-muted-foreground">{fmtKES(r.cost)}</td>
                    <td className={`px-5 py-3 text-right font-mono font-bold ${r.profit >= 0 ? "text-primary" : "text-destructive"}`}>{fmtKES(r.profit)}</td>
                    <td className={`px-5 py-3 text-right font-mono text-xs ${m >= 0 ? "" : "text-destructive"}`}>{m.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-muted/50 border-t-2 border-border">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-[10px] font-mono uppercase tracking-widest font-bold">Total</td>
                  <td className="px-5 py-3 text-right font-mono font-bold">{fmtKES(totals.revenue)}</td>
                  <td className="px-5 py-3 text-right font-mono font-bold">{fmtKES(totals.cost)}</td>
                  <td className={`px-5 py-3 text-right font-mono font-extrabold ${totals.profit >= 0 ? "text-primary" : "text-destructive"}`}>{fmtKES(totals.profit)}</td>
                  <td className="px-5 py-3 text-right font-mono font-bold">{margin.toFixed(1)}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground font-mono">
          Profit = sale price − current cost price per unit × quantity sold. Update cost prices in Inventory to keep this accurate.
        </p>
      </div>
    </div>
  );
}
