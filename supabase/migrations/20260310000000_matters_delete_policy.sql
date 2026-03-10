-- Allow staff to delete matters (e.g. remove test or obsolete matters).
-- matter_activity rows are removed by FK CASCADE when a matter is deleted.

DROP POLICY IF EXISTS "Staff can delete matters" ON public.matters;
CREATE POLICY "Staff can delete matters" ON public.matters
  FOR DELETE TO authenticated
  USING (public.is_staff());
