const crypto = require('crypto');

// Generate ephemeral TURN credentials compatible with coturn's long-term credential mechanism
// username format: <expiryTimestamp>:<randomId>
// password: base64 HMAC-SHA1 of username using the static auth secret
function generateTurnCredentials({ secret, ttl = 3600, prefix = 'user' } = {}) {
  if (!secret) throw new Error('secret required to generate TURN credentials');
  const expiry = Math.floor(Date.now() / 1000) + Number(ttl);
  const rand = crypto.randomBytes(6).toString('hex');
  const username = `${expiry}:${prefix}-${rand}`;
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(username);
  const password = hmac.digest('base64');
  return { username, password, ttl: Number(ttl) };
}

module.exports = { generateTurnCredentials };
