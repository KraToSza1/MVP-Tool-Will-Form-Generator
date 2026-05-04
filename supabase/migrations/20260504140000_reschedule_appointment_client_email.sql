-- Reschedule: optional client email so confirmations match the booking modal.
-- Previously the new row always copied v_old.client_email (demo matters bounced via Graph).

DROP FUNCTION IF EXISTS public.reschedule_appointment_by_session(text, text, uuid, timestamptz, integer, text);

CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_session(
  p_ref text,
  p_secret text,
  p_appointment_id uuid,
  p_new_start timestamptz,
  p_duration_minutes integer DEFAULT 60,
  p_notes text DEFAULT NULL,
  p_client_email text DEFAULT NULL
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
  v_client_email text;
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

  UPDATE public.appointments
     SET status = 'cancelled'
   WHERE id = p_appointment_id
     AND session_ref = p_ref
     AND status <> 'cancelled'
   RETURNING * INTO v_old;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found or already cancelled';
  END IF;

  v_client_email := COALESCE(NULLIF(trim(p_client_email), ''), v_old.client_email);

  IF NULLIF(trim(p_client_email), '') IS NOT NULL AND v_matter.id IS NOT NULL THEN
    UPDATE public.matters
       SET client_email = trim(p_client_email)
     WHERE id = v_matter.id;
  END IF;

  INSERT INTO public.appointments (
    matter_id, session_ref, solicitor_id,
    client_name, client_email,
    start_at, end_at, status, notes
  )
  VALUES (
    v_matter.id, p_ref, v_matter.assigned_solicitor_id,
    v_old.client_name, v_client_email,
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

GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_session(text, text, uuid, timestamptz, integer, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_session(text, text, uuid, timestamptz, integer, text, text) TO authenticated;
