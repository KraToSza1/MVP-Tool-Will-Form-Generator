-- Microsoft calendar: keep each staff member connected by storing their Microsoft refresh token server-side.
-- Only the microsoft-calendar-token edge function (service role) reads/writes this table; browsers never see it.
CREATE TABLE IF NOT EXISTS public.staff_microsoft_tokens (
  profile_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_microsoft_tokens ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: anon/authenticated roles have no access; the service role bypasses RLS.
REVOKE ALL ON public.staff_microsoft_tokens FROM anon, authenticated;
