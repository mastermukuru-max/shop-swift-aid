import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES, fmtNum } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { TrendingUp, AlertTriangle, ShoppingBag, Wallet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · Bei Poa" }] }),
});

function Dashboard() {
  const [today, setToday] = useState({ sales: 0, count: 0, mpesa: 0 });
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [chart, setChart] = useState<{ day: string; sales: number }[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  useEffect(() => {
    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
    const last7 = new Date(); last7.setDate(last7.getDate() - 6); last7.setHours(0,0,0,0);

    Promise.all([
      supabase.from("sales").select("total, payment_method").gte("created_at", startOfToday.toISOString()),
      supabase.from("products").select("id, name, sku, stock_quantity, min_stock").order("stock_quantity").limit(50),
      supabase.from("sales").select("id, sale_number, total, payment_method, status, created_at, customers(name)").order("created_at", { ascending: false }).limit(8),
      supabase.from("sales").select("total, created_at").gte("created_at", last7.toISOString()),
      supabase.from("sale_items").select("product_name, quantity, total").order("created_at", { ascending: false }).limit(500),
    ]).then(([t, p, r, w, items]) => {
      const tdata = t.data ?? [];
      setToday({
        sales: tdata.reduce((s, x: any) => s + Number(x.total), 0),
        count: tdata.length,
        mpesa: tdata.filter((x: any) => x.payment_method === "mpesa").reduce((s, x: any) => s + Number(x.total), 0),
      });
      setStockAlerts((p.data ?? []).filter((x: any) => Number(x.stock_quantity) <= Number(x.min_stock)).slice(0, 6));
      setRecent(r.data ?? []);

      // 7-day chart
      const buckets: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
        buckets[d.toISOString().slice(0,10)] = 0;
      }
      (w.data ?? []).forEach((s: any) => {
        const k = new Date(s.created_at).toISOString().slice(0,10);
        if (k in buckets) buckets[k] += Number(s.total);
      });
      setChart(Object.entries(buckets).map(([k, v]) => ({
        day: new Date(k).toLocaleDateString("en-KE", { weekday: "short" }), sales: v,
      })));

      // Top products
      const agg: Record<string, { name: string; qty: number; total: number }> = {};
      (items.data ?? []).forEach((it: any) => {
        agg[it.product_name] ??= { name: it.product_name, qty: 0, total: 0 };
        agg[it.product_name].qty += Number(it.quantity);
        agg[it.product_name].total += Number(it.total);
      });
      setTopProducts(Object.values(agg).sort((a, b) => b.total - a.total).slice(0, 5));
    });
  }, []);

  const Stat = ({ label, value, hint, icon: Icon, tone = "default" }: any) => (
    <div className="p-5 border border-border bg-card">
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">{label}</p>
        <Icon className={`size-4 ${tone === "warn" ? "text-destructive" : tone === "good" ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <p className={`text-2xl font-display font-extrabold tracking-tight mt-2 ${tone === "warn" ? "text-destructive" : ""}`}>{value}</p>
      {hint && <p className="text-[10px] text-primary font-bold tracking-widest uppercase mt-2">{hint}</p>}
    </div>
  );

  return (
    <div className="animate-in">
      <PageHeader title="Store Overview" subtitle={new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} />
      <div className="p-8 space-y-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Stat label="Today's Sales" value={fmtKES(today.sales)} hint={`${today.count} transactions`} icon={TrendingUp} tone="good" />
          <Stat label="Mpesa Revenue" value={fmtKES(today.mpesa)} hint={today.sales > 0 ? `${Math.round(today.mpesa/today.sales*100)}% of total` : "—"} icon={Wallet} tone="good" />
          <Stat label="Transactions" value={fmtNum(today.count)} hint="Today" icon={ShoppingBag} />
          <Stat label="Stock Alerts" value={`${stockAlerts.length} items`} hint={stockAlerts.length ? "Restock urgently" : "All good"} icon={AlertTriangle} tone={stockAlerts.length ? "warn" : "default"} />
        </div>

        {/* Chart + alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 border border-border bg-card p-5">
            <h3 className="text-sm font-display font-extrabold mb-4 tracking-tight">SALES — LAST 7 DAYS</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `${v/1000}k`} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} formatter={(v: any) => fmtKES(v)} />
                  <Line type="monotone" dataKey="sales" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="border border-border bg-card p-5">
            <h3 className="text-sm font-display font-extrabold mb-4 tracking-tight">LOW STOCK</h3>
            <div className="space-y-2">
              {stockAlerts.length === 0 && <p className="text-xs text-muted-foreground">No stock alerts.</p>}
              {stockAlerts.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{p.sku}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-destructive shrink-0">{fmtNum(p.stock_quantity)} left</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent + top */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 border border-border bg-card">
            <div className="px-5 py-4 border-b border-border"><h3 className="text-sm font-display font-extrabold tracking-tight">RECENT TRANSACTIONS</h3></div>
            <table className="w-full text-sm">
              <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <tr><th className="px-5 py-2 text-left">Sale #</th><th className="px-5 py-2 text-left">Customer</th><th className="px-5 py-2 text-left">Method</th><th className="px-5 py-2 text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-xs text-muted-foreground">No sales yet — make your first sale in the POS.</td></tr>}
                {recent.map((s: any) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3 font-mono text-xs">{s.sale_number}</td>
                    <td className="px-5 py-3">{s.customers?.name ?? "Walk-in"}</td>
                    <td className="px-5 py-3"><span className={`text-[10px] font-bold tracking-widest uppercase ${s.payment_method === "mpesa" ? "text-primary" : ""}`}>{s.payment_method}</span></td>
                    <td className="px-5 py-3 text-right font-mono font-bold">{fmtKES(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border border-border bg-card">
            <div className="px-5 py-4 border-b border-border"><h3 className="text-sm font-display font-extrabold tracking-tight">TOP PRODUCTS</h3></div>
            <div className="p-3 space-y-2">
              {topProducts.length === 0 && <p className="text-xs text-muted-foreground p-2">No data yet.</p>}
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 p-2">
                  <span className="font-mono text-xs text-muted-foreground w-5">{(i+1).toString().padStart(2,"0")}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{fmtNum(p.qty)} sold</p>
                  </div>
                  <span className="font-mono text-xs font-bold">{fmtKES(p.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
