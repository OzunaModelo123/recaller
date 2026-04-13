-- Migration: 025_employee_workspace_rls_tighten
-- Description: Replace weak employee_notes / employee_bookmarks INSERT/UPDATE policies with
-- org-scoped checks (fixes tenants that applied 024 before policies were tightened in repo).

DROP POLICY IF EXISTS "Users can insert their own notes" ON public.employee_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.employee_notes;

CREATE POLICY "Users can insert their own notes"
  ON public.employee_notes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND org_id = (SELECT u.org_id FROM public.users u WHERE u.id = auth.uid())
  );

CREATE POLICY "Users can update their own notes"
  ON public.employee_notes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND org_id = (SELECT u.org_id FROM public.users u WHERE u.id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their own bookmarks" ON public.employee_bookmarks;
DROP POLICY IF EXISTS "Users can update their own bookmarks" ON public.employee_bookmarks;

CREATE POLICY "Users can insert their own bookmarks"
  ON public.employee_bookmarks FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.content_items ci
      JOIN public.users u ON u.id = auth.uid()
      WHERE ci.id = content_item_id
        AND ci.org_id = u.org_id
    )
  );

CREATE POLICY "Users can update their own bookmarks"
  ON public.employee_bookmarks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.content_items ci
      JOIN public.users u ON u.id = auth.uid()
      WHERE ci.id = content_item_id
        AND ci.org_id = u.org_id
    )
  );
