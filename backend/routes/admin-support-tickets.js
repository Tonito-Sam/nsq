const express = require('express');
const axios = require('axios');
const requireAdmin = require('../utils/requireAdmin.cjs');

const router = express.Router();
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TICKET_STATUSES = new Set(['open', 'responded', 'resolved', 'closed', 'pending']);

function headers(extra = {}) {
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
    const message = error.status
      ? error.message
      : error.response?.data?.message || error.response?.data?.details || 'Support ticket request failed';
    if (status >= 500) console.error('Admin support tickets API error:', error.response?.data || error.message);
    res.status(status).json({ error: message });
  });
}

async function authenticateAdmin(req) {
  const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    const error = new Error('Support ticket service is not configured');
    error.status = 503;
    throw error;
  }
  if (!accessToken) {
    const error = new Error('Sign in to continue');
    error.status = 401;
    throw error;
  }

  const response = await axios.get(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${accessToken}` },
  });
  await requireAdmin(response.data.id);
  return response.data;
}

function idFilter(ids) {
  return `in.(${ids.map(id => encodeURIComponent(String(id))).join(',')})`;
}

async function loadUsers(ids, select) {
  const uniqueIds = [...new Set(ids.map(String).filter(id => UUID_PATTERN.test(id)))];
  if (!uniqueIds.length) return [];

  const response = await axios.get(`${SUPABASE_URL}/rest/v1/users`, {
    params: { select, id: idFilter(uniqueIds) },
    headers: headers(),
  });
  return response.data || [];
}

router.get('/', asyncRoute(async (req, res) => {
  await authenticateAdmin(req);
  const ticketResponse = await axios.get(`${SUPABASE_URL}/rest/v1/support_tickets`, {
    params: { select: '*', order: 'created_at.desc', limit: 200 },
    headers: headers(),
  });
  const tickets = ticketResponse.data || [];
  if (!tickets.length) return res.json({ tickets: [] });

  const ticketIds = tickets.map(ticket => String(ticket.id));
  const [ticketUsers, repliesResponse] = await Promise.all([
    loadUsers(tickets.map(ticket => ticket.user_id).filter(Boolean), 'id,email,first_name,last_name,avatar_url'),
    axios.get(`${SUPABASE_URL}/rest/v1/ticket_replies`, {
      params: {
        select: '*',
        ticket_id: idFilter(ticketIds),
        order: 'created_at.asc',
      },
      headers: headers(),
    }),
  ]);
  const replies = repliesResponse.data || [];
  const replyUsers = await loadUsers(
    replies.map(reply => reply.user_id).filter(Boolean),
    'id,email,first_name,last_name'
  );
  const usersById = new Map([...ticketUsers, ...replyUsers].map(user => [String(user.id), user]));
  const repliesByTicket = new Map();

  for (const reply of replies) {
    const ticketId = String(reply.ticket_id);
    const group = repliesByTicket.get(ticketId) || [];
    group.push({ ...reply, user: usersById.get(String(reply.user_id)) || null });
    repliesByTicket.set(ticketId, group);
  }

  return res.json({
    tickets: tickets.map(ticket => ({
      ...ticket,
      user: usersById.get(String(ticket.user_id)) || null,
      replies: repliesByTicket.get(String(ticket.id)) || [],
    })),
  });
}));

router.patch('/:ticketId/status', asyncRoute(async (req, res) => {
  await authenticateAdmin(req);
  const status = String(req.body?.status || '');
  if (!TICKET_STATUSES.has(status)) return res.status(400).json({ error: 'Unsupported ticket status' });

  const updatedAt = new Date().toISOString();
  const response = await axios.patch(
    `${SUPABASE_URL}/rest/v1/support_tickets`,
    { status, updated_at: updatedAt },
    {
      params: { id: `eq.${req.params.ticketId}` },
      headers: headers({ Prefer: 'return=representation' }),
    }
  );
  const ticket = response.data?.[0];
  if (!ticket) return res.status(404).json({ error: 'Support ticket not found' });
  return res.json({ ticket });
}));

router.post('/:ticketId/replies', asyncRoute(async (req, res) => {
  const admin = await authenticateAdmin(req);
  const message = String(req.body?.message || '').trim();
  if (!message || message.length > 10000) {
    return res.status(400).json({ error: 'Enter a reply of no more than 10,000 characters' });
  }

  const ticketLookup = await axios.get(`${SUPABASE_URL}/rest/v1/support_tickets`, {
    params: { select: 'id', id: `eq.${req.params.ticketId}`, limit: 1 },
    headers: headers(),
  });
  if (!ticketLookup.data?.length) return res.status(404).json({ error: 'Support ticket not found' });

  const now = new Date().toISOString();
  const replyResponse = await axios.post(
    `${SUPABASE_URL}/rest/v1/ticket_replies`,
    [{
      ticket_id: req.params.ticketId,
      user_id: admin.id,
      message,
      is_admin: true,
      created_at: now,
    }],
    { headers: headers({ Prefer: 'return=representation' }) }
  );
  const ticketResponse = await axios.patch(
    `${SUPABASE_URL}/rest/v1/support_tickets`,
    {
      status: 'responded',
      admin_reply: message,
      admin_replied_at: now,
      updated_at: now,
    },
    {
      params: { id: `eq.${req.params.ticketId}` },
      headers: headers({ Prefer: 'return=representation' }),
    }
  );

  return res.json({
    reply: {
      ...replyResponse.data?.[0],
      user: {
        email: admin.email || '',
        first_name: admin.user_metadata?.first_name || 'Admin',
        last_name: admin.user_metadata?.last_name || '',
      },
    },
    ticket: ticketResponse.data?.[0],
  });
}));

module.exports = router;
