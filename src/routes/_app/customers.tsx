import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Customers · Bei Poa" }] }),
});

type Customer = { id: string; name: string; phone: string | null; email: string | null;
  type: "retail" | "wholesale"; balance: number; credit_limit: number; loyalty_points: number; };

function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);

  const load = () => supabase.from("customers").select("*").order("name").then(({ data }) => setItems((data as any) ?? []));
  useEffect(load, []);

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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-xs text-muted-foreground">No customers yet.</td></tr>}
              {items.map(c => (
                <tr key={c.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setEditing(c)}>
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold tracking-widest uppercase ${c.type === "wholesale" ? "text-primary" : "text-muted-foreground"}`}>{c.type}</span></td>
                  <td className={`px-4 py-3 text-right font-mono ${Number(c.balance) > 0 ? "text-destructive font-bold" : ""}`}>{fmtKES(c.balance)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmtKES(c.credit_limit)}</td>
                  <td className="px-4 py-3 text-right font-mono">{c.loyalty_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
