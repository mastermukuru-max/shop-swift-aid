const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const updates = [
  {
    id: '5a8a22f3-0a22-4833-83d0-0a270e4c093e',
    email: 'admin@beipoa.com',
    password: 'Admin@123',
    full_name: 'Super Admin',
  },
  {
    id: '1cabfce9-8b4d-4521-807e-51f8a9f2e061',
    email: 'cashier@beipoa.com',
    password: 'Cashier@123',
    full_name: 'Cashier',
  },
  {
    id: 'e7b5e584-5ff2-452d-85b9-c401695bff54',
    email: 'accountant@beipoa.com',
    password: 'Accountant@123',
    full_name: 'Accountant',
  },
];

async function run() {
  for (const u of updates) {
    console.log(`Updating user ${u.id} → ${u.email}`);
    const { error: emailErr } = await supabase.auth.admin.updateUserById(u.id, {
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    if (emailErr) {
      console.error(`Auth update error for ${u.email}:`, emailErr.message);
    } else {
      console.log(`Auth updated for ${u.email}`);
    }

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ full_name: u.full_name, email: u.email })
      .eq('id', u.id);
    if (profileErr) {
      console.error(`Profile update error for ${u.email}:`, profileErr.message);
    } else {
      console.log(`Profile updated for ${u.email}`);
    }
  }
}

run().catch(console.error);
