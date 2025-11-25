/*
 Small admin script to update a store product using the SUPABASE_SERVICE_ROLE_KEY.

 Usage (example):
   node supabase-admin-update.js --id=<product_id> --data='{"title":"New title","price":9.99}'

 Requirements:
 - Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.
 - This script is for local/admin debugging only. Do NOT commit or expose service role keys.

 It will perform an update and then fetch the authoritative row to print it.
*/

const { createClient } = require('@supabase/supabase-js');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('id', { type: 'string', demandOption: true, describe: 'Product id to update' })
  .option('data', { type: 'string', demandOption: true, describe: 'JSON string of fields to update' })
  .help()
  .argv;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const id = argv.id;
    let payload;
    try {
      payload = JSON.parse(argv.data);
    } catch (err) {
      console.error('Failed to parse --data JSON:', err.message);
      process.exit(1);
    }

    console.log('[admin-update] Updating product', id, 'with', payload);

    const { data: updateData, error: updateError, status } = await supabase
      .from('store_products')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error('[admin-update] update error (status=' + status + '):', updateError.message);
      // Try fallback: update without select then get the row
      const { error: fallbackErr } = await supabase
        .from('store_products')
        .update(payload)
        .eq('id', id);
      if (fallbackErr) {
        console.error('[admin-update] fallback update failed:', fallbackErr.message);
        process.exit(1);
      }
    }

    // Fetch authoritative row
    const { data: row, error: fetchErr } = await supabase
      .from('store_products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[admin-update] fetch error:', fetchErr.message);
      process.exit(1);
    }

    console.log('[admin-update] authoritative row:', row);
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
