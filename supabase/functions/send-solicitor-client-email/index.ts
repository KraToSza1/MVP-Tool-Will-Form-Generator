import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function normalizeEmail(s: unknown) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, '');
}

function buildSolicitorClientHtml({
  subjectLine,
  bodyPlain,
}: {
  subjectLine: string;
  bodyPlain: string;
}) {
  const safeSubject = escapeHtml(subjectLine || 'Update from Aristone Solicitors');
  const bodyHtml = escapeHtml(bodyPlain || '').replaceAll('\n', '<br>');

  return `
  <div style="margin:0;padding:0;background:#f4f6fb;font-family:Segoe UI, Arial, sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#0f172a;color:#ffffff;padding:18px 24px;">
                <div style="font-size:20px;font-weight:700;letter-spacing:0.2px;">Aristone Solicitors</div>
                <div style="margin-top:4px;font-size:12px;opacity:0.9;">Will matter update</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 16px 0;font-size:19px;line-height:1.35;color:#0f172a;font-weight:700;">
                  ${safeSubject}
                </h1>
                <div style="font-size:15px;line-height:1.7;color:#1e293b;">
                  ${bodyHtml}
                </div>
                <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.6;color:#475569;">
                  Aristone Solicitors<br>
                  Ground Floor, 12 Cardiff Road, Luton, LU1 1QG<br>
                  Tel 01582 383 888 &middot;
                  Authorised and regulated by the Solicitors Regulation Authority (SRA No.&nbsp;649717).
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

async function sendGraphMail({
  accessToken,
  senderUser,
  replyTo,
  toEmail,
  toName,
  subject,
  html,
}: {
  accessToken: string;
  senderUser: string;
  replyTo?: string;
  toEmail: string;
  toName?: string;
  subject: string;
  html: string;
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
        subject: subject.slice(0, 250),
        body: { contentType: 'HTML', content: html },
        toRecipients: [
          {
            emailAddress: {
              address: toEmail,
              name: toName || undefined,
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
      ok: false as const,
      error: `Microsoft Graph sendMail HTTP ${res.status}: ${text.slice(0, 500)}`,
    };
  }
  return { ok: true as const };
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false as const, error: `Microsoft token HTTP ${res.status}: ${text.slice(0, 500)}`, accessToken: '' };
  }

  try {
    const parsed = text ? JSON.parse(text) : {};
    const token = parsed?.access_token || '';
    if (!token) {
      return { ok: false as const, error: 'Microsoft token response missing access_token', accessToken: '' };
    }
    return { ok: true as const, error: '', accessToken: token };
  } catch {
    return { ok: false as const, error: 'Microsoft token response was not JSON', accessToken: '' };
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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const m365TenantId = Deno.env.get('M365_TENANT_ID') || '';
  const m365ClientId = Deno.env.get('M365_CLIENT_ID') || '';
  const m365ClientSecret = Deno.env.get('M365_CLIENT_SECRET') || '';
  const m365SenderUser = Deno.env.get('M365_SENDER_USER') || '';
  const m365ReplyTo = Deno.env.get('M365_REPLY_TO') || '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Missing Supabase environment variables' });
  }
  if (!m365TenantId || !m365ClientId || !m365ClientSecret || !m365SenderUser) {
    return jsonResponse(503, {
      error:
        'Email send is not configured (missing M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET, or M365_SENDER_USER)',
    });
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'Missing or invalid Authorization header' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authErr } = await userClient.auth.getUser();
  const user = authData?.user;
  if (authErr || !user?.id) {
    return jsonResponse(401, { error: authErr?.message || 'Unauthorized' });
  }

  const { data: profile, error: profErr } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profErr) {
    return jsonResponse(403, { error: profErr.message || 'Could not verify profile' });
  }
  const role = profile?.role;
  if (role !== 'solicitor' && role !== 'admin') {
    return jsonResponse(403, { error: 'Staff access required' });
  }

  let bodyJson: Record<string, unknown>;
  try {
    bodyJson = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const matterId = String(bodyJson?.matter_id || bodyJson?.matterId || '').trim();
  const toRaw = String(bodyJson?.to || '').trim();
  const subject = String(bodyJson?.subject || '').trim();
  const bodyPlain = String(bodyJson?.body || '');
  const recipientName = String(bodyJson?.recipient_name || bodyJson?.recipientName || 'Client').trim();

  if (!UUID_RE.test(matterId)) {
    return jsonResponse(400, { error: 'Invalid matter id' });
  }
  if (!toRaw.includes('@')) {
    return jsonResponse(400, { error: 'Invalid recipient address' });
  }
  if (subject.length === 0 || subject.length > 500) {
    return jsonResponse(400, { error: 'Subject must be 1–500 characters' });
  }
  if (bodyPlain.length === 0) {
    return jsonResponse(400, { error: 'Message cannot be empty' });
  }
  if (bodyPlain.length > 100_000) {
    return jsonResponse(400, { error: 'Message too long (max 100,000 characters)' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: matter, error: matErr } = await supabaseAdmin
    .from('matters')
    .select('id, client_email')
    .eq('id', matterId)
    .maybeSingle();

  if (matErr || !matter?.id) {
    return jsonResponse(404, { error: 'Matter not found' });
  }

  const stored = normalizeEmail(matter.client_email);
  const incoming = normalizeEmail(toRaw);
  if (!stored || incoming !== stored) {
    return jsonResponse(400, { error: 'Recipient must match the client email on this matter' });
  }

  const tokenResult = await getMicrosoftGraphToken({
    tenantId: m365TenantId,
    clientId: m365ClientId,
    clientSecret: m365ClientSecret,
  });
  if (!tokenResult.ok) {
    return jsonResponse(502, { error: tokenResult.error });
  }

  const html = buildSolicitorClientHtml({
    subjectLine: subject,
    bodyPlain,
  });

  const sendResult = await sendGraphMail({
    accessToken: tokenResult.accessToken,
    senderUser: m365SenderUser,
    replyTo: m365ReplyTo || undefined,
    toEmail: toRaw,
    toName: recipientName !== 'Client' ? recipientName : undefined,
    subject,
    html,
  });

  if (!sendResult.ok) {
    return jsonResponse(502, { error: sendResult.error });
  }

  await supabaseAdmin.from('matter_activity').insert({
    matter_id: matterId,
    actor_type: 'solicitor',
    actor_profile_id: user.id,
    action: 'client_email_sent',
    metadata: {
      to: toRaw,
      subject_preview: subject.slice(0, 120),
    },
  });

  return jsonResponse(200, { ok: true });
});
