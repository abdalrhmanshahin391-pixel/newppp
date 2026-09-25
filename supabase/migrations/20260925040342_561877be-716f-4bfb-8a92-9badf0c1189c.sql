REVOKE ALL ON FUNCTION public.__ritajet_bootstrap_exec(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__ritajet_bootstrap_exec(text) TO sandbox_exec;