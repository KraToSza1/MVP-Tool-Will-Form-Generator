import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type OutboxRow = {
  id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  event_type: string;
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function escapeHtml(input: string) {
  return String(input || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildProfessionalEmailHtml({
  recipientName,
  subject,
  body,
}: {
  recipientName: string;
  subject: string;
  body: string;
}) {
  const safeName = escapeHtml(recipientName || 'Client');
  const safeSubject = escapeHtml(subject || 'Appointment Update');
  const bodyHtml = escapeHtml(body || '').replaceAll('\n', '<br>');

  return `
  <div style="margin:0;padding:0;background:#f4f6fb;font-family:Segoe UI, Arial, sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#0f172a;color:#ffffff;padding:18px 24px;">
                <div style="font-size:20px;font-weight:700;letter-spacing:0.2px;">Aristone Solicitors</div>
                <div style="margin-top:4px;font-size:12px;opacity:0.9;">Regulated legal services communication</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <div style="font-size:14px;color:#334155;">Dear ${safeName},</div>
                <h1 style="margin:12px 0 0 0;font-size:21px;line-height:1.3;color:#0f172a;">${safeSubject}</h1>
                <div style="margin-top:16px;font-size:15px;line-height:1.7;color:#1e293b;">
                  ${bodyHtml}
                </div>
                <div style="margin-top:20px;padding:14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;line-height:1.6;color:#334155;">
                  Please do not reply to this automated confirmation if your matter requires urgent legal advice.
                  For assistance, contact <strong>info@aristonesolicitors.co.uk</strong> or call <strong>01582 383 888</strong>.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#475569;line-height:1.6;">
                Aristone Solicitors<br>
                Ground Floor, 12 Cardiff Road, Luton, LU1 1QG<br>
                Authorised and regulated by the Solicitors Regulation Authority (SRA No. 649717).
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

async function sendViaResend({
  accessToken,
  senderUser,
  replyTo,
  row,
}: {
  accessToken: string;
  senderUser: string;
  replyTo?: string;
  row: OutboxRow;
}) {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderUser)}/sendMail`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: row.subject || 'Appointment notification',
        body: {
          contentType: 'HTML',
          content: buildProfessionalEmailHtml({
            recipientName: row.recipient_name || '',
            subject: row.subject || 'Appointment notification',
            body: row.body || '',
          }),
        },
        toRecipients: [
          {
            emailAddress: {
              address: row.recipient_email,
              name: row.recipient_name || undefined,
            },
          },
        ],
        ...(replyTo
          ? {
              replyTo: [
                {
                  emailAddress: { address: replyTo },
                },
              ],
            }
          : {}),
      },
      saveToSentItems: true,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      error: `Microsoft Graph sendMail HTTP ${res.status}: ${text.slice(0, 500)}`,
    };
  }

  // Graph sendMail normally returns 202 with no body.
  return { ok: true, messageId: '' };
}

async function getMicrosoftGraphToken({
  tenantId,
  clientId,
  clientSecret,
}: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}) {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      error: `Microsoft token HTTP ${res.status}: ${text.slice(0, 500)}`,
      accessToken: '',
    };
  }

  try {
    const parsed = text ? JSON.parse(text) : {};
    const token = parsed?.access_token || '';
    if (!token) {
      return { ok: false, error: 'Microsoft token response missing access_token', accessToken: '' };
    }
    return { ok: true, error: '', accessToken: token };
  } catch {
    return { ok: false, error: 'Microsoft token response was not JSON', accessToken: '' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const m365TenantId = Deno.env.get('M365_TENANT_ID') || '';
  const m365ClientId = Deno.env.get('M365_CLIENT_ID') || '';
  const m365ClientSecret = Deno.env.get('M365_CLIENT_SECRET') || '';
  const m365SenderUser = Deno.env.get('M365_SENDER_USER') || '';
  const m365ReplyTo = Deno.env.get('M365_REPLY_TO') || '';
  const batchLimit = Math.max(1, Math.min(100, Number(Deno.env.get('OUTBOX_BATCH_LIMIT') || 20)));

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }
  if (!m365TenantId || !m365ClientId || !m365ClientSecret || !m365SenderUser) {
    return jsonResponse(500, {
      error:
        'Missing one or more M365 mail secrets: M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET, M365_SENDER_USER',
    });
  }

  const tokenResult = await getMicrosoftGraphToken({
    tenantId: m365TenantId,
    clientId: m365ClientId,
    clientSecret: m365ClientSecret,
  });
  if (!tokenResult.ok) {
    return jsonResponse(500, { error: tokenResult.error });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error: fetchError } = await supabaseAdmin
    .from('appointment_email_outbox')
    .select('id, recipient_email, recipient_name, subject, body, event_type')
    .is('delivered_at', null)
    .order('created_at', { ascending: true })
    .limit(batchLimit);

  if (fetchError) {
    return jsonResponse(500, { error: fetchError.message });
  }

  const outboxRows: OutboxRow[] = Array.isArray(rows) ? rows : [];
  if (outboxRows.length === 0) {
    return jsonResponse(200, {
      ok: true,
      fetched: 0,
      delivered: 0,
      failed: 0,
      note: 'No pending outbox rows',
    });
  }

  let delivered = 0;
  let failed = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (const row of outboxRows) {
    if (!row.recipient_email || !String(row.recipient_email).includes('@')) {
      failed += 1;
      const invalidError = 'Invalid recipient email';
      failures.push({ id: row.id, error: invalidError });
      await supabaseAdmin
        .from('appointment_email_outbox')
        .update({ delivery_error: invalidError })
        .eq('id', row.id);
      continue;
    }

    const sendResult = await sendViaResend({
      accessToken: tokenResult.accessToken,
      senderUser: m365SenderUser,
      replyTo: m365ReplyTo || undefined,
      row,
    });

    if (sendResult.ok) {
      delivered += 1;
      const meta = sendResult.messageId
        ? `Microsoft Graph accepted (messageId=${sendResult.messageId})`
        : 'Microsoft Graph accepted (HTTP 202)';
      await supabaseAdmin
        .from('appointment_email_outbox')
        .update({
          delivered_at: new Date().toISOString(),
          delivery_error: meta,
        })
        .eq('id', row.id);
    } else {
      failed += 1;
      failures.push({ id: row.id, error: sendResult.error });
      await supabaseAdmin
        .from('appointment_email_outbox')
        .update({ delivery_error: sendResult.error })
        .eq('id', row.id);
    }
  }

  return jsonResponse(200, {
    ok: true,
    fetched: outboxRows.length,
    delivered,
    failed,
    failures,
  });
});

