import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back");
      router.navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Toaster position="top-right" richColors />
      <div className="flex items-center justify-center w-full">
        <div className="w-full max-w-sm">
          <div className="bg-primary text-primary-foreground font-display font-extrabold text-xl px-3 py-1 inline-block mb-6">
            BEI POA
          </div>
          <h1 className="text-2xl font-display font-extrabold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Welcome back.
          </p>

          <form onSubmit={submit} className="space-y-4">
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
              {busy ? "PLEASE WAIT…" : "SIGN IN"}
            </button>
          </form>

          <p className="mt-6 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Accounts are created by your admin.
          </p>
        </div>
      </div>
    </div>
  );
}
