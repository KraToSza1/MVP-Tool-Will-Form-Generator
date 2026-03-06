-- Questionnaire (form) definition storage so solicitors can edit questions/labels.

CREATE TABLE IF NOT EXISTS public.form_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'default' UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_form_definitions_name ON public.form_definitions (name);

ALTER TABLE public.form_definitions ENABLE ROW LEVEL SECURITY;

-- Everyone (including anon) can read the active questionnaire so the intake form uses it.
DROP POLICY IF EXISTS "Anyone can read form definitions" ON public.form_definitions;
CREATE POLICY "Anyone can read form definitions" ON public.form_definitions
  FOR SELECT TO anon, authenticated
  USING (true);

-- Only staff can insert/update so only solicitors can edit the questionnaire.
DROP POLICY IF EXISTS "Staff can manage form definitions" ON public.form_definitions;
CREATE POLICY "Staff can manage form definitions" ON public.form_definitions
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
