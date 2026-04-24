-- Staff calendar connection metadata and availability settings.
-- This does not store Microsoft provider/access/refresh tokens.
-- Calendar access is performed with the current signed-in user's Supabase OAuth provider token.

CREATE TABLE IF NOT EXISTS public.staff_calendar_connections (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'microsoft' CHECK (provider IN ('microsoft')),
  tenant_id text,
  provider_user_id text,
  calendar_email text,
  display_name text NOT NULL DEFAULT '',
  scopes text[] NOT NULL DEFAULT '{}',
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS staff_calendar_connections_updated_at ON public.staff_calendar_connections;
CREATE TRIGGER staff_calendar_connections_updated_at
  BEFORE UPDATE ON public.staff_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_staff_calendar_connections_calendar_email
  ON public.staff_calendar_connections (lower(calendar_email));

CREATE TABLE IF NOT EXISTS public.staff_availability_rules (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Africa/Johannesburg',
  working_days text[] NOT NULL DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  slot_minutes integer NOT NULL DEFAULT 60 CHECK (slot_minutes IN (15, 30, 45, 60, 90, 120)),
  buffer_minutes integer NOT NULL DEFAULT 15 CHECK (buffer_minutes IN (0, 10, 15, 30, 45, 60)),
  booking_modes text[] NOT NULL DEFAULT ARRAY['in_person', 'video'],
  location_note text NOT NULL DEFAULT 'Aristone Solicitors',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS staff_availability_rules_updated_at ON public.staff_availability_rules;
CREATE TRIGGER staff_availability_rules_updated_at
  BEFORE UPDATE ON public.staff_availability_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.staff_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_availability_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read calendar connections" ON public.staff_calendar_connections;
CREATE POLICY "Staff can read calendar connections" ON public.staff_calendar_connections
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can upsert own calendar connection" ON public.staff_calendar_connections;
CREATE POLICY "Staff can upsert own calendar connection" ON public.staff_calendar_connections
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND public.is_staff());

DROP POLICY IF EXISTS "Staff can update own calendar connection" ON public.staff_calendar_connections;
CREATE POLICY "Staff can update own calendar connection" ON public.staff_calendar_connections
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND public.is_staff())
  WITH CHECK (profile_id = auth.uid() AND public.is_staff());

DROP POLICY IF EXISTS "Staff can read availability rules" ON public.staff_availability_rules;
CREATE POLICY "Staff can read availability rules" ON public.staff_availability_rules
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can insert own availability rules" ON public.staff_availability_rules;
CREATE POLICY "Staff can insert own availability rules" ON public.staff_availability_rules
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND public.is_staff());

DROP POLICY IF EXISTS "Staff can update own availability rules" ON public.staff_availability_rules;
CREATE POLICY "Staff can update own availability rules" ON public.staff_availability_rules
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND public.is_staff())
  WITH CHECK (profile_id = auth.uid() AND public.is_staff());
