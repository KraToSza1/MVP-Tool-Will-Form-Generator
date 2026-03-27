-- Factory default snapshot + revision history for questionnaire (form_definitions) edits.

CREATE TABLE IF NOT EXISTS public.form_definition_defaults (
  id text PRIMARY KEY DEFAULT 'factory',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.form_definition_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'save',
  CONSTRAINT form_definition_revisions_source_check CHECK (source IN ('save', 'restore', 'admin_seed')),
  payload jsonb NOT NULL,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_form_definition_revisions_created_at
  ON public.form_definition_revisions (created_at DESC);

ALTER TABLE public.form_definition_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_definition_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read form definition defaults" ON public.form_definition_defaults;
CREATE POLICY "Staff can read form definition defaults" ON public.form_definition_defaults
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can manage form definition defaults" ON public.form_definition_defaults;
CREATE POLICY "Staff can manage form definition defaults" ON public.form_definition_defaults
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can read form definition revisions" ON public.form_definition_revisions;
CREATE POLICY "Staff can read form definition revisions" ON public.form_definition_revisions
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can insert form definition revisions" ON public.form_definition_revisions;
CREATE POLICY "Staff can insert form definition revisions" ON public.form_definition_revisions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can delete form definition revisions" ON public.form_definition_revisions;
CREATE POLICY "Staff can delete form definition revisions" ON public.form_definition_revisions
  FOR DELETE TO authenticated
  USING (public.is_staff());

-- Keep at most 50 revision rows (delete oldest after each insert).
CREATE OR REPLACE FUNCTION public.trim_form_definition_revisions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.form_definition_revisions
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
      FROM public.form_definition_revisions
    ) t
    WHERE t.rn > 50
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trim_form_definition_revisions ON public.form_definition_revisions;
CREATE TRIGGER trim_form_definition_revisions
  AFTER INSERT ON public.form_definition_revisions
  FOR EACH ROW EXECUTE PROCEDURE public.trim_form_definition_revisions();

COMMENT ON TABLE public.form_definition_defaults IS 'Server-side factory questionnaire JSON; staff-only; used for Reset to default.';
COMMENT ON TABLE public.form_definition_revisions IS 'Append-only history of published questionnaire payloads; capped at 50 rows.';
