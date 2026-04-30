-- Cap work inside submit_will_matter so a stuck query fails fast instead of hanging the API gateway.
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
SET search_path = public, extensions
AS $$
DECLARE
  v_matter_id uuid;
BEGIN
  SET LOCAL statement_timeout = '60000';
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
