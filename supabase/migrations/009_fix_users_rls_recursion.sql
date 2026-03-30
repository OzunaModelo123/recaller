-- RLS on public.users referenced itself: users_select_same_org used
-- (select org_id from users where id = auth.uid()), which re-entered the same policy.
-- SECURITY DEFINER reads org_id without applying RLS to that inner query.

CREATE OR REPLACE FUNCTION public.auth_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.org_id
  FROM public.users u
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.auth_user_org_id() IS
  'Caller org_id from public.users; SECURITY DEFINER avoids infinite RLS recursion.';

REVOKE ALL ON FUNCTION public.auth_user_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_org_id() TO service_role;

DROP POLICY IF EXISTS "users_select_same_org" ON public.users;

CREATE POLICY "users_select_same_org"
  ON public.users
  FOR SELECT
  USING (org_id = (SELECT public.auth_user_org_id()));
