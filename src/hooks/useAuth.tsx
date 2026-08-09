import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "business_owner" | "cashier" | "accountant";

type AuthValue = {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const rolesFor = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;

    const loadRoles = (userId: string) => {
      if (rolesFor.current === userId) return;
      rolesFor.current = userId;
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .then(({ data }) => {
          if (alive) setRoles((data ?? []).map((r: any) => r.role as AppRole));
        });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!alive) return;
      // Never drop the session on transient/no-op events — only an explicit
      // sign-out (or a real session) should change auth state.
      if (event === "SIGNED_OUT") {
        rolesFor.current = null;
        setSession(null);
        setRoles([]);
        setLoading(false);
        return;
      }
      if (s) {
        setSession(s);
        loadRoles(s.user.id);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!alive) return;
      setSession(s);
      if (s) loadRoles(s.user.id);
      setLoading(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = roles.includes("super_admin") || roles.includes("business_owner");
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, roles, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return { session: null, user: null, roles: [], isAdmin: false, loading: true, signOut: async () => {} };
  }
  return ctx;
}
