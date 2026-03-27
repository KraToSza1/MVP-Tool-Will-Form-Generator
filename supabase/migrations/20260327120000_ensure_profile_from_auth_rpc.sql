-- If a user exists in auth.users but has no row in public.profiles (missed trigger / old signup),
-- they can still sign in but the app cannot load staff profile. This RPC upserts from auth.users
-- for the current session user. SECURITY DEFINER bypasses RLS for the insert only.
-- Keep public sign-up disabled in Supabase Auth settings so only invited users reach this path.

CREATE OR REPLACE FUNCTION public.ensure_profile_from_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'display_name', split_part(COALESCE(u.email, ''), '@', 1)),
    'solicitor'::text
  FROM auth.users u
  WHERE u.id = auth.uid()
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_profile_from_auth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_profile_from_auth() TO authenticated;

COMMENT ON FUNCTION public.ensure_profile_from_auth() IS 'Upsert public.profiles from auth.users for auth.uid(); call after login if profile row missing.';
