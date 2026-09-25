CREATE OR REPLACE FUNCTION public.__setup_exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
REVOKE ALL ON FUNCTION public.__setup_exec(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__setup_exec(text) TO sandbox_exec;