DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.__setup_exec(text);
REVOKE ALL ON SCHEMA public FROM sandbox_exec;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM sandbox_exec;
REVOKE ALL ON storage.objects FROM sandbox_exec;
REVOKE ALL ON storage.buckets FROM sandbox_exec;
GRANT USAGE ON SCHEMA public TO sandbox_exec;