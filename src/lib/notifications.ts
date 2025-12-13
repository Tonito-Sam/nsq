export interface NotificationPayload {
  user_id: string; // recipient
  actor_id?: string | null; // actor who triggered
  type: string; // e.g., 'like', 'comment'
  object_type?: string | null; // e.g., 'posts', 'comments'
  object_id?: string | null; // id of the object
  title?: string | null;
  message?: string | null;
  data?: Record<string, any> | null;
}

import apiUrl from '@/lib/api';

export async function sendNotification(payload: NotificationPayload) {
  try {
    const resp = await fetch(apiUrl('/api/notifications/create'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('sendNotification failed', resp.status, text);
      return null;
    }
    const json = await resp.json();
    return json.inserted || json;
  } catch (err) {
    console.error('sendNotification error', err);
    return null;
  }
}

export default sendNotification;
