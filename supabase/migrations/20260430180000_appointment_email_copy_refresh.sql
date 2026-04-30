-- Refresh appointment notification wording to a more professional legal tone.
-- Safe to run multiple times: replaces only the helper function used to enqueue
-- outbox rows. No schema changes.

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

  -- ── Client-facing email ───────────────────────────────────────────────────
  IF COALESCE(p_appt.client_email, '') <> '' THEN
    IF p_event_type = 'requested' THEN
      v_subject_client := 'Appointment request received — Aristone Solicitors';
      v_body_client := 'Thank you for your submission. We confirm receipt of your appointment request.' || E'\n\n'
        || 'Proposed appointment time: ' || v_when || E'\n'
        || 'Reference: ' || v_matter_ref || E'\n\n'
        || 'A member of our legal team will review this request and contact you if any further information is required.'
        || E'\n\nKind regards,\nAristone Solicitors';
    ELSIF p_event_type = 'rescheduled' THEN
      v_subject_client := 'Appointment updated — Aristone Solicitors';
      v_body_client := 'Your appointment has been updated successfully.' || E'\n\n'
        || 'Updated appointment time: ' || v_when || E'\n'
        || 'Reference: ' || v_matter_ref || E'\n\n'
        || 'If you require further amendments, please use your questionnaire link or contact our office.'
        || E'\n\nKind regards,\nAristone Solicitors';
    ELSE
      v_subject_client := 'Appointment cancellation confirmed — Aristone Solicitors';
      v_body_client := 'We confirm that your appointment has been cancelled.' || E'\n\n'
        || 'Cancelled appointment time: ' || v_when || E'\n'
        || 'Reference: ' || v_matter_ref || E'\n\n'
        || 'Should you wish to arrange a new appointment, please revisit your questionnaire link.'
        || E'\n\nKind regards,\nAristone Solicitors';
    END IF;

    INSERT INTO public.appointment_email_outbox
      (appointment_id, matter_id, event_type, recipient_role, recipient_email, recipient_name, subject, body)
    VALUES
      (p_appt.id, p_matter.id, p_event_type, 'client', p_appt.client_email,
        COALESCE(p_appt.client_name, ''), v_subject_client, v_body_client);
  END IF;

  -- ── Solicitor/staff-facing email ──────────────────────────────────────────
  IF v_solicitor_email IS NOT NULL AND v_solicitor_email <> '' THEN
    IF p_event_type = 'requested' THEN
      v_subject_staff := 'New appointment request — ' || COALESCE(NULLIF(p_appt.client_name, ''), 'Client');
      v_body_staff := 'A new appointment request has been submitted.' || E'\n\n'
        || 'Client: ' || COALESCE(NULLIF(p_appt.client_name, ''), '(name not provided)') || E'\n'
        || 'Client email: ' || COALESCE(p_appt.client_email, '(not provided)') || E'\n'
        || 'Requested time: ' || v_when || E'\n'
        || 'Reference: ' || v_matter_ref || E'\n'
        || CASE WHEN COALESCE(p_appt.notes, '') <> '' THEN E'Client notes: ' || p_appt.notes || E'\n' ELSE '' END
        || E'\nPlease review the matter in the Solicitor Portal.';
    ELSIF p_event_type = 'rescheduled' THEN
      v_subject_staff := 'Appointment rescheduled — ' || COALESCE(NULLIF(p_appt.client_name, ''), 'Client');
      v_body_staff := 'An existing appointment has been rescheduled.' || E'\n\n'
        || 'Client: ' || COALESCE(NULLIF(p_appt.client_name, ''), '(name not provided)') || E'\n'
        || 'Client email: ' || COALESCE(p_appt.client_email, '(not provided)') || E'\n'
        || 'Updated time: ' || v_when || E'\n'
        || 'Reference: ' || v_matter_ref || E'\n\n'
        || 'Please review the matter in the Solicitor Portal.';
    ELSE
      v_subject_staff := 'Appointment cancelled — ' || COALESCE(NULLIF(p_appt.client_name, ''), 'Client');
      v_body_staff := 'An appointment has been cancelled.' || E'\n\n'
        || 'Client: ' || COALESCE(NULLIF(p_appt.client_name, ''), '(name not provided)') || E'\n'
        || 'Client email: ' || COALESCE(p_appt.client_email, '(not provided)') || E'\n'
        || 'Cancelled time: ' || v_when || E'\n'
        || 'Reference: ' || v_matter_ref || E'\n\n'
        || 'Please review the matter in the Solicitor Portal.';
    END IF;

    INSERT INTO public.appointment_email_outbox
      (appointment_id, matter_id, event_type, recipient_role, recipient_email, recipient_name, subject, body)
    VALUES
      (p_appt.id, p_matter.id, p_event_type, 'solicitor', v_solicitor_email, v_solicitor_name,
        v_subject_staff, v_body_staff);
  END IF;
END;
$$;

