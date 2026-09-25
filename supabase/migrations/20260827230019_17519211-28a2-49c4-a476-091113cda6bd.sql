CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE OR REPLACE FUNCTION public.__setup_exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  BEGIN
    SET LOCAL safeupdate.enabled = 'false';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  EXECUTE sql;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.__setup_exec(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__setup_exec(text) TO service_role;