-- Will Tool: client-facing appointment bookings
-- Run in Supabase SQL Editor. Requires pgcrypto (already enabled by earlier migrations).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid REFERENCES public.matters (id) ON DELETE SET NULL,
  session_ref text,
  solicitor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  client_email text NOT NULL DEFAULT '',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'cancelled')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_time_range CHECK (end_at > start_at)
);

DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Active (non-cancelled) appointments must not collide on the same start time.
-- Phase 1 firm-wide capacity: one appointment per global slot. We can relax this
-- to (solicitor_id, start_at) once per-solicitor booking lands.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_slot_idx
  ON public.appointments (start_at)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_appointments_matter_id ON public.appointments (matter_id);
CREATE INDEX IF NOT EXISTS idx_appointments_solicitor_id ON public.appointments (solicitor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_at ON public.appointments (start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments (status);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct anon access to appointments" ON public.appointments;
CREATE POLICY "No direct anon access to appointments" ON public.appointments
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Staff can read appointments" ON public.appointments;
CREATE POLICY "Staff can read appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can insert appointments" ON public.appointments;
CREATE POLICY "Staff can insert appointments" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can update appointments" ON public.appointments;
CREATE POLICY "Staff can update appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can delete appointments" ON public.appointments;
CREATE POLICY "Staff can delete appointments" ON public.appointments
  FOR DELETE TO authenticated
  USING (public.is_staff());

-- RPC: list active (non-cancelled) appointment slots within a window for the
-- session's matter solicitor (or all unassigned bookings if matter has no
-- solicitor yet). Verifies the will_session ref+secret first.
CREATE OR REPLACE FUNCTION public.list_appointment_slots_taken(
  p_ref text,
  p_secret text,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_solicitor_id uuid;
  v_matter_found boolean := false;
  v_result jsonb;
BEGIN
  PERFORM 1
  FROM public.will_sessions
  WHERE ref = p_ref
    AND secret_hash = crypt(p_secret, secret_hash);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or invalid secret';
  END IF;

  IF p_to IS NULL OR p_from IS NULL OR p_to <= p_from THEN
    RAISE EXCEPTION 'Invalid time window';
  END IF;

  SELECT assigned_solicitor_id INTO v_solicitor_id
  FROM public.matters
  WHERE session_ref = p_ref
  LIMIT 1;
  v_matter_found := FOUND;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'start_at', a.start_at,
    'end_at', a.end_at
  ) ORDER BY a.start_at), '[]'::jsonb)
  INTO v_result
  FROM public.appointments a
  WHERE a.status <> 'cancelled'
    AND a.start_at < p_to
    AND a.end_at > p_from
    AND (
      v_matter_found = false
      OR (v_solicitor_id IS NULL)
      OR (a.solicitor_id IS NULL)
      OR (a.solicitor_id = v_solicitor_id)
    );

  RETURN v_result;
END;
$$;

-- RPC: client requests an appointment for the matter tied to (ref, secret).
-- Returns the inserted row as jsonb. Raises a unique_violation when the slot
-- is already booked, which we surface as a friendly conflict in the UI.
CREATE OR REPLACE FUNCTION public.request_appointment(
  p_ref text,
  p_secret text,
  p_start timestamptz,
  p_duration_minutes integer DEFAULT 60,
  p_notes text DEFAULT '',
  p_email text DEFAULT '',
  p_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_matter public.matters%ROWTYPE;
  v_appt public.appointments%ROWTYPE;
  v_duration integer;
  v_end timestamptz;
BEGIN
  PERFORM 1
  FROM public.will_sessions
  WHERE ref = p_ref
    AND secret_hash = crypt(p_secret, secret_hash);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or invalid secret';
  END IF;

  IF p_start IS NULL THEN
    RAISE EXCEPTION 'Appointment start time is required';
  END IF;

  IF p_start < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Appointment cannot be in the past';
  END IF;

  v_duration := GREATEST(COALESCE(p_duration_minutes, 60), 15);
  v_end := p_start + make_interval(mins => v_duration);

  SELECT * INTO v_matter
  FROM public.matters
  WHERE session_ref = p_ref
  LIMIT 1;

  INSERT INTO public.appointments (
    matter_id,
    session_ref,
    solicitor_id,
    client_name,
    client_email,
    start_at,
    end_at,
    status,
    notes
  )
  VALUES (
    v_matter.id,
    p_ref,
    v_matter.assigned_solicitor_id,
    COALESCE(NULLIF(p_name, ''), COALESCE(v_matter.client_name, '')),
    COALESCE(NULLIF(p_email, ''), COALESCE(v_matter.client_email, '')),
    p_start,
    v_end,
    'requested',
    COALESCE(p_notes, '')
  )
  RETURNING * INTO v_appt;

  IF v_matter.id IS NOT NULL THEN
    INSERT INTO public.matter_activity (matter_id, actor_type, action, metadata)
    VALUES (
      v_matter.id,
      'client',
      'appointment_requested',
      jsonb_build_object(
        'appointment_id', v_appt.id,
        'start_at', v_appt.start_at,
        'end_at', v_appt.end_at
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_appt.id,
    'start_at', v_appt.start_at,
    'end_at', v_appt.end_at,
    'status', v_appt.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_appointment_slots_taken(text, text, timestamptz, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.list_appointment_slots_taken(text, text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_appointment(text, text, timestamptz, integer, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.request_appointment(text, text, timestamptz, integer, text, text, text) TO authenticated;
