import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.navigate({ to: "/login" });
  }, [loading, session, router]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-xs font-mono text-muted-foreground tracking-widest">LOADING…</div>;
  }
  if (!session) return null;

  return <AppShell><Outlet /></AppShell>;
}
