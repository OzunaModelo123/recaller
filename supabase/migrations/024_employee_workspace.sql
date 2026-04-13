-- Migration: 024_employee_workspace
-- Description: Creates the employee_notes and employee_bookmarks tables for Phase 15.

--------------------------------------------------------------------------------
-- 1. Table: employee_notes
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  content_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled Document',
  content_json jsonb,
  content_html text,
  tags jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_notes_user_org ON public.employee_notes(user_id, org_id);

--------------------------------------------------------------------------------
-- 2. Table: employee_bookmarks
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  timestamp_seconds integer,
  highlight_text text,
  note_text text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_bookmarks_user_item ON public.employee_bookmarks(user_id, content_item_id);

--------------------------------------------------------------------------------
-- 3. Row Level Security (RLS)
--------------------------------------------------------------------------------

ALTER TABLE public.employee_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_bookmarks ENABLE ROW LEVEL SECURITY;

-- employee_notes
CREATE POLICY "Users can select their own notes"
  ON public.employee_notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

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

CREATE POLICY "Users can delete their own notes"
  ON public.employee_notes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- employee_bookmarks
CREATE POLICY "Users can select their own bookmarks"
  ON public.employee_bookmarks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

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

CREATE POLICY "Users can delete their own bookmarks"
  ON public.employee_bookmarks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
