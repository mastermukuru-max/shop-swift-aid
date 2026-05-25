import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { PageHeader } from "@/components/AppShell";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { createStaffUser } from "@/lib/users.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Staff · Bei Poa" }] }),
});

const ROLES: AppRole[] = ["super_admin", "business_owner", "cashier", "accountant"];

function UsersPage() {
  const { isAdmin, user: me } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "cashier" as AppRole });
  const [busy, setBusy] = useState(false);
  const createUser = useServerFn(createStaffUser);

  const load = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const byUser: Record<string, AppRole[]> = {};
    (roles ?? []).forEach((r: any) => { (byUser[r.user_id] ??= []).push(r.role); });
    setRows((profiles ?? []).map((p: any) => ({ ...p, roles: byUser[p.id] ?? [] })));
  };
  useEffect(() => { load(); }, []);

  const toggleRole = async (userId: string, role: AppRole, has: boolean) => {
    if (!isAdmin) return;
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Role updated"); load();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    try {
      await createUser({ data: { ...form, role: form.role } });
      toast.success("Staff account created");
      setForm({ fullName: "", email: "", password: "", role: "cashier" });
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create account");
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="animate-in">
        <PageHeader title="Staff" />
        <div className="p-8 text-sm text-muted-foreground">Only admins can manage staff.</div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <PageHeader title="Staff & Roles" subtitle={`${rows.length} users`} />
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowForm(s => !s)}
            className="bg-primary text-primary-foreground font-display font-extrabold text-xs uppercase tracking-widest px-4 py-2 hover:bg-primary/90"
          >
            {showForm ? "Cancel" : "+ New Staff"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="border border-border bg-card p-4 space-y-4 max-w-lg">
            <h3 className="text-sm font-bold uppercase tracking-widest">Create Staff Account</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Full Name</label>
                <input
                  type="text" required value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  className="mt-1 w-full bg-secondary border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Email</label>
                <input
                  type="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full bg-secondary border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Password</label>
                <input
                  type="text" required minLength={6} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="mt-1 w-full bg-secondary border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as AppRole }))}
                  className="mt-1 w-full bg-secondary border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit" disabled={busy}
              className="bg-primary text-primary-foreground font-display font-extrabold text-xs uppercase tracking-widest px-4 py-2 hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create Account"}
            </button>
          </form>
        )}

        <div className="border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Joined</th>
                {ROLES.map(r => <th key={r} className="px-2 py-3 text-center">{r.replace("_", " ")}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(u => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-semibold">{u.full_name || "—"}{u.id === me?.id && <span className="ml-2 text-[10px] text-primary font-mono">(you)</span>}</td>
                  <td className="px-4 py-3 text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{fmtDate(u.created_at)}</td>
                  {ROLES.map(r => {
                    const has = u.roles.includes(r);
                    return (
                      <td key={r} className="px-2 py-3 text-center">
                        <input type="checkbox" checked={has} onChange={() => toggleRole(u.id, r, has)} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Use the checkboxes to assign or remove roles. Click <span className="font-bold">+ New Staff</span> to create accounts — signup is disabled on the login page.
        </p>
      </div>
    </div>
  );
}
