const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const axios = require('axios');

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const requireAdmin = require('./requireAdmin.cjs');
const originalGet = axios.get;

after(() => {
  axios.get = originalGet;
});

test('allows admin and superadmin from the users privilege field', async () => {
  for (const privilege of ['admin', 'superadmin']) {
    axios.get = async (url, options) => {
      assert.equal(url, 'https://example.supabase.co/rest/v1/users');
      assert.deepEqual(options.params, { select: 'privilege', id: 'eq.user-id', limit: 1 });
      return { data: [{ privilege }] };
    };

    await requireAdmin('user-id');
  }
});

test('rejects users without an admin privilege', async () => {
  axios.get = async () => ({ data: [{ privilege: 'user' }] });
  await assert.rejects(requireAdmin('user-id'), {
    status: 403,
    message: 'Administrator access required',
  });
});
