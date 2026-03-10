-- Optional reminder/due date per matter for solicitor workflow
-- Run this in Supabase: SQL Editor → New query → paste and run.
-- After this, add reminder_date back to STAFF_MATTER_COLUMNS in src/lib/matters.js so the app can read/write it.

ALTER TABLE public.matters
  ADD COLUMN IF NOT EXISTS reminder_date timestamptz;

COMMENT ON COLUMN public.matters.reminder_date IS 'Optional reminder or due date for the matter (solicitor-set).';
