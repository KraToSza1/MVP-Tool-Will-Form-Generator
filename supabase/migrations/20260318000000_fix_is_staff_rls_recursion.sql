-- Fix PostgreSQL error 54001 "stack depth limit exceeded" on SELECT matters / profiles.
--
-- Cause: matters RLS calls is_staff() -> current_user_role() SELECTs profiles ->
-- profiles RLS evaluates (id = auth.uid() OR is_staff()) -> is_staff() again -> infinite recursion.
--
-- Fix: Read role via SECURITY DEFINER functions so profile lookup bypasses RLS (breaks the cycle).

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('solicitor', 'admin')
  );
$$;

COMMENT ON FUNCTION public.is_staff() IS 'Staff check; SECURITY DEFINER avoids RLS recursion with profiles policies.';
