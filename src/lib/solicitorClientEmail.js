import { supabase, isSupabaseConfigured } from './supabase.js';

/**
 * Sends the matter client-chase email via Supabase Edge + Microsoft Graph
 * (`send-solicitor-client-email`). Deploy with JWT verification enabled
 * (`supabase functions deploy send-solicitor-client-email`). Reuses M365_* secrets from appointment mail.
 *
 * @param {{ matterId: string, to: string, subject: string, body: string, recipientName?: string }} args
 */
export async function sendSolicitorClientEmailViaGraph(args) {
  const { matterId, to, subject, body, recipientName } = args;
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: false, error: 'Cloud save is not configured (missing Supabase).' };
  }

  const { data, error } = await supabase.functions.invoke('send-solicitor-client-email', {
    body: {
      matter_id: matterId,
      to,
      subject,
      body,
      recipient_name: recipientName || undefined,
    },
  });

  if (data?.error) {
    return { ok: false, error: String(data.error) };
  }
  if (error) {
    const fallback =
      typeof data?.error === 'string' ? data.error : error.message || 'Could not send email';
    return { ok: false, error: fallback };
  }
  if (!data?.ok) {
    return { ok: false, error: 'Could not send email' };
  }
  return { ok: true };
}
