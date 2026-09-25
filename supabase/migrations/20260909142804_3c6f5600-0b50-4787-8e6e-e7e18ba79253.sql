REVOKE ALL ON FUNCTION public.identity_taken(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.identity_taken(text, text) TO service_role;