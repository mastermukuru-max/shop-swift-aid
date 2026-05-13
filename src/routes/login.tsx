import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.navigate({ to: "/dashboard" });
    });
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        router.navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: fullName } },
        });
        if (error) throw error;
        toast.success("Account created — signing you in");
        router.navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <Toaster position="top-right" richColors />
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-surface text-surface-foreground p-12">
        <div>
          <div className="bg-primary text-primary-foreground font-display font-extrabold text-2xl px-4 py-1.5 inline-block">
            BEI POA
          </div>
          <div className="text-xs font-mono text-white/40 mt-3 tracking-widest">RETAIL · WHOLESALE · MPESA</div>
        </div>
        <div>
          <h2 className="text-4xl font-display font-extrabold tracking-tight leading-tight">
            Run your shop.<br />
            <span className="text-primary">Track every shilling.</span>
          </h2>
          <p className="text-white/60 mt-4 max-w-md text-sm leading-relaxed">
            Point of sale, inventory, wholesale credit and Mpesa reconciliation — built for Kenyan retailers.
          </p>
        </div>
        <div className="text-[10px] font-mono text-white/30 tracking-widest">
          BEI POA · ALL PRICES IN KES
        </div>
      </div>

      {/* Auth form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden bg-primary text-primary-foreground font-display font-extrabold text-xl px-3 py-1 inline-block mb-6">
            BEI POA
          </div>
          <h1 className="text-2xl font-display font-extrabold tracking-tight">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {mode === "signin" ? "Welcome back, cashier." : "First account becomes the Super Admin."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Full name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} required
                  className="mt-1 w-full bg-secondary border border-border px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none" />
              </div>
            )}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="mt-1 w-full bg-secondary border border-border px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                className="mt-1 w-full bg-secondary border border-border px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <button type="submit" disabled={busy}
              className="w-full bg-primary text-primary-foreground font-display font-extrabold py-3 text-sm tracking-tight hover:bg-primary/90 disabled:opacity-60">
              {busy ? "PLEASE WAIT…" : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
            </button>
          </form>

          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-6 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">
            {mode === "signin" ? "→ Need an account? Sign up" : "→ Have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
