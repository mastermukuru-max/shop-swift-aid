import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { PageHeader } from "@/components/AppShell";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Staff · Bei Poa" }] }),
});

const ROLES: AppRole[] = ["super_admin", "business_owner", "cashier", "accountant"];

function UsersPage() {
  const { isAdmin, user: me } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

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
      <div className="p-8">
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
        <p className="text-xs text-muted-foreground mt-4">
          New signups become a <span className="font-bold">Cashier</span> by default. The first signup is auto-assigned <span className="font-bold">Super Admin</span>.
        </p>
      </div>
    </div>
  );
}
