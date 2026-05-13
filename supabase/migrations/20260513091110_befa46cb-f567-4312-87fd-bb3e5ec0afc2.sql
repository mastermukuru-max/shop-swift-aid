
DO $$
DECLARE
  admin_id uuid := gen_random_uuid();
  cashier_id uuid := gen_random_uuid();
  acct_id uuid := gen_random_uuid();
BEGIN
  -- Admin
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', 'admin@beipoa.test', crypt('Admin@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin User"}', now(), now(), '', '', '', '');
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), admin_id, admin_id::text, format('{"sub":"%s","email":"%s"}', admin_id, 'admin@beipoa.test')::jsonb, 'email', now(), now(), now());

  -- Cashier
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', cashier_id, 'authenticated', 'authenticated', 'cashier@beipoa.test', crypt('Cashier@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Cashier User"}', now(), now(), '', '', '', '');
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), cashier_id, cashier_id::text, format('{"sub":"%s","email":"%s"}', cashier_id, 'cashier@beipoa.test')::jsonb, 'email', now(), now(), now());

  -- Accountant
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', acct_id, 'authenticated', 'authenticated', 'accountant@beipoa.test', crypt('Accountant@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Accountant User"}', now(), now(), '', '', '', '');
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), acct_id, acct_id::text, format('{"sub":"%s","email":"%s"}', acct_id, 'accountant@beipoa.test')::jsonb, 'email', now(), now(), now());

  -- Override roles (handle_new_user trigger assigns super_admin to first user, cashier to others)
  DELETE FROM public.user_roles WHERE user_id IN (admin_id, cashier_id, acct_id);
  INSERT INTO public.user_roles (user_id, role) VALUES
    (admin_id, 'super_admin'),
    (cashier_id, 'cashier'),
    (acct_id, 'accountant');
END $$;
