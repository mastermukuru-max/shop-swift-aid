const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const adminId = '5a8a22f3-0a22-483b-83d0-0a270e4c093e';
  console.log(`Updating admin user ${adminId}`);
  const { error: authErr } = await supabase.auth.admin.updateUserById(adminId, {
    email: 'admin@beipoa.com',
    password: 'Admin@123',
    email_confirm: true,
    user_metadata: { full_name: 'Super Admin' },
  });
  if (authErr) {
    console.error('Auth update error:', authErr.message);
  } else {
    console.log('Auth updated successfully');
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ full_name: 'Super Admin', email: 'admin@beipoa.com' })
    .eq('id', adminId);
  if (profileErr) {
    console.error('Profile update error:', profileErr.message);
  } else {
    console.log('Profile updated successfully');
  }
}

run().catch(console.error);
