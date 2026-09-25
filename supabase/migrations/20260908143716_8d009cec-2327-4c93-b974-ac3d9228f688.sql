GRANT USAGE ON SCHEMA auth TO sandbox_exec;
GRANT REFERENCES, SELECT ON auth.users TO sandbox_exec;
GRANT USAGE ON SCHEMA extensions TO sandbox_exec;
GRANT USAGE ON SCHEMA storage TO sandbox_exec;
GRANT ALL ON storage.objects TO sandbox_exec;
GRANT ALL ON storage.buckets TO sandbox_exec;