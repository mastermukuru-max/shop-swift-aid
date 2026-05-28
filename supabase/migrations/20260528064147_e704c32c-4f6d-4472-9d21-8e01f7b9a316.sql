
-- Lock down SELECT on profiles: own row or admins
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
CREATE POLICY "Users view own profile or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- Lock down SELECT on user_roles: own role or admins
DROP POLICY IF EXISTS "Authenticated view roles" ON public.user_roles;
CREATE POLICY "Users view own role or admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Tighten sale_items INSERT: only allow inserting against your own sales (or admins)
DROP POLICY IF EXISTS "Auth create sale items" ON public.sale_items;
CREATE POLICY "Insert sale items for own sales" ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.cashier_id = auth.uid())
  );

-- Restrict sales SELECT: cashier sees own sales, admins see all
DROP POLICY IF EXISTS "Auth view sales" ON public.sales;
CREATE POLICY "View own sales or admin" ON public.sales
  FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() OR public.is_admin(auth.uid()));

-- Revoke EXECUTE on SECURITY DEFINER trigger functions from anon/authenticated
-- (they only need to run inside their triggers as the table owner)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_stock_on_sale() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_product_serial() FROM PUBLIC, anon, authenticated;

-- Revoke anon EXECUTE on role-check helpers (still needed by authenticated for RLS evaluation)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid) FROM PUBLIC, anon;
