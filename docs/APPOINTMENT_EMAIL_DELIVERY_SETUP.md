# Appointment Email Delivery Setup (Microsoft 365 / Graph)

This project already queues booking emails in `public.appointment_email_outbox`.
To send them for real, deploy the Edge Function:

- `supabase/functions/process-appointment-outbox/index.ts`

## 1) Create/Reuse a Microsoft Entra app for mail sending

Use Entra admin portal:

1. Go to **Microsoft Entra ID** -> **App registrations** -> your mail app.
2. Copy:
   - **Application (client) ID** -> `M365_CLIENT_ID`
   - **Directory (tenant) ID** -> `M365_TENANT_ID`
3. Certificates & secrets -> create a **Client secret** -> copy value -> `M365_CLIENT_SECRET`
4. API permissions -> add **Microsoft Graph** -> **Application permissions**:
   - `Mail.Send`
5. Click **Grant admin consent**.

> Important: this app-permission flow sends from a fixed mailbox user you choose
> (`M365_SENDER_USER`), e.g. `info@aristonesolicitors.co.uk`.

## 2) Set Supabase function secrets

Run these in your local terminal (replace values with your real tenant/app values):

```bash
supabase secrets set M365_TENANT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" --project-ref proyrepqqpzerloyydlk
supabase secrets set M365_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" --project-ref proyrepqqpzerloyydlk
supabase secrets set M365_CLIENT_SECRET="your-client-secret-value" --project-ref proyrepqqpzerloyydlk
supabase secrets set M365_SENDER_USER="info@aristonesolicitors.co.uk" --project-ref proyrepqqpzerloyydlk
supabase secrets set M365_REPLY_TO="info@aristonesolicitors.co.uk" --project-ref proyrepqqpzerloyydlk
```

Required:

- `M365_TENANT_ID`
- `M365_CLIENT_ID`
- `M365_CLIENT_SECRET`
- `M365_SENDER_USER`

Optional:

- `M365_REPLY_TO`
- `OUTBOX_BATCH_LIMIT` (default 20)

## 3) Deploy the function

Because client booking flow is anonymous, deploy with JWT verification disabled:

```bash
npx supabase functions deploy process-appointment-outbox --project-ref proyrepqqpzerloyydlk --no-verify-jwt
```

## 4) Verify end-to-end

1. Submit a booking in the client flow.
2. Check outbox rows:

```sql
select created_at, event_type, recipient_email, delivered_at, delivery_error
from public.appointment_email_outbox
order by created_at desc
limit 20;
```

Success means:

- `delivered_at` is populated shortly after booking
- `delivery_error` is null or contains `"Microsoft Graph accepted (HTTP 202)"`

## 5) Manual trigger (optional)

You can manually trigger delivery by POSTing:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/process-appointment-outbox" \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"manual_test"}'
```

## Notes

- Fake emails (e.g. `example.com` placeholders) will not deliver.
- Booking UI is non-blocking: booking succeeds even if email send fails; failure details are written into `delivery_error`.
- The function only sends rows with `delivered_at IS NULL`, so successful sends are not retried.

