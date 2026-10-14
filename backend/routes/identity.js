const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const router = express.Router();
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const BUCKET = 'identity-documents';

function supabaseHeaders(extra = {}) {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function asyncRoute(handler) {
  return (req, res) => handler(req, res).catch(error => {
    const status = error.status || error.response?.status || 500;
    const message = error.status ? error.message : error.response?.data?.message || 'Identity submission failed';
    if (status >= 500) console.error('Identity API error:', error.response?.data || error.message);
    res.status(status).json({ error: message });
  });
}

async function authenticate(req) {
  const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!SUPABASE_URL || !SERVICE_ROLE || !accessToken) {
    const error = new Error('Sign in to continue');
    error.status = 401;
    throw error;
  }
  const response = await axios.get(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

function encryptionKey() {
  const configuredKey = process.env.IDENTITY_ENCRYPTION_KEY;
  if (configuredKey) {
    const key = Buffer.from(configuredKey, 'base64');
    if (key.length !== 32) throw new Error('IDENTITY_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    return key;
  }
  if (!SERVICE_ROLE) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to protect identity details');
  return Buffer.from(crypto.hkdfSync(
    'sha256',
    SERVICE_ROLE,
    'nexsq-identity-number-v1',
    'identity-number-encryption',
    32
  ));
}

function encryptIdentityNumber(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function maskIdentityNumber(value) {
  return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function normalizedIdentityNumber(value) {
  return String(value || '').normalize('NFKC').toUpperCase().replace(/[\s-]/g, '');
}

function validateIdentity(countryCode, documentType, identityNumber) {
  const value = normalizedIdentityNumber(identityNumber);
  if (countryCode === 'NG') {
    if (documentType === 'nigerian_nin' && !/^\d{11}$/.test(value)) return null;
    if (documentType === 'passport' && !/^[A-Z0-9]{6,12}$/.test(value)) return null;
    if (!['nigerian_nin', 'passport'].includes(documentType)) return null;
  } else if (countryCode === 'ZA') {
    if (documentType !== 'south_african_id' || !/^\d{13}$/.test(value)) return null;
  } else if (documentType !== 'national_id' || !/^[A-Z0-9]{4,32}$/.test(value)) {
    return null;
  }
  return value;
}

async function requireAdmin(userId) {
  const response = await axios.get(
    `${SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&role=eq.admin&limit=1`,
    { headers: supabaseHeaders() }
  );
  if (!response.data?.length) {
    const error = new Error('Administrator access required');
    error.status = 403;
    throw error;
  }
}

async function syncKycStatus(userId, countryCode, submissionId, kycStatus, riskStatus) {
  await axios.post(`${SUPABASE_URL}/rest/v1/wallet_compliance_profiles?on_conflict=user_id`, [{
    user_id: userId,
    identity_country: countryCode,
    latest_submission_id: submissionId,
    kyc_status: kycStatus,
    risk_status: riskStatus,
    kyc_verified_at: kycStatus === 'verified' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }], { headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }) });

  await axios.patch(
    `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
    { kyc_status: kycStatus, identity_country: countryCode },
    { headers: supabaseHeaders({ Prefer: 'return=minimal' }) }
  );
  await axios.patch(
    `${SUPABASE_URL}/rest/v1/user_stores?user_id=eq.${encodeURIComponent(userId)}`,
    { owner_kyc_status: kycStatus, owner_identity_country: countryCode },
    { headers: supabaseHeaders({ Prefer: 'return=minimal' }) }
  );
}

router.get('/status', asyncRoute(async (req, res) => {
  const user = await authenticate(req);
  const response = await axios.get(
    `${SUPABASE_URL}/rest/v1/identity_verification_submissions?select=country_code,document_type,status,review_note,submitted_at,reviewed_at,updated_at&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { headers: supabaseHeaders() }
  );
  return res.json(response.data?.[0] || { status: 'unverified' });
}));

router.post('/submit', asyncRoute(async (req, res) => {
  const user = await authenticate(req);
  const countryCode = String(req.body?.country_code || '').toUpperCase();
  const documentType = String(req.body?.document_type || '').toLowerCase();
  const identityNumber = validateIdentity(countryCode, documentType, req.body?.identity_number);
  const documentPath = String(req.body?.document_path || '');
  if (!/^[A-Z]{2}$/.test(countryCode) || !identityNumber) {
    return res.status(400).json({ error: 'Enter a valid country-specific identity number and document type' });
  }
  if (!documentPath.startsWith(`${user.id}/kyc/`) || documentPath.includes('..')) {
    return res.status(400).json({ error: 'Upload the certified document to your private identity folder' });
  }
  if (req.body?.certified_copy !== true) {
    return res.status(400).json({ error: 'Confirm that the uploaded identity document is a certified copy' });
  }

  const objectList = await axios.post(
    `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
    { prefix: `${user.id}/kyc/`, limit: 100, search: documentPath.split('/').pop() },
    { headers: supabaseHeaders() }
  );
  if (!(objectList.data || []).some(object => `${user.id}/kyc/${object.name}` === documentPath)) {
    return res.status(400).json({ error: 'The uploaded identity document could not be found' });
  }

  const encrypted = encryptIdentityNumber(identityNumber);
  const identityHash = crypto.createHmac('sha256', encryptionKey()).update(`${countryCode}:${identityNumber}`).digest('hex');
  const submissionId = crypto.randomUUID();
  await axios.post(`${SUPABASE_URL}/rest/v1/identity_verification_submissions?on_conflict=user_id`, [{
    id: submissionId,
    user_id: user.id,
    country_code: countryCode,
    document_type: documentType,
    identity_number_ciphertext: encrypted.ciphertext,
    identity_number_iv: encrypted.iv,
    identity_number_tag: encrypted.tag,
    identity_number_hash: identityHash,
    document_object_path: documentPath,
    status: 'pending',
    reviewer_user_id: null,
    review_note: null,
    submitted_at: new Date().toISOString(),
    reviewed_at: null,
    updated_at: new Date().toISOString(),
  }], { headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }) });

  return res.status(202).json({ status: 'pending', country_code: countryCode, document_type: documentType });
}));

router.get('/admin/pending', asyncRoute(async (req, res) => {
  const admin = await authenticate(req);
  await requireAdmin(admin.id);
  const response = await axios.get(
    `${SUPABASE_URL}/rest/v1/identity_verification_submissions?select=id,user_id,country_code,document_type,identity_number_ciphertext,identity_number_iv,identity_number_tag,document_object_path,status,submitted_at&status=eq.pending&order=submitted_at.asc`,
    { headers: supabaseHeaders() }
  );

  const submissions = await Promise.all((response.data || []).map(async row => {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.identity_number_iv, 'base64'));
    decipher.setAuthTag(Buffer.from(row.identity_number_tag, 'base64'));
    const identityNumber = Buffer.concat([
      decipher.update(Buffer.from(row.identity_number_ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    const signed = await axios.post(
      `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${row.document_object_path.split('/').map(encodeURIComponent).join('/')}`,
      { expiresIn: 300 },
      { headers: supabaseHeaders() }
    );
    return {
      id: row.id,
      user_id: row.user_id,
      country_code: row.country_code,
      document_type: row.document_type,
      identity_number: identityNumber,
      document_url: `${SUPABASE_URL}/storage/v1${signed.data?.signedURL || ''}`,
      status: row.status,
      submitted_at: row.submitted_at,
    };
  }));
  return res.json({ submissions });
}));

router.post('/admin/:submissionId/review', asyncRoute(async (req, res) => {
  const admin = await authenticate(req);
  await requireAdmin(admin.id);
  const status = String(req.body?.status || '');
  const riskStatus = String(req.body?.risk_status || '');
  const reviewNote = String(req.body?.review_note || '').slice(0, 1000);
  if (!['verified', 'rejected'].includes(status) || !['active', 'review', 'blocked'].includes(riskStatus)) {
    return res.status(400).json({ error: 'Choose an identity decision and an AML risk status' });
  }

  const lookup = await axios.get(
    `${SUPABASE_URL}/rest/v1/identity_verification_submissions?select=id,user_id,status&id=eq.${encodeURIComponent(req.params.submissionId)}&limit=1`,
    { headers: supabaseHeaders() }
  );
  const submission = lookup.data?.[0];
  if (!submission || submission.status !== 'pending') return res.status(404).json({ error: 'Pending identity submission not found' });

  await axios.patch(
    `${SUPABASE_URL}/rest/v1/identity_verification_submissions?id=eq.${encodeURIComponent(submission.id)}`,
    { status, reviewer_user_id: admin.id, review_note: reviewNote || null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { headers: supabaseHeaders({ Prefer: 'return=minimal' }) }
  );
  await syncKycStatus(submission.user_id, submission.country_code, submission.id, status, riskStatus);
  return res.json({ status, risk_status: riskStatus });
}));

module.exports = router;
