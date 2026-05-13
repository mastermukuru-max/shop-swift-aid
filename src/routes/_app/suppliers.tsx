import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtKES } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/suppliers")({
  component: SuppliersPage,
  head: () => ({ meta: [{ title: "Suppliers · Bei Poa" }] }),
});

type Supplier = { id: string; name: string; contact_person: string | null; phone: string | null; email: string | null; address: string | null; balance: number };

function SuppliersPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);

  const load = () => supabase.from("suppliers").select("*").order("name").then(({ data }) => setItems((data as any) ?? []));
  useEffect(load, []);

  const save = async () => {
    if (!editing?.name) { toast.error("Name required"); return; }
    const payload: any = {
      name: editing.name, contact_person: editing.contact_person || null,
      phone: editing.phone || null, email: editing.email || null, address: editing.address || null,
      balance: Number(editing.balance ?? 0),
    };
    const { error } = editing.id
      ? await supabase.from("suppliers").update(payload).eq("id", editing.id)
      : await supabase.from("suppliers").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setEditing(null); load();
  };

  return (
    <div className="animate-in">
      <PageHeader title="Suppliers" subtitle={`${items.length} suppliers`}
        actions={isAdmin && (
          <button onClick={() => setEditing({})} className="bg-primary text-primary-foreground px-4 py-2 text-xs font-display font-extrabold tracking-tight flex items-center gap-2 hover:bg-primary/90">
            <Plus className="size-4" /> ADD SUPPLIER
          </button>
        )} />
      <div className="p-8">
        <div className="border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-xs text-muted-foreground">No suppliers yet.</td></tr>}
              {items.map(s => (
                <tr key={s.id} className={`${isAdmin ? "hover:bg-muted/50 cursor-pointer" : ""}`} onClick={() => isAdmin && setEditing(s)}>
                  <td className="px-4 py-3 font-semibold">{s.name}</td>
                  <td className="px-4 py-3">{s.contact_person ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.phone ?? "—"}</td>
                  <td className={`px-4 py-3 text-right font-mono ${Number(s.balance) > 0 ? "text-destructive font-bold" : ""}`}>{fmtKES(s.balance)}</td>
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
              <h2 className="text-lg font-display font-extrabold">{editing.id ? "EDIT SUPPLIER" : "NEW SUPPLIER"}</h2>
              <button onClick={() => setEditing(null)}><X className="size-5" /></button>
            </div>
            <div className="space-y-3">
              <Inp label="Name" v={editing.name ?? ""} on={v => setEditing({ ...editing, name: v })} />
              <Inp label="Contact Person" v={editing.contact_person ?? ""} on={v => setEditing({ ...editing, contact_person: v })} />
              <Inp label="Phone" v={editing.phone ?? ""} on={v => setEditing({ ...editing, phone: v })} />
              <Inp label="Email" v={editing.email ?? ""} on={v => setEditing({ ...editing, email: v })} />
              <Inp label="Address" v={editing.address ?? ""} on={v => setEditing({ ...editing, address: v })} />
              <Inp label="Balance Owed (KES)" type="number" v={String(editing.balance ?? 0)} on={v => setEditing({ ...editing, balance: Number(v) })} />
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
