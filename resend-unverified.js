// resend-unverified.js
import { createClient } from '@supabase/supabase-js';

// Supabase project details
const SUPABASE_URL = 'https://pfemdshixllwqqajsxxp.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZW1kc2hpeGxsd3FxYWpzeHhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODMxNTYwNywiZXhwIjoyMDYzODkxNjA3fQ.nwvuVQd9tCsmTlkmVpAGjfNbPCcWqrcDN453iBCre2A';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function resendVerifications() {
  console.log('Fetching unverified users...');

  // Fetch all users (admin privilege required)
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('❌ Error fetching users:', error.message);
    process.exit(1);
  }

  // Filter users who have not confirmed their email
  let unverifiedUsers = data.users.filter(user => !user.email_confirmed_at);

  // Add vashnitech@gmail.com to the list, even if already verified
  const testEmail = 'vashnitech@gmail.com';
  const alreadyInList = unverifiedUsers.some(user => user.email === testEmail);
  if (!alreadyInList) {
    // Try to find the user in all users
    const testUser = data.users.find(user => user.email === testEmail);
    if (testUser) {
      unverifiedUsers.push(testUser);
      console.log(`Added test email (${testEmail}) to the resend list.`);
    } else {
      // If not found, add as a dummy user object
      unverifiedUsers.push({ email: testEmail });
      console.log(`Added test email (${testEmail}) to the resend list (not found in users, sending anyway).`);
    }
  }

  if (unverifiedUsers.length === 0) {
    console.log('✅ No unverified users found.');
    return;
  }

  console.log(`Will send verification to ${unverifiedUsers.length} user(s):`);
  unverifiedUsers.forEach(u => console.log(' -', u.email));

  for (const user of unverifiedUsers) {
    const { email } = user;
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: 'https://nexsq.com', // Redirect to your app homepage
        },
      });
      if (resendError) {
        console.error(`❌ Failed for ${email}:`, resendError.message);
      } else {
        console.log(`✅ Verification re-sent to ${email}`);
      }
    } catch (err) {
      console.error(`❌ Exception for ${email}:`, err.message || err);
    }
  }

  console.log('\n🎉 Done!');
}

resendVerifications();
