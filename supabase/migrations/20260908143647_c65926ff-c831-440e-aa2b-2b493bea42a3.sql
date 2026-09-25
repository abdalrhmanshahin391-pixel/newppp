GRANT ALL ON SCHEMA public TO sandbox_exec;
GRANT ALL ON ALL TABLES IN SCHEMA public TO sandbox_exec;
ALTER ROLE sandbox_exec SET search_path = public;