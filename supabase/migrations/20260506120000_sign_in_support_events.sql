-- Solicitor portal: record anonymised client-side sign-in diagnostics for admin review.
-- Rows are inserted only via SECURITY DEFINER RPC (callable by anon) so failures before login still reach the DB.

CREATE TABLE IF NOT EXISTS public.sign_in_support_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  attempt_id text,
  payload jsonb NOT NULL DEFAULT '{}',
  origin text,
  pathname text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_sign_in_support_events_created_at
  ON public.sign_in_support_events (created_at DESC);

ALTER TABLE public.sign_in_support_events ENABLE ROW LEVEL SECURITY;

-- Staff-only read (authenticated). UI limits the nav link to firm admins / configured owner email.
DROP POLICY IF EXISTS "Staff can read sign-in support events" ON public.sign_in_support_events;
CREATE POLICY "Staff can read sign-in support events"
  ON public.sign_in_support_events
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- No direct INSERT — use RPC below.

CREATE OR REPLACE FUNCTION public.record_sign_in_support_event(
  p_event_type text,
  p_attempt_id text,
  p_payload jsonb,
  p_origin text,
  p_pathname text,
  p_user_agent text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  IF p_event_type IS NULL OR p_event_type !~ '^[a-z][a-z0-9_]{0,80}$' THEN
    RAISE EXCEPTION 'invalid event type';
  END IF;

  v_payload := COALESCE(p_payload, '{}'::jsonb);

  IF length(v_payload::text) > 12000 THEN
    v_payload := jsonb_build_object('truncated', true, 'event_type_saved', left(p_event_type, 120));
  END IF;

  INSERT INTO public.sign_in_support_events (
    event_type,
    attempt_id,
    payload,
    origin,
    pathname,
    user_agent
  )
  VALUES (
    left(p_event_type, 128),
    nullif(left(COALESCE(p_attempt_id, ''), 128), ''),
    v_payload,
    left(COALESCE(p_origin, ''), 512),
    left(COALESCE(p_pathname, ''), 512),
    left(COALESCE(p_user_agent, ''), 1024)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_sign_in_support_event(text, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sign_in_support_event(text, text, jsonb, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.record_sign_in_support_event(text, text, jsonb, text, text, text) TO authenticated;
