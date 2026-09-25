REVOKE EXECUTE ON FUNCTION public.ensure_lq_default_bucket() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_lq_default_bucket() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_usage(uuid, text, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.vault_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_tables() TO service_role;