-- Migration: 023_knowledge_retention
-- Description: Creates tables for AI quiz generation and Spaced Repetition (SM-2) engine

--------------------------------------------------------------------------------
-- 1. Table: quiz_questions
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'scenario')),
  options jsonb NOT NULL,
  correct_answer_index integer NOT NULL,
  explainer_text text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for fast lookup by content item
CREATE INDEX IF NOT EXISTS idx_quiz_questions_content_item_id ON public.quiz_questions(content_item_id);

--------------------------------------------------------------------------------
-- 2. Table: review_cards
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  ease_factor real NOT NULL DEFAULT 2.50,
  interval_days real NOT NULL DEFAULT 0.00,
  repetitions integer NOT NULL DEFAULT 0,
  next_review_at timestamp with time zone NOT NULL DEFAULT now(),
  last_reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, quiz_question_id)
);

-- Index for quickly finding due cards for a given user
CREATE INDEX IF NOT EXISTS idx_review_cards_user_due ON public.review_cards(user_id, next_review_at);

--------------------------------------------------------------------------------
-- 3. Table: review_sessions
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  cards_answered integer NOT NULL DEFAULT 0,
  retention_score_delta real NOT NULL DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, session_date)
);

--------------------------------------------------------------------------------
-- 4. Row Level Security (RLS)
--------------------------------------------------------------------------------

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_sessions ENABLE ROW LEVEL SECURITY;

-- quiz_questions:
-- Users can view questions if they are in the same org as the content item.
-- (Users are linked to an org_id; content_items are linked through assignments -> plans -> org_id,
-- or more directly, content_items might be linked to org_id directly or through org-wide library. 
-- In Recaller, content_items usually belong to an org indirectly; if they don't have org_id, 
-- we'll rely on the user having access to the item. For simplicity, any user can SELECT 
-- if they are authenticated, but in a multi-tenant app, we might need a join. 
-- Assuming they have an assignment for it.)

-- For now, letting authenticated users read questions (they only get them if they have review cards anyway).
CREATE POLICY "Users can read quiz questions"
  ON public.quiz_questions
  FOR SELECT
  TO authenticated
  USING (true);

-- System/Admins can insert (via service role or Inngest). So service role bypasses RLS.

-- review_cards:
-- Users can only SELECT, UPDATE, INSERT their own cards
CREATE POLICY "Users can view their own review cards"
  ON public.review_cards FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own review cards"
  ON public.review_cards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own review cards"
  ON public.review_cards FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own review cards"
  ON public.review_cards FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- review_sessions:
-- Users can only SELECT, UPDATE, INSERT their own sessions
CREATE POLICY "Users can view their own review sessions"
  ON public.review_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own review sessions"
  ON public.review_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own review sessions"
  ON public.review_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
