import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admins only");
}

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; fullName: string; role: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("User creation failed");

    await supabaseAdmin.from("profiles").update({ full_name: data.fullName }).eq("id", authData.user.id);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", authData.user.id);
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: authData.user.id,
      role: data.role as any,
    });
    if (roleError) throw new Error(roleError.message);

    return { userId: authData.user.id };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) => {
    if (!input.userId) throw new Error("Missing user");
    if (!input.password || input.password.length < 6) throw new Error("Password must be at least 6 characters");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
