import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createStaffUser = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string; fullName: string; role: string }) => input)
  .handler(async ({ data }) => {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("User creation failed");

    // Ensure profile name matches
    await supabaseAdmin.from("profiles").update({ full_name: data.fullName }).eq("id", authData.user.id);

    // Remove any auto-assigned role from trigger and set the requested one
    await supabaseAdmin.from("user_roles").delete().eq("user_id", authData.user.id);
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: authData.user.id,
      role: data.role,
    });
    if (roleError) throw new Error(roleError.message);

    return { userId: authData.user.id };
  });
