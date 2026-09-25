REVOKE ALL ON FUNCTION public.effective_plan_slug(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan_slug(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.effective_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan(uuid) TO service_role;