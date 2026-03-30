-- Signup must insert into organisations before public.users exists. RLS on INSERT
-- can still block depending on policy/JWT context. This SECURITY DEFINER RPC runs
-- as the function owner (bypasses RLS) but only when auth.uid() is set.

CREATE OR REPLACE FUNCTION public.create_organisation_for_signup(org_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  trimmed text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  trimmed := btrim(coalesce(org_name, ''));
  IF trimmed = '' THEN
    trimmed := 'New Organization';
  END IF;
  IF length(trimmed) > 200 THEN
    RAISE EXCEPTION 'organisation name too long';
  END IF;

  INSERT INTO public.organisations (name)
  VALUES (trimmed)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

COMMENT ON FUNCTION public.create_organisation_for_signup(text) IS
  'Creates one organisation row during signup; callable only with a valid JWT (auth.uid()).';

REVOKE ALL ON FUNCTION public.create_organisation_for_signup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organisation_for_signup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organisation_for_signup(text) TO service_role;
