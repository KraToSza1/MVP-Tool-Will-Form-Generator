-- Phase 3: solicitor auth, matter tracking, and audit history

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text UNIQUE,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'solicitor' CHECK (role IN ('solicitor', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

INSERT INTO public.profiles (id, email, display_name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(COALESCE(u.email, ''), '@', 1))
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.current_user_role() IN ('solicitor', 'admin'), false)
$$;

CREATE TABLE IF NOT EXISTS public.matters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_ref text UNIQUE NOT NULL,
  client_reference text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'verification_pending', 'in_review', 'completed')),
  client_name text NOT NULL DEFAULT '',
  client_email text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  client_snapshot jsonb NOT NULL DEFAULT '{}',
  client_payload jsonb NOT NULL DEFAULT '{}',
  solicitor_payload jsonb NOT NULL DEFAULT '{}',
  current_step integer NOT NULL DEFAULT 0,
  outstanding_verification boolean NOT NULL DEFAULT true,
  verification_completed_at timestamptz,
  assigned_solicitor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  solicitor_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS matters_updated_at ON public.matters;
CREATE TRIGGER matters_updated_at
  BEFORE UPDATE ON public.matters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_matters_status ON public.matters (status);
CREATE INDEX IF NOT EXISTS idx_matters_assigned_solicitor_id ON public.matters (assigned_solicitor_id);
CREATE INDEX IF NOT EXISTS idx_matters_last_activity_at ON public.matters (last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_matters_client_reference ON public.matters (client_reference);
CREATE INDEX IF NOT EXISTS idx_matters_client_name ON public.matters (client_name);
CREATE INDEX IF NOT EXISTS idx_matters_client_email ON public.matters (client_email);

CREATE TABLE IF NOT EXISTS public.matter_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.matters (id) ON DELETE CASCADE,
  actor_type text NOT NULL CHECK (actor_type IN ('client', 'solicitor', 'system')),
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matter_activity_matter_id_created_at
  ON public.matter_activity (matter_id, created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matter_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read their own profile" ON public.profiles;
CREATE POLICY "Staff can read their own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "Staff can update their own profile" ON public.profiles;
CREATE POLICY "Staff can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Staff can read matters" ON public.matters;
CREATE POLICY "Staff can read matters" ON public.matters
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can update matters" ON public.matters;
CREATE POLICY "Staff can update matters" ON public.matters
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can read matter activity" ON public.matter_activity;
CREATE POLICY "Staff can read matter activity" ON public.matter_activity
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can insert matter activity" ON public.matter_activity;
CREATE POLICY "Staff can insert matter activity" ON public.matter_activity
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE OR REPLACE FUNCTION public.submit_will_matter(
  p_ref text,
  p_secret text,
  p_payload jsonb DEFAULT '{}',
  p_current_step integer DEFAULT 0,
  p_client_snapshot jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matter_id uuid;
BEGIN
  PERFORM 1
  FROM public.will_sessions
  WHERE ref = p_ref
    AND secret_hash = crypt(p_secret, secret_hash);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or invalid secret';
  END IF;

  INSERT INTO public.matters (
    session_ref,
    client_reference,
    status,
    client_name,
    client_email,
    client_phone,
    client_snapshot,
    client_payload,
    current_step,
    submitted_at,
    last_activity_at
  )
  VALUES (
    p_ref,
    p_ref,
    'submitted',
    COALESCE(p_client_snapshot->>'fullName', ''),
    COALESCE(p_client_snapshot->>'email', ''),
    COALESCE(p_client_snapshot->>'phoneNumber', ''),
    COALESCE(p_client_snapshot, '{}'),
    COALESCE(p_payload, '{}'),
    GREATEST(COALESCE(p_current_step, 0), 0),
    now(),
    now()
  )
  ON CONFLICT (session_ref) DO UPDATE
  SET
    client_reference = EXCLUDED.client_reference,
    client_name = EXCLUDED.client_name,
    client_email = EXCLUDED.client_email,
    client_phone = EXCLUDED.client_phone,
    client_snapshot = EXCLUDED.client_snapshot,
    client_payload = EXCLUDED.client_payload,
    current_step = EXCLUDED.current_step,
    status = CASE
      WHEN public.matters.status = 'completed' THEN public.matters.status
      ELSE 'submitted'
    END,
    submitted_at = COALESCE(public.matters.submitted_at, now()),
    last_activity_at = now(),
    updated_at = now()
  RETURNING id INTO v_matter_id;

  INSERT INTO public.matter_activity (matter_id, actor_type, action, metadata)
  VALUES (
    v_matter_id,
    'client',
    'submitted',
    jsonb_build_object(
      'session_ref', p_ref,
      'current_step', GREATEST(COALESCE(p_current_step, 0), 0)
    )
  );

  RETURN v_matter_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_will_matter(text, text, jsonb, integer, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_will_matter(text, text, jsonb, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_will_session(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_will_session(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_will_session(text, text, jsonb) TO authenticated;
