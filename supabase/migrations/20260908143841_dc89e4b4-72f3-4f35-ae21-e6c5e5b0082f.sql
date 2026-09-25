CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER FUNCTION public.__setup_exec(text) SET search_path = public, extensions;