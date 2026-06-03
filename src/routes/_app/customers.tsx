import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Plus, X, Wallet, Printer, Check } from "lucide-react";
import { toast } from "sonner";
import { printPaymentReceipt, type PaymentReceiptData } from "@/lib/receipt";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Customers · Bei Poa" }] }),
});

type Customer = { id: string; name: string; phone: string | null; email: string | null;
  type: "retail" | "wholesale"; balance: number; credit_limit: number; loyalty_points: number; };

function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [paying, setPaying] = useState<Customer | null>(null);
  const [payAmt, setPayAmt] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [splitMode, setSplitMode] = useState(false);
  const [cashAmt, setCashAmt] = useState("");
  const [mpesaAmt, setMpesaAmt] = useState("");
  const [mpesaRef, setMpesaRef] = useState("");
  const [confirm, setConfirm] = useState<PaymentReceiptData | null>(null);

  const load = () => supabase.from("customers").select("*").order("name").then(({ data }) => setItems((data as any) ?? []));
  useEffect(() => { load(); }, []);

  const resetPay = () => {
    setPaying(null); setPayAmt(""); setPayMethod("cash"); setPayRef(""); setPayNotes("");
    setSplitMode(false); setCashAmt(""); setMpesaAmt(""); setMpesaRef("");
  };

  const pay = async () => {
    if (!paying) return;
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    let cashPart = 0, mpesaPart = 0, refUsed = "";
    const inserts: any[] = [];

    if (splitMode) {
      cashPart = Number(cashAmt) || 0;
      mpesaPart = Number(mpesaAmt) || 0;
      refUsed = mpesaRef;
      if (cashPart <= 0 && mpesaPart <= 0) { toast.error("Enter at least one amount"); return; }
      if (cashPart > 0) inserts.push({ customer_id: paying.id, amount: cashPart, method: "cash", reference: null, notes: payNotes || null, created_by: uid });
      if (mpesaPart > 0) inserts.push({ customer_id: paying.id, amount: mpesaPart, method: "mpesa", reference: mpesaRef || null, notes: payNotes || null, created_by: uid });
    } else {
      const amt = Number(payAmt);
      if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
      if (payMethod === "mpesa") { mpesaPart = amt; refUsed = payRef; }
      else if (payMethod === "cash") cashPart = amt;
      else { cashPart = amt; }
      inserts.push({ customer_id: paying.id, amount: amt, method: payMethod, reference: payRef || null, notes: payNotes || null, created_by: uid });
    }

    const totalAmt = cashPart + mpesaPart;
    const { data: u } = await supabase.auth.getUser();
    let cashierName = u.user?.email ?? "";
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", uid as string).maybeSingle();
    if (prof?.full_name) cashierName = prof.full_name;

    const { error: payErr } = await supabase.from("customer_payments").insert(inserts);
    if (payErr) { toast.error(payErr.message); return; }
    const prevBal = Number(paying.balance);
    const newBal = Math.max(0, prevBal - totalAmt);
    const { error } = await supabase.from("customers").update({ balance: newBal }).eq("id", paying.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Payment of ${fmtKES(totalAmt)} recorded`);

    setConfirm({
      customer: paying.name,
      createdAt: new Date().toISOString(),
      cashier: cashierName,
      cashAmount: cashPart,
      mpesaAmount: mpesaPart,
      mpesaReference: refUsed || undefined,
      notes: payNotes || undefined,
      previousBalance: prevBal,
      newBalance: newBal,
    });
    resetPay(); load();
  };



  const save = async () => {
    if (!editing?.name) { toast.error("Name required"); return; }
    const payload: any = {
      name: editing.name, phone: editing.phone || null, email: editing.email || null,
      type: editing.type ?? "retail",
      balance: Number(editing.balance ?? 0), credit_limit: Number(editing.credit_limit ?? 0),
    };
    const { error } = editing.id
      ? await supabase.from("customers").update(payload).eq("id", editing.id)
      : await supabase.from("customers").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setEditing(null); load();
  };

  return (
    <div className="animate-in">
      <PageHeader title="Customers" subtitle={`${items.length} customers`}
        actions={
          <button onClick={() => setEditing({ type: "retail" })} className="bg-primary text-primary-foreground px-4 py-2 text-xs font-display font-extrabold tracking-tight flex items-center gap-2 hover:bg-primary/90">
            <Plus className="size-4" /> ADD CUSTOMER
          </button>
        } />
      <div className="p-8">
        <div className="border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Credit Limit</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-xs text-muted-foreground">No customers yet.</td></tr>}
              {items.map(c => (
                <tr key={c.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-semibold cursor-pointer" onClick={() => setEditing(c)}>{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs cursor-pointer" onClick={() => setEditing(c)}>{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => setEditing(c)}><span className={`text-[10px] font-bold tracking-widest uppercase ${c.type === "wholesale" ? "text-primary" : "text-muted-foreground"}`}>{c.type}</span></td>
                  <td className={`px-4 py-3 text-right font-mono cursor-pointer ${Number(c.balance) > 0 ? "text-destructive font-bold" : ""}`} onClick={() => setEditing(c)}>{fmtKES(c.balance)}</td>
                  <td className="px-4 py-3 text-right font-mono cursor-pointer" onClick={() => setEditing(c)}>{fmtKES(c.credit_limit)}</td>
                  <td className="px-4 py-3 text-right font-mono cursor-pointer" onClick={() => setEditing(c)}>{c.loyalty_points}</td>
                  <td className="px-4 py-3 text-right">
                    {Number(c.balance) > 0 ? (
                      <button onClick={(e) => { e.stopPropagation(); setPaying(c); setPayAmt(""); }} className="bg-primary text-primary-foreground px-3 py-1.5 text-[10px] font-display font-extrabold tracking-widest inline-flex items-center gap-1.5 hover:bg-primary/90">
                        <Wallet className="size-3" /> PAY
                      </button>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {paying && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={resetPay}>
          <div className="bg-card border border-border w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-display font-extrabold">RECORD PAYMENT</h2>
              <button onClick={resetPay}><X className="size-5" /></button>
            </div>
            <div className="mb-4 p-3 bg-muted">
              <div className="text-xs text-muted-foreground">{paying.name}</div>
              <div className="text-sm">Outstanding: <span className="font-mono font-bold text-destructive">{fmtKES(paying.balance)}</span></div>
            </div>

            <div className="flex border border-border mb-4">
              <button onClick={() => setSplitMode(false)} className={`flex-1 px-3 py-2 text-[10px] font-display font-extrabold tracking-widest ${!splitMode ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>SINGLE METHOD</button>
              <button onClick={() => setSplitMode(true)} className={`flex-1 px-3 py-2 text-[10px] font-display font-extrabold tracking-widest ${splitMode ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>SPLIT (CASH + M-PESA)</button>
            </div>

            {!splitMode ? (
              <div className="space-y-3">
                <Inp label="Amount Paid (KES)" type="number" v={payAmt} on={setPayAmt} />
                <button type="button" onClick={() => setPayAmt(String(paying.balance))} className="text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 bg-secondary hover:bg-muted">Pay Full</button>
                <label className="block">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Method</div>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full bg-secondary px-3 py-2 text-sm outline-none">
                    <option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank</option><option value="other">Other</option>
                  </select>
                </label>
                <Inp label="Reference (M-Pesa code, txn id)" v={payRef} on={setPayRef} />
                <Inp label="Notes" v={payNotes} on={setPayNotes} />
              </div>
            ) : (
              <div className="space-y-3">
                <Inp label="Cash Amount (KES)" type="number" v={cashAmt} on={setCashAmt} />
                <Inp label="M-Pesa Amount (KES)" type="number" v={mpesaAmt} on={setMpesaAmt} />
                <Inp label="M-Pesa Reference" v={mpesaRef} on={setMpesaRef} />
                <div className="p-3 bg-muted flex justify-between text-sm">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Total</span>
                  <span className="font-mono font-bold text-primary">{fmtKES((Number(cashAmt) || 0) + (Number(mpesaAmt) || 0))}</span>
                </div>
                <button type="button" onClick={() => { setCashAmt(""); setMpesaAmt(String(paying.balance)); }} className="text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 bg-secondary hover:bg-muted mr-2">All M-Pesa</button>
                <button type="button" onClick={() => { setMpesaAmt(""); setCashAmt(String(paying.balance)); }} className="text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 bg-secondary hover:bg-muted">All Cash</button>
                <Inp label="Notes" v={payNotes} on={setPayNotes} />
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={resetPay} className="px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-muted">Cancel</button>
              <button onClick={pay} className="bg-primary text-primary-foreground px-6 py-2 text-xs font-display font-extrabold tracking-tight">RECORD PAYMENT</button>
            </div>
          </div>
        </div>
      )}



      {confirm && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={() => setConfirm(null)}>
          <div className="bg-card border border-border w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-display font-extrabold flex items-center gap-2"><Check className="size-5 text-primary" /> PAYMENT RECORDED</h2>
              <button onClick={() => setConfirm(null)}><X className="size-5" /></button>
            </div>
            <div className="space-y-2 text-sm">
              <Row k="Customer" v={confirm.customer} />
              <Row k="Date" v={new Date(confirm.createdAt).toLocaleString()} />
              {confirm.cashier && <Row k="Cashier" v={confirm.cashier} />}
              <div className="border-t border-border my-2" />
              {confirm.cashAmount > 0 && <Row k="Cash" v={fmtKES(confirm.cashAmount)} />}
              {confirm.mpesaAmount > 0 && <Row k="M-Pesa" v={fmtKES(confirm.mpesaAmount)} />}
              {confirm.mpesaReference && <Row k="M-Pesa Ref" v={confirm.mpesaReference} mono />}
              <Row k="Method" v={confirm.cashAmount > 0 && confirm.mpesaAmount > 0 ? "Split" : confirm.mpesaAmount > 0 ? "M-Pesa" : "Cash"} />
              <div className="border-t border-border my-2" />
              <div className="flex justify-between font-bold text-base">
                <span>TOTAL PAID</span>
                <span className="font-mono text-primary">{fmtKES(confirm.cashAmount + confirm.mpesaAmount)}</span>
              </div>
              <div className="border-t border-border my-2" />
              <Row k="Previous Balance" v={fmtKES(confirm.previousBalance)} />
              <Row k="New Balance" v={fmtKES(confirm.newBalance)} accent={confirm.newBalance > 0 ? "text-destructive" : "text-primary"} />
              {confirm.notes && <Row k="Notes" v={confirm.notes} />}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-muted">Done</button>
              <button onClick={() => printPaymentReceipt(confirm)} className="bg-primary text-primary-foreground px-6 py-2 text-xs font-display font-extrabold tracking-tight flex items-center gap-2">
                <Printer className="size-4" /> PRINT RECEIPT
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card border border-border w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-display font-extrabold">{editing.id ? "EDIT CUSTOMER" : "NEW CUSTOMER"}</h2>
              <button onClick={() => setEditing(null)}><X className="size-5" /></button>
            </div>
            <div className="space-y-3">
              <Inp label="Name" v={editing.name ?? ""} on={v => setEditing({ ...editing, name: v })} />
              <Inp label="Phone" v={editing.phone ?? ""} on={v => setEditing({ ...editing, phone: v })} />
              <Inp label="Email" v={editing.email ?? ""} on={v => setEditing({ ...editing, email: v })} />
              <label className="block">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Type</div>
                <select value={editing.type ?? "retail"} onChange={e => setEditing({ ...editing, type: e.target.value as any })} className="w-full bg-secondary px-3 py-2 text-sm outline-none">
                  <option value="retail">Retail</option><option value="wholesale">Wholesale</option>
                </select>
              </label>
              <Inp label="Credit Limit (KES)" type="number" v={String(editing.credit_limit ?? 0)} on={v => setEditing({ ...editing, credit_limit: Number(v) })} />
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

function Inp({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <input type={type} value={v} onChange={e => on(e.target.value)} className="w-full bg-secondary border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
    </label>
  );
}

function Row({ k, v, mono, accent = "" }: { k: string; v: string; mono?: boolean; accent?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground text-xs">{k}</span>
      <span className={`${mono ? "font-mono text-xs" : ""} ${accent}`}>{v}</span>
    </div>
  );
}
