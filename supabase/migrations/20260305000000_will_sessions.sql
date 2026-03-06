-- Will Tool Phase 2: will_sessions table + RLS + RPCs (ref + secret_hash)
-- Run in Supabase SQL Editor. Requires pgcrypto extension.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table: one row per session; access only via RPCs that verify secret
CREATE TABLE IF NOT EXISTS public.will_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE,
  secret_hash text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for lookups by ref
CREATE UNIQUE INDEX IF NOT EXISTS idx_will_sessions_ref ON public.will_sessions (ref);

-- Trigger: keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS will_sessions_updated_at ON public.will_sessions;
CREATE TRIGGER will_sessions_updated_at
  BEFORE UPDATE ON public.will_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: anon has no direct access; all access via RPCs
ALTER TABLE public.will_sessions ENABLE ROW LEVEL SECURITY;

-- No direct table access for anon (RPCs use SECURITY DEFINER to read/write)
CREATE POLICY "No direct anon access" ON public.will_sessions
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- RPC: create session (ref, plain secret, payload). Stores secret_hash.
CREATE OR REPLACE FUNCTION public.create_will_session(p_ref text, p_secret text, p_payload jsonb DEFAULT '{}')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.will_sessions (ref, secret_hash, payload)
  VALUES (p_ref, crypt(p_secret, gen_salt('bf')), COALESCE(p_payload, '{}'));
  RETURN true;
EXCEPTION
  WHEN unique_violation THEN
    RETURN false;
END;
$$;

-- RPC: get payload by ref + secret
CREATE OR REPLACE FUNCTION public.get_will_session(p_ref text, p_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  SELECT payload INTO v_payload
  FROM public.will_sessions
  WHERE ref = p_ref AND secret_hash = crypt(p_secret, secret_hash);
  RETURN v_payload;
END;
$$;

-- RPC: update payload by ref + secret
CREATE OR REPLACE FUNCTION public.update_will_session(p_ref text, p_secret text, p_payload jsonb DEFAULT '{}')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.will_sessions
  SET payload = COALESCE(p_payload, '{}')
  WHERE ref = p_ref AND secret_hash = crypt(p_secret, secret_hash);
  RETURN FOUND;
END;
$$;

-- Grant execute to anon (and authenticated if needed later)
GRANT EXECUTE ON FUNCTION public.create_will_session(text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.get_will_session(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_will_session(text, text, jsonb) TO anon;
