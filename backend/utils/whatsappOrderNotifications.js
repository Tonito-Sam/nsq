const axios = require('axios');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const TABLE = 'store_whatsapp_order_notifications';

function restUrl(path) {
  return `${SUPABASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function whatsappConfig() {
  return {
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v22.0',
    orderTemplate: process.env.WHATSAPP_ORDER_TEMPLATE_NAME || 'nexsq_new_order',
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en',
  };
}

async function sendTemplateMessage(to, templateName, parameters) {
  const config = whatsappConfig();
  if (!config.token || !config.phoneNumberId) throw new Error('WhatsApp Cloud API is not configured');

  const response = await axios.post(
    `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: String(to).replace(/\D/g, ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: config.language },
        components: [{
          type: 'body',
          parameters: parameters.map(text => ({ type: 'text', text: String(text || '').slice(0, 1024) })),
        }],
      },
    },
    { headers: { Authorization: `Bearer ${config.token}` } }
  );

  return response.data?.messages?.[0]?.id || null;
}

async function enqueuePaidOrderNotification(orderId) {
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error('WhatsApp notification storage is not configured');

  const orderResponse = await axios.get(
    `${restUrl('/rest/v1/orders')}?select=id,store_id,status,total_amount,currency,item_summary,payment_reference&id=eq.${encodeURIComponent(orderId)}&limit=1`,
    { headers: supabaseHeaders() }
  );
  const order = orderResponse.data?.[0];
  if (!order || !['paid', 'completed'].includes(order.status) || !order.store_id) return null;

  const storeResponse = await axios.get(
    `${restUrl('/rest/v1/user_stores')}?select=id,store_name,business_whatsapp_number,business_whatsapp_verified_at,notify_whatsapp&id=eq.${encodeURIComponent(order.store_id)}&limit=1`,
    { headers: supabaseHeaders() }
  );
  const store = storeResponse.data?.[0];
  if (!store?.notify_whatsapp || !store.business_whatsapp_number || !store.business_whatsapp_verified_at) return null;

  const appUrl = (process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '');
  if (!appUrl) {
    console.warn('PUBLIC_APP_URL is not configured; WhatsApp order notification was not queued');
    return null;
  }

  const payload = [{
    order_id: order.id,
    store_id: store.id,
    recipient_phone: store.business_whatsapp_number,
    payment_reference: order.payment_reference,
    store_name: store.store_name || 'Your store',
    order_reference: String(order.id).slice(0, 8).toUpperCase(),
    item_summary: order.item_summary || 'New paid order',
    amount: Number(order.total_amount),
    currency: order.currency || 'ZAR',
    order_url: `${appUrl}/my-store?section=orders&order_id=${encodeURIComponent(order.id)}`,
  }];

  const response = await axios.post(
    `${restUrl(`/rest/v1/${TABLE}`)}?on_conflict=payment_reference,store_id`,
    payload,
    { headers: supabaseHeaders({ Prefer: 'resolution=ignore-duplicates,return=representation' }) }
  );
  return response.data?.[0] || null;
}

async function patchNotification(id, payload, filters = '') {
  await axios.patch(
    `${restUrl(`/rest/v1/${TABLE}`)}?id=eq.${encodeURIComponent(id)}${filters}`,
    { ...payload, updated_at: new Date().toISOString() },
    { headers: supabaseHeaders({ Prefer: 'return=minimal' }) }
  );
}

async function processWhatsAppOrderNotifications() {
  const config = whatsappConfig();
  if (!SUPABASE_URL || !SERVICE_ROLE || !config.token || !config.phoneNumberId) return;

  const staleSendingBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await axios.patch(
    `${restUrl(`/rest/v1/${TABLE}`)}?status=eq.sending&updated_at=lt.${encodeURIComponent(staleSendingBefore)}`,
    { status: 'pending', available_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { headers: supabaseHeaders({ Prefer: 'return=minimal' }) }
  );

  const response = await axios.get(restUrl(`/rest/v1/${TABLE}`), {
    params: {
      select: '*',
      status: 'eq.pending',
      available_at: `lte.${new Date().toISOString()}`,
      order: 'created_at.asc',
      limit: '20',
    },
    headers: supabaseHeaders(),
  });

  for (const notification of response.data || []) {
    const attempts = Number(notification.attempts || 0) + 1;
    const claim = await axios.patch(
      `${restUrl(`/rest/v1/${TABLE}`)}?id=eq.${encodeURIComponent(notification.id)}&status=eq.pending`,
      { status: 'sending', attempts, updated_at: new Date().toISOString() },
      { headers: supabaseHeaders({ Prefer: 'return=representation' }) }
    );
    if (!claim.data?.length) continue;

    try {
      const messageId = await sendTemplateMessage(notification.recipient_phone, config.orderTemplate, [
        notification.store_name,
        notification.order_reference,
        notification.item_summary,
        `${notification.currency} ${Number(notification.amount).toFixed(2)}`,
        notification.order_url,
      ]);
      await patchNotification(notification.id, {
        status: 'sent',
        provider_message_id: messageId,
        last_error: null,
        sent_at: new Date().toISOString(),
      });
    } catch (error) {
      const retryDelay = Math.min(60, 2 ** attempts);
      await patchNotification(notification.id, {
        status: attempts >= 6 ? 'failed' : 'pending',
        available_at: new Date(Date.now() + retryDelay * 60 * 1000).toISOString(),
        last_error: String(error.response?.data?.error?.message || error.message).slice(0, 1000),
      });
      console.error('WhatsApp order notification failed:', error.response?.data || error.message);
    }
  }
}

function startWhatsAppOrderNotificationWorker() {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.warn('WhatsApp order notification worker disabled: Supabase service credentials are missing');
    return;
  }

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processWhatsAppOrderNotifications();
    } catch (error) {
      console.error('WhatsApp order notification worker failed:', error.response?.data || error.message);
    } finally {
      running = false;
    }
  };

  void run();
  setInterval(run, Math.max(5000, Number(process.env.WHATSAPP_WORKER_POLL_MS || 15000))).unref();
}

module.exports = { enqueuePaidOrderNotification, sendTemplateMessage, startWhatsAppOrderNotificationWorker };
