-- Will Tool: client-facing appointment management helpers.
--
-- Adds three anon-callable RPCs verified by (will_session ref + secret):
--   * public.get_session_appointment_context  → solicitor rules + active booking
--   * public.cancel_appointment_by_session    → cancel my booking
--   * public.reschedule_appointment_by_session → cancel + rebook in one transaction
--
-- Also introduces a transparent `appointment_email_outbox` paper-trail so the
-- firm can wire up real email sending later (Edge Function / Make / Zapier)
-- without changing any application code.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Outbox table: every booking event records the email we *would* have sent.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointment_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments (id) ON DELETE SET NULL,
  matter_id uuid REFERENCES public.matters (id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('requested', 'rescheduled', 'cancelled')),
  recipient_role text NOT NULL CHECK (recipient_role IN ('client', 'solicitor', 'firm')),
  recipient_email text NOT NULL DEFAULT '',
  recipient_name text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  delivered_at timestamptz,
  delivery_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_email_outbox_undelivered
  ON public.appointment_email_outbox (created_at)
  WHERE delivered_at IS NULL;

ALTER TABLE public.appointment_email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No anon access to appointment outbox" ON public.appointment_email_outbox;
CREATE POLICY "No anon access to appointment outbox" ON public.appointment_email_outbox
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Staff can read appointment outbox" ON public.appointment_email_outbox;
CREATE POLICY "Staff can read appointment outbox" ON public.appointment_email_outbox
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can update appointment outbox" ON public.appointment_email_outbox;
CREATE POLICY "Staff can update appointment outbox" ON public.appointment_email_outbox
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ---------------------------------------------------------------------------
-- 2. Helper: enqueue both client + solicitor email rows for an event.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._enqueue_appointment_outbox(
  p_appt public.appointments,
  p_matter public.matters,
  p_event_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_solicitor_email text;
  v_solicitor_name text;
  v_subject_client text;
  v_subject_staff text;
  v_body_client text;
  v_body_staff text;
  v_when text;
  v_matter_ref text;
BEGIN
  IF p_appt.id IS NULL THEN
    RETURN;
  END IF;

  v_when := to_char(p_appt.start_at, 'Dy DD Mon YYYY HH24:MI')
            || '–' || to_char(p_appt.end_at, 'HH24:MI');
  v_matter_ref := COALESCE(p_matter.client_reference, p_matter.id::text, '');

  IF p_appt.solicitor_id IS NOT NULL THEN
    SELECT email, COALESCE(NULLIF(display_name, ''), email)
      INTO v_solicitor_email, v_solicitor_name
    FROM public.profiles
    WHERE id = p_appt.solicitor_id;
  END IF;

  -- ── CLIENT email (always; client always has an email if they booked) ─────
  IF COALESCE(p_appt.client_email, '') <> '' THEN
    IF p_event_type = 'requested' THEN
      v_subject_client := 'Your will appointment is requested · ' || v_when;
      v_body_client := 'Hello ' || COALESCE(NULLIF(p_appt.client_name, ''), 'there') || E',\n\n'
        || 'Your appointment has been requested for ' || v_when || E'.\n'
        || 'Reference: ' || v_matter_ref || E'.\n\n'
        || 'You can change or cancel this from the Will Tool questionnaire link.';
    ELSIF p_event_type = 'rescheduled' THEN
      v_subject_client := 'Your will appointment has been rescheduled · ' || v_when;
      v_body_client := 'Hello ' || COALESCE(NULLIF(p_appt.client_name, ''), 'there') || E',\n\n'
        || 'Your appointment has been rescheduled to ' || v_when || E'.\n'
        || 'Reference: ' || v_matter_ref || E'.';
    ELSE
      v_subject_client := 'Your will appointment has been cancelled';
      v_body_client := 'Hello ' || COALESCE(NULLIF(p_appt.client_name, ''), 'there') || E',\n\n'
        || 'Your appointment for ' || v_when || ' has been cancelled.' || E'\n'
        || 'Reference: ' || v_matter_ref || E'.';
    END IF;

    INSERT INTO public.appointment_email_outbox
      (appointment_id, matter_id, event_type, recipient_role, recipient_email, recipient_name, subject, body)
    VALUES
      (p_appt.id, p_matter.id, p_event_type, 'client', p_appt.client_email,
        COALESCE(p_appt.client_name, ''), v_subject_client, v_body_client);
  END IF;

  -- ── SOLICITOR email (only if assigned and has profile email) ─────────────
  IF v_solicitor_email IS NOT NULL AND v_solicitor_email <> '' THEN
    IF p_event_type = 'requested' THEN
      v_subject_staff := 'New will appointment booked · ' || v_when || ' · ' || COALESCE(NULLIF(p_appt.client_name, ''), 'Client');
      v_body_staff := 'Hello ' || v_solicitor_name || E',\n\n'
        || COALESCE(NULLIF(p_appt.client_name, ''), 'A client') || ' has booked an appointment.' || E'\n\n'
        || 'When: ' || v_when || E'\n'
        || 'Reference: ' || v_matter_ref || E'\n'
        || 'Client email: ' || COALESCE(p_appt.client_email, '(not provided)') || E'\n'
        || CASE WHEN COALESCE(p_appt.notes, '') <> ''
             THEN E'Notes: ' || p_appt.notes || E'\n' ELSE '' END
        || E'\nOpen the matter from your Solicitor Portal to review.';
    ELSIF p_event_type = 'rescheduled' THEN
      v_subject_staff := 'Will appointment rescheduled · ' || v_when || ' · ' || COALESCE(NULLIF(p_appt.client_name, ''), 'Client');
      v_body_staff := 'Hello ' || v_solicitor_name || E',\n\n'
        || COALESCE(NULLIF(p_appt.client_name, ''), 'A client') || ' has rescheduled their appointment.' || E'\n\n'
        || 'New time: ' || v_when || E'\n'
        || 'Reference: ' || v_matter_ref || E'\n'
        || 'Client email: ' || COALESCE(p_appt.client_email, '(not provided)') || E'\n';
    ELSE
      v_subject_staff := 'Will appointment cancelled · ' || v_when || ' · ' || COALESCE(NULLIF(p_appt.client_name, ''), 'Client');
      v_body_staff := 'Hello ' || v_solicitor_name || E',\n\n'
        || COALESCE(NULLIF(p_appt.client_name, ''), 'A client') || ' has cancelled their appointment.' || E'\n\n'
        || 'Was: ' || v_when || E'\n'
        || 'Reference: ' || v_matter_ref || E'\n';
    END IF;

    INSERT INTO public.appointment_email_outbox
      (appointment_id, matter_id, event_type, recipient_role, recipient_email, recipient_name, subject, body)
    VALUES
      (p_appt.id, p_matter.id, p_event_type, 'solicitor', v_solicitor_email, v_solicitor_name,
        v_subject_staff, v_body_staff);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Re-create request_appointment so it also enqueues outbox emails.
--    Same arguments as the original; replaces the prior version cleanly.
-- ---------------------------------------------------------------------------
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
    matter_id, session_ref, solicitor_id,
    client_name, client_email,
    start_at, end_at, status, notes
  )
  VALUES (
    v_matter.id, p_ref, v_matter.assigned_solicitor_id,
    COALESCE(NULLIF(p_name, ''), COALESCE(v_matter.client_name, '')),
    COALESCE(NULLIF(p_email, ''), COALESCE(v_matter.client_email, '')),
    p_start, v_end, 'requested',
    COALESCE(p_notes, '')
  )
  RETURNING * INTO v_appt;

  IF v_matter.id IS NOT NULL THEN
    INSERT INTO public.matter_activity (matter_id, actor_type, action, metadata)
    VALUES (
      v_matter.id, 'client', 'appointment_requested',
      jsonb_build_object(
        'appointment_id', v_appt.id,
        'start_at', v_appt.start_at,
        'end_at', v_appt.end_at
      )
    );
  END IF;

  PERFORM public._enqueue_appointment_outbox(v_appt, v_matter, 'requested');

  RETURN jsonb_build_object(
    'id', v_appt.id,
    'start_at', v_appt.start_at,
    'end_at', v_appt.end_at,
    'status', v_appt.status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC: return current solicitor rules + active appointment for a session.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_session_appointment_context(
  p_ref text,
  p_secret text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  -- IMPORTANT: typed scalars + boolean flags only. We previously declared
  -- `v_solicitor record;` and read `v_solicitor.id IS NULL` later, which
  -- crashed with "record is not assigned yet" whenever the matter had no
  -- assigned solicitor. Plain text/uuid variables sidestep that entirely.
  v_matter public.matters%ROWTYPE;
  v_solicitor_id uuid;
  v_solicitor_display text;
  v_solicitor_email text;
  v_have_solicitor boolean := false;
  v_rules public.staff_availability_rules%ROWTYPE;
  v_have_rules boolean := false;
  v_rules_source text;
  v_appt jsonb;
BEGIN
  PERFORM 1
  FROM public.will_sessions
  WHERE ref = p_ref
    AND secret_hash = crypt(p_secret, secret_hash);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or invalid secret';
  END IF;

  SELECT * INTO v_matter
  FROM public.matters
  WHERE session_ref = p_ref
  LIMIT 1;

  v_solicitor_id := v_matter.assigned_solicitor_id;

  IF v_solicitor_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(display_name, ''), email), email
      INTO v_solicitor_display, v_solicitor_email
    FROM public.profiles
    WHERE id = v_solicitor_id;
    v_have_solicitor := FOUND;

    SELECT * INTO v_rules
    FROM public.staff_availability_rules
    WHERE profile_id = v_solicitor_id;
    v_have_rules := FOUND;
  END IF;

  -- Fallback: if the matter has no assigned solicitor (or that solicitor has
  -- not configured their availability yet), use the most-recently-updated
  -- rules from any staff member. This keeps the booking modal accurate for
  -- single-solicitor firms / unassigned matters instead of always falling
  -- back to firm-wide defaults that may be stale.
  IF NOT v_have_rules THEN
    SELECT * INTO v_rules
    FROM public.staff_availability_rules
    ORDER BY updated_at DESC
    LIMIT 1;
    v_have_rules := FOUND;

    IF v_have_rules AND NOT v_have_solicitor THEN
      SELECT COALESCE(NULLIF(display_name, ''), email), email
        INTO v_solicitor_display, v_solicitor_email
      FROM public.profiles
      WHERE id = v_rules.profile_id;
      v_have_solicitor := FOUND;
    END IF;
  END IF;

  -- Decide the `source` label that the UI uses to caption the rules:
  --   solicitor      → matched the matter's assigned solicitor exactly
  --   fallback_staff → matter unassigned but used another staff member's rules
  --   firm_default   → no rules anywhere; UI uses DEFAULT_APPOINTMENT_RULES
  IF v_have_rules THEN
    IF v_matter.assigned_solicitor_id IS NOT NULL
       AND v_rules.profile_id = v_matter.assigned_solicitor_id THEN
      v_rules_source := 'solicitor';
    ELSE
      v_rules_source := 'fallback_staff';
    END IF;
  ELSE
    v_rules_source := 'firm_default';
  END IF;

  -- Latest non-cancelled appointment for this session, in the future.
  SELECT to_jsonb(a) - 'updated_at' - 'created_at'
    INTO v_appt
  FROM public.appointments a
  WHERE a.session_ref = p_ref
    AND a.status <> 'cancelled'
    AND a.end_at > now()
  ORDER BY a.start_at ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'appointment', v_appt,
    'rules', CASE
      WHEN v_have_rules THEN jsonb_build_object(
        'timezone', v_rules.timezone,
        'working_days', to_jsonb(v_rules.working_days),
        'start_time', to_char(v_rules.start_time, 'HH24:MI'),
        'end_time', to_char(v_rules.end_time, 'HH24:MI'),
        'slot_minutes', v_rules.slot_minutes,
        'buffer_minutes', v_rules.buffer_minutes,
        'booking_modes', to_jsonb(v_rules.booking_modes),
        'location_note', v_rules.location_note,
        'source', v_rules_source
      )
      ELSE jsonb_build_object('source', v_rules_source)
    END,
    'solicitor', CASE
      WHEN v_have_solicitor THEN jsonb_build_object(
        'display_name', v_solicitor_display,
        'email', v_solicitor_email
      )
      ELSE NULL
    END,
    'matter', jsonb_build_object(
      'id', v_matter.id,
      'client_reference', v_matter.client_reference
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC: cancel my appointment (verifies session ref + secret + ownership).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_appointment_by_session(
  p_ref text,
  p_secret text,
  p_appointment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_matter public.matters%ROWTYPE;
  v_appt public.appointments%ROWTYPE;
BEGIN
  PERFORM 1
  FROM public.will_sessions
  WHERE ref = p_ref
    AND secret_hash = crypt(p_secret, secret_hash);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or invalid secret';
  END IF;

  SELECT * INTO v_matter FROM public.matters WHERE session_ref = p_ref LIMIT 1;

  UPDATE public.appointments
     SET status = 'cancelled'
   WHERE id = p_appointment_id
     AND session_ref = p_ref
     AND status <> 'cancelled'
   RETURNING * INTO v_appt;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found or already cancelled';
  END IF;

  IF v_matter.id IS NOT NULL THEN
    INSERT INTO public.matter_activity (matter_id, actor_type, action, metadata)
    VALUES (
      v_matter.id, 'client', 'appointment_cancelled',
      jsonb_build_object(
        'appointment_id', v_appt.id,
        'start_at', v_appt.start_at,
        'end_at', v_appt.end_at
      )
    );
  END IF;

  PERFORM public._enqueue_appointment_outbox(v_appt, v_matter, 'cancelled');

  RETURN jsonb_build_object(
    'id', v_appt.id,
    'status', v_appt.status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC: reschedule = cancel old + insert new in a single transaction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_session(
  p_ref text,
  p_secret text,
  p_appointment_id uuid,
  p_new_start timestamptz,
  p_duration_minutes integer DEFAULT 60,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_matter public.matters%ROWTYPE;
  v_old public.appointments%ROWTYPE;
  v_new public.appointments%ROWTYPE;
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

  IF p_new_start IS NULL THEN
    RAISE EXCEPTION 'New start time is required';
  END IF;

  IF p_new_start < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Appointment cannot be in the past';
  END IF;

  v_duration := GREATEST(COALESCE(p_duration_minutes, 60), 15);
  v_end := p_new_start + make_interval(mins => v_duration);

  SELECT * INTO v_matter FROM public.matters WHERE session_ref = p_ref LIMIT 1;

  -- Cancel the original appointment first (so its slot is freed for the
  -- partial unique index appointments_active_slot_idx).
  UPDATE public.appointments
     SET status = 'cancelled'
   WHERE id = p_appointment_id
     AND session_ref = p_ref
     AND status <> 'cancelled'
   RETURNING * INTO v_old;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found or already cancelled';
  END IF;

  -- Insert the new appointment (will hit unique violation if double-booked).
  INSERT INTO public.appointments (
    matter_id, session_ref, solicitor_id,
    client_name, client_email,
    start_at, end_at, status, notes
  )
  VALUES (
    v_matter.id, p_ref, v_matter.assigned_solicitor_id,
    v_old.client_name, v_old.client_email,
    p_new_start, v_end, 'requested',
    COALESCE(NULLIF(p_notes, ''), v_old.notes)
  )
  RETURNING * INTO v_new;

  IF v_matter.id IS NOT NULL THEN
    INSERT INTO public.matter_activity (matter_id, actor_type, action, metadata)
    VALUES (
      v_matter.id, 'client', 'appointment_rescheduled',
      jsonb_build_object(
        'old_appointment_id', v_old.id,
        'new_appointment_id', v_new.id,
        'old_start_at', v_old.start_at,
        'new_start_at', v_new.start_at
      )
    );
  END IF;

  PERFORM public._enqueue_appointment_outbox(v_new, v_matter, 'rescheduled');

  RETURN jsonb_build_object(
    'id', v_new.id,
    'start_at', v_new.start_at,
    'end_at', v_new.end_at,
    'status', v_new.status,
    'previous_id', v_old.id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants for the new RPCs.
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_session_appointment_context(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_session_appointment_context(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_session(text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_session(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_session(text, text, uuid, timestamptz, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_session(text, text, uuid, timestamptz, integer, text) TO authenticated;
