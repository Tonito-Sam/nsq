# WhatsApp Order Notifications

Order alerts are sent only after a provider confirms payment. Store owners must verify their recipient number and explicitly enable notifications in Store Settings. A unique outbox row per payment and store prevents duplicate alerts; the backend worker retries temporary Meta API failures.

## Database

Apply `supabase/migrations/20261012_store_whatsapp_order_notifications.sql` before deploying the backend. The migration adds verified-number fields, OTP storage, order summaries, and the notification outbox. If the unique payment-reference/store index cannot be created, inspect and resolve duplicate rows before retrying:

```sql
select payment_reference, store_id, count(*)
from public.orders
where payment_reference is not null
group by payment_reference, store_id
having count(*) > 1;
```

## Meta Setup

Configure a NexSq-owned WhatsApp Business Platform sender and add these server-only environment variables to the Node backend (never to Vite or browser environment variables):

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_OTP_SECRET` (a long random secret used to hash verification codes)
- `WHATSAPP_VERIFICATION_TEMPLATE_NAME`
- `WHATSAPP_ORDER_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANGUAGE` (for example, `en`)
- `PUBLIC_APP_URL` (the public NexSq site origin)

The approved verification template must have one body variable for the six-digit code. The approved utility order template must have five body variables in this order: store name, order reference, item summary, amount with currency, and secure order-management URL. Configure the template names to match Meta exactly.

## Payment Provider Webhooks

- Configure PayStack to send `charge.success` events to `https://<public-api-host>/api/payments/paystack/itn`.
- PayFast's `notify_url` is set to `https://<public-api-host>/api/payments/payfast/itn`; the API must be publicly reachable for PayFast ITN delivery.
- Set PayStack and PayFast server credentials on the backend. Keep PayFast sandbox/live mode consistent with the merchant account.

The API process starts the outbox worker automatically. If WhatsApp credentials are absent, queued notifications remain pending and no message is sent. Delivery still requires valid Meta credentials and approved templates; these cannot be verified from this repository alone.
