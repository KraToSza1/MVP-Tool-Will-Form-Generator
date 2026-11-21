// Keeps staff Microsoft calendar connections alive.
// POST { action: 'store', refresh_token }  -> saves the signed-in user's Microsoft refresh token
// POST { action: 'access' }                -> returns a fresh Microsoft Graph access token for the signed-in user
// Secrets: AZURE_CLIENT_SECRET (required), AZURE_CLIENT_ID / AZURE_TENANT_ID (optional overrides).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CLIENT_ID = Deno.env.get('AZURE_CLIENT_ID') || '036e8cd1-4a49-4f04-8dd5-d22bbd2858c2';
const TENANT_ID = Deno.env.get('AZURE_TENANT_ID') || '4a7639e3-abcb-4e0b-be6b-ca8e7af07f5e';
const CLIENT_SECRET = Deno.env.get('AZURE_CLIENT_SECRET') || '';
const SCOPES = 'offline_access User.Read Calendars.ReadBasic';

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  const user = userData?.user;
  if (userError || !user) return json(401, { error: 'not_signed_in' });

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  if (body.action === 'store') {
    const refreshToken = String(body.refresh_token || '');
    if (refreshToken.length < 20) return json(400, { error: 'missing_refresh_token' });
    const { error } = await admin.from('staff_microsoft_tokens')
      .upsert({ profile_id: user.id, refresh_token: refreshToken, updated_at: new Date().toISOString() });
    if (error) return json(500, { error: 'store_failed', detail: error.message });
    return json(200, { ok: true });
  }

  if (body.action === 'access') {
    if (!CLIENT_SECRET) return json(500, { error: 'server_not_configured', detail: 'AZURE_CLIENT_SECRET is not set' });
    const { data: row } = await admin.from('staff_microsoft_tokens')
      .select('refresh_token').eq('profile_id', user.id).maybeSingle();
    if (!row?.refresh_token) return json(404, { error: 'not_connected' });

    const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: row.refresh_token,
        scope: SCOPES,
      }),
    });
    const tok = await res.json().catch(() => ({}));
    if (!res.ok || !tok.access_token) {
      if (tok.error === 'invalid_grant') {
        await admin.from('staff_microsoft_tokens').delete().eq('profile_id', user.id);
        return json(409, { error: 'reconnect_required' });
      }
      return json(502, { error: 'microsoft_refresh_failed', detail: tok.error_description || tok.error || res.status });
    }
    if (tok.refresh_token && tok.refresh_token !== row.refresh_token) {
      await admin.from('staff_microsoft_tokens')
        .update({ refresh_token: tok.refresh_token, updated_at: new Date().toISOString() })
        .eq('profile_id', user.id);
    }
    return json(200, { access_token: tok.access_token, expires_in: tok.expires_in || 3600 });
  }

  return json(400, { error: 'unknown_action' });
});
