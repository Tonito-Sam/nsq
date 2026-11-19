const axios = require('axios');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

async function requireAdmin(userId) {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    const error = new Error('Administrator authorization is not configured');
    error.status = 503;
    throw error;
  }

  const response = await axios.get(`${SUPABASE_URL}/rest/v1/users`, {
    params: { select: 'privilege', id: `eq.${userId}`, limit: 1 },
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
  });

  if (!['admin', 'superadmin'].includes(response.data?.[0]?.privilege)) {
    const error = new Error('Administrator access required');
    error.status = 403;
    throw error;
  }
}

module.exports = requireAdmin;
