REVOKE ALL ON FUNCTION public.identity_taken(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.identity_taken(text, text) TO anon, authenticated, service_role;