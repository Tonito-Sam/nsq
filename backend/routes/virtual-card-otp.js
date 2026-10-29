const crypto = require('crypto');
const express = require('express');
const axios = require('axios');

const router = express.Router();
const activeOtps = new Map();
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_DELAY_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function config() {
  return {
    supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE,
    emailServiceUrl: (process.env.EMAIL_SERVICE_URL || 'http://localhost:4000').replace(/\/+$/, ''),
  };
}

function otpHash(userId, code, secret) {
  return crypto.createHmac('sha256', secret).update(`${userId}:${code}`).digest();
}

async function getAuthenticatedUser(req) {
  const { supabaseUrl, serviceRole } = config();
  const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!supabaseUrl || !serviceRole || !accessToken) {
    return { error: { status: 401, message: 'Please sign in again to request an OTP.' } };
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRole, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return { error: { status: 401, message: 'Your session is invalid or expired.' } };

  const user = await response.json();
  if (!user.id || !user.email) {
    return { error: { status: 400, message: 'Your account does not have an email address.' } };
  }
  return { user, serviceRole };
}

router.post('/start', async (req, res) => {
  try {
    const auth = await getAuthenticatedUser(req);
    if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

    const previous = activeOtps.get(auth.user.id);
    const now = Date.now();
    if (previous && now - previous.sentAt < RESEND_DELAY_MS) {
      return res.status(429).json({ error: 'Please wait before requesting another OTP.' });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const { emailServiceUrl } = config();
    await axios.post(`${emailServiceUrl}/send-otp`, { email: auth.user.email, otp: code }, { timeout: 10000 });

    activeOtps.set(auth.user.id, {
      hash: otpHash(auth.user.id, code, auth.serviceRole),
      expiresAt: now + OTP_TTL_MS,
      sentAt: now,
      attempts: 0,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('virtual-card-otp.start error:', error.response?.data || error.message);
    return res.status(502).json({ error: 'Could not send the OTP email. Check that the email service is running and configured.' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const auth = await getAuthenticatedUser(req);
    if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter the six-digit OTP.' });

    const record = activeOtps.get(auth.user.id);
    if (!record || record.expiresAt <= Date.now()) {
      activeOtps.delete(auth.user.id);
      return res.status(400).json({ error: 'This OTP has expired. Request a new one.' });
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      activeOtps.delete(auth.user.id);
      return res.status(429).json({ error: 'Too many attempts. Request a new OTP.' });
    }

    record.attempts += 1;
    const suppliedHash = otpHash(auth.user.id, code, auth.serviceRole);
    if (!crypto.timingSafeEqual(record.hash, suppliedHash)) {
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    activeOtps.delete(auth.user.id);
    return res.json({ success: true });
  } catch (error) {
    console.error('virtual-card-otp.verify error:', error.message);
    return res.status(500).json({ error: 'Could not verify the OTP right now.' });
  }
});

module.exports = router;