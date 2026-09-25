CREATE OR REPLACE FUNCTION public.__setup_exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
BEGIN
  EXECUTE sql;
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.__setup_exec(text) TO sandbox_exec';
END;
$fn$;
REVOKE ALL ON FUNCTION public.__setup_exec(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__setup_exec(text) TO sandbox_exec;