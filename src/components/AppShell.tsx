import { Link, useRouter, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, ShoppingCart, Package, Users, Truck, Receipt, UserCog, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Toaster } from "sonner";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pos", label: "POS Terminal", icon: ShoppingCart },
  { to: "/products", label: "Inventory", icon: Package },
  { to: "/sales", label: "Sales", icon: Receipt },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/users", label: "Staff", icon: UserCog, adminOnly: true },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, roles, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const loc = useLocation();

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const roleLabel = roles[0]?.replace("_", " ").toUpperCase() ?? "STAFF";

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Toaster position="top-right" richColors />
      {/* Sidebar */}
      <aside className="w-60 bg-surface text-surface-foreground flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="bg-primary text-primary-foreground font-display font-extrabold text-lg px-3 py-1 inline-block">
            BEI POA
          </div>
          <div className="text-[10px] font-mono text-white/40 mt-2 tracking-widest">RETAIL · WHOLESALE</div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {NAV.filter(n => !n.adminOnly || isAdmin).map(({ to, label, icon: Icon }) => {
            const active = loc.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-sm transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="size-9 rounded-full bg-white/10 grid place-items-center font-bold text-xs">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{user?.email}</div>
              <div className="text-[10px] font-mono text-white/40 tracking-wider">{roleLabel}</div>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="p-2 rounded-sm hover:bg-white/10 text-white/60 hover:text-white"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="border-b border-border bg-card px-8 py-5 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-display font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs font-mono text-muted-foreground mt-1 uppercase tracking-wider">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
