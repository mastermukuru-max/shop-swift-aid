import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES, fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Download, X } from "lucide-react";

export const Route = createFileRoute("/_app/customer-report")({
  component: CustomerReportPage,
  head: () => ({
    meta: [
      { title: "Customer Report · Bei Poa Stores" },
      { name: "description", content: "Per-customer purchase totals, outstanding balances and full payment history for Bei Poa Stores." },
      { property: "og:title", content: "Customer Report · Bei Poa Stores" },
      { property: "og:description", content: "Track customer purchases, debts and payment history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Customer = { id: string; name: string; phone: string | null; type: string; balance: number; credit_limit: number; loyalty_points: number };
type Sale = { id: string; sale_number: string; customer_id: string | null; total: number; amount_paid: number; payment_method: string; created_at: string };
type Payment = { id: string; customer_id: string; amount: number; method: string; reference: string | null; created_at: string };

function CustomerReportPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: cs }, { data: ss }, { data: ps }] = await Promise.all([
        supabase.from("customers").select("*").order("name"),
        supabase.from("sales").select("id, sale_number, customer_id, total, amount_paid, payment_method, created_at").order("created_at", { ascending: false }),
        supabase.from("customer_payments").select("id, customer_id, amount, method, reference, created_at").order("created_at", { ascending: false }),
      ]);
      setCustomers((cs as any) ?? []);
      setSales((ss as any) ?? []);
      setPayments((ps as any) ?? []);
    })();
  }, []);

  const rows = useMemo(() => {
    return customers.map(c => {
      const cSales = sales.filter(s => s.customer_id === c.id);
      const cPays = payments.filter(p => p.customer_id === c.id);
      return {
        c,
        orders: cSales.length,
        purchased: cSales.reduce((s, x) => s + Number(x.total), 0),
        paidAtTill: cSales.reduce((s, x) => s + Number(x.amount_paid), 0),
        settled: cPays.reduce((s, x) => s + Number(x.amount), 0),
        last: cSales[0]?.created_at ?? null,
        sales: cSales,
        pays: cPays,
      };
    }).filter(r => !q || r.c.name.toLowerCase().includes(q.toLowerCase()) || (r.c.phone ?? "").includes(q));
  }, [customers, sales, payments, q]);

  const totals = rows.reduce(
    (a, r) => ({ purchased: a.purchased + r.purchased, settled: a.settled + r.settled, debt: a.debt + Number(r.c.balance) }),
    { purchased: 0, settled: 0, debt: 0 },
  );

  const open = rows.find(r => r.c.id === openId) ?? null;

  const exportCSV = () => {
    const out: string[][] = [["Customer", "Phone", "Type", "Orders", "Total Purchased", "Paid At Sale", "Debt Payments", "Outstanding", "Loyalty Points", "Last Purchase"]];
    rows.forEach(r => out.push([
      r.c.name, r.c.phone ?? "", r.c.type, String(r.orders), String(r.purchased),
      String(r.paidAtTill), String(r.settled), String(r.c.balance), String(r.c.loyalty_points),
      r.last ? new Date(r.last).toLocaleString() : "",
    ]));
    out.push([]);
    out.push(["TOTALS", "", "", "", String(totals.purchased), "", String(totals.settled), String(totals.debt), "", ""]);
    const csv = out.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-in">
      <PageHeader
        title="Customer Report"
        subtitle={`${rows.length} customers · ${fmtKES(totals.debt)} outstanding`}
        actions={
          <button onClick={exportCSV} className="bg-primary text-primary-foreground px-4 py-2 text-xs font-display font-extrabold tracking-tight flex items-center gap-2 hover:bg-primary/90">
            <Download className="size-4" /> EXPORT CSV
          </button>
        }
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Total Purchased" value={fmtKES(totals.purchased)} />
          <Stat label="Debt Payments Collected" value={fmtKES(totals.settled)} accent="text-primary" />
          <Stat label="Outstanding Balance" value={fmtKES(totals.debt)} accent="text-destructive" />
        </div>

        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search customer by name or phone…"
          className="w-full max-w-sm bg-secondary border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />

        <div className="border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3 text-right">Purchased</th>
                <th className="px-4 py-3 text-right">Payments</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-left">Last Purchase</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-xs text-muted-foreground">No customers found.</td></tr>}
              {rows.map(r => (
                <tr key={r.c.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-semibold">{r.c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{r.c.type}</td>
                  <td className="px-4 py-3 text-right font-mono">{r.orders}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmtKES(r.purchased)}</td>
                  <td className="px-4 py-3 text-right font-mono text-primary">{fmtKES(r.settled)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${Number(r.c.balance) > 0 ? "text-destructive" : ""}`}>{fmtKES(r.c.balance)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.last ? fmtDateTime(r.last) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setOpenId(r.c.id)} className="text-[10px] font-display font-extrabold tracking-widest px-3 py-1.5 border border-border hover:bg-muted">
                      HISTORY
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setOpenId(null)}>
          <div className="bg-card border border-border w-full max-w-3xl sticky top-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="font-display font-extrabold tracking-tight">{open.c.name}</h2>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                  {open.c.type} · {open.c.phone ?? "no phone"} · Outstanding {fmtKES(open.c.balance)}
                </p>
              </div>
              <button onClick={() => setOpenId(null)} className="p-2 hover:bg-muted"><X className="size-4" /></button>
            </div>
            <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
              <section>
                <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Purchase History ({open.sales.length})</h3>
                <table className="w-full text-sm border border-border">
                  <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Sale #</th><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Paid</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {open.sales.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-xs text-muted-foreground">No purchases.</td></tr>}
                    {open.sales.map(s => (
                      <tr key={s.id}>
                        <td className="px-3 py-2 font-mono text-xs">{fmtDateTime(s.created_at)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{s.sale_number}</td>
                        <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest">{s.payment_method}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtKES(s.total)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtKES(s.amount_paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section>
                <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Payment History ({open.pays.length})</h3>
                <table className="w-full text-sm border border-border">
                  <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-left">Reference</th><th className="px-3 py-2 text-right">Amount</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {open.pays.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-xs text-muted-foreground">No payments recorded.</td></tr>}
                    {open.pays.map(p => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 font-mono text-xs">{fmtDateTime(p.created_at)}</td>
                        <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest">{p.method}</td>
                        <td className="px-3 py-2 font-mono text-xs">{p.reference ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-primary">{fmtKES(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="border border-border bg-card p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-2xl font-display font-extrabold tracking-tight mt-2 ${accent}`}>{value}</div>
    </div>
  );
}
