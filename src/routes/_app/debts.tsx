import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES } from "@/lib/format";
import { printCustomerStatement } from "@/lib/statement";
import { PageHeader } from "@/components/AppShell";
import { Download, Wallet, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/debts")({
  component: DebtsReportPage,
  head: () => ({ meta: [{ title: "Debts & Payments · Bei Poa" }] }),
});

type Customer = { id: string; name: string; phone: string | null; balance: number; credit_limit: number; type: string };
type Sale = { id: string; sale_number: string; customer_id: string | null; total: number; amount_paid: number; payment_method: string; created_at: string };
type Payment = {
  id: string; customer_id: string; amount: number; method: string;
  reference: string | null; notes: string | null; created_at: string; created_by: string | null;
};

function DebtsReportPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tab, setTab] = useState<"debts" | "payments">("debts");

  const load = async () => {
    const { data: cs } = await supabase.from("customers").select("*").order("balance", { ascending: false });
    setCustomers((cs as any) ?? []);
    let q = supabase.from("customer_payments").select("*").order("created_at", { ascending: false });
    if (from) q = q.gte("created_at", new Date(from).toISOString());
    if (to) q = q.lte("created_at", new Date(to + "T23:59:59").toISOString());
    const { data: ps } = await q;
    setPayments((ps as any) ?? []);
  };
  useEffect(() => { load(); }, [from, to]);

  const cMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c])), [customers]);
  const debtors = customers.filter(c => Number(c.balance) > 0);
  const totalDebt = debtors.reduce((s, c) => s + Number(c.balance), 0);
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);

  const exportCSV = () => {
    const rows: string[][] = [];
    if (tab === "debts") {
      rows.push(["Customer", "Phone", "Type", "Outstanding (KES)", "Credit Limit (KES)"]);
      debtors.forEach(c => rows.push([c.name, c.phone ?? "", c.type, String(c.balance), String(c.credit_limit)]));
      rows.push([]); rows.push(["TOTAL OUTSTANDING", "", "", String(totalDebt), ""]);
    } else {
      rows.push(["Date", "Customer", "Phone", "Amount (KES)", "Method", "Reference", "Notes"]);
      payments.forEach(p => {
        const c = cMap[p.customer_id];
        rows.push([
          new Date(p.created_at).toLocaleString(),
          c?.name ?? "—", c?.phone ?? "",
          String(p.amount), p.method, p.reference ?? "", p.notes ?? "",
        ]);
      });
      rows.push([]); rows.push(["TOTAL COLLECTED", "", "", String(totalCollected), "", "", ""]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab === "debts" ? "outstanding-debts" : "payments"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-in">
      <PageHeader
        title="Debts & Payments"
        subtitle={`${debtors.length} debtors · ${fmtKES(totalDebt)} outstanding`}
        actions={
          <button onClick={exportCSV} className="bg-primary text-primary-foreground px-4 py-2 text-xs font-display font-extrabold tracking-tight flex items-center gap-2 hover:bg-primary/90">
            <Download className="size-4" /> EXPORT CSV
          </button>
        }
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Outstanding Debt" value={fmtKES(totalDebt)} accent="text-destructive" />
          <Stat label="Debtors" value={String(debtors.length)} />
          <Stat label={`Collected${from || to ? " (filtered)" : " (all-time)"}`} value={fmtKES(totalCollected)} accent="text-primary" />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">From</div>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-secondary border border-border px-3 py-2 text-sm outline-none" />
          </label>
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">To</div>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-secondary border border-border px-3 py-2 text-sm outline-none" />
          </label>
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); }} className="text-[10px] font-mono uppercase tracking-widest px-3 py-2 hover:bg-muted">Clear</button>
          )}
          <div className="ml-auto flex border border-border">
            <button onClick={() => setTab("debts")} className={`px-4 py-2 text-[10px] font-display font-extrabold tracking-widest ${tab === "debts" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>OUTSTANDING DEBTS</button>
            <button onClick={() => setTab("payments")} className={`px-4 py-2 text-[10px] font-display font-extrabold tracking-widest ${tab === "payments" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>PAYMENT HISTORY</button>
          </div>
        </div>

        <div className="border border-border bg-card overflow-hidden">
          {tab === "debts" ? (
            <table className="w-full text-sm">
              <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-right">Credit Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {debtors.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-xs text-muted-foreground">No outstanding debts.</td></tr>}
                {debtors.map(c => (
                  <tr key={c.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-semibold">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{c.type}</td>
                    <td className="px-4 py-3 text-right font-mono text-destructive font-bold">{fmtKES(c.balance)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtKES(c.credit_limit)}</td>
                  </tr>
                ))}
                {debtors.length > 0 && (
                  <tr className="bg-muted/30 font-bold">
                    <td colSpan={3} className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">Total</td>
                    <td className="px-4 py-3 text-right font-mono text-destructive">{fmtKES(totalDebt)}</td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-xs text-muted-foreground">No payments in this period.</td></tr>}
                {payments.map(p => {
                  const c = cMap[p.customer_id];
                  return (
                    <tr key={p.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-mono text-xs">{new Date(p.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold">{c?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest">{p.method}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.notes ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-primary">{fmtKES(p.amount)}</td>
                    </tr>
                  );
                })}
                {payments.length > 0 && (
                  <tr className="bg-muted/30 font-bold">
                    <td colSpan={5} className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest">Total Collected</td>
                    <td className="px-4 py-3 text-right font-mono text-primary">{fmtKES(totalCollected)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="border border-border bg-card p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2"><Wallet className="size-3" /> {label}</div>
      <div className={`text-2xl font-display font-extrabold tracking-tight ${accent}`}>{value}</div>
    </div>
  );
}
