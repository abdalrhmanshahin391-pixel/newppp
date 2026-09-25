DO $mig$
DECLARE body text; st int; parts text[]; c text; hdr text;
BEGIN
  SELECT status, content INTO st, body FROM extensions.http_get('https://id-preview--05a7273e-65b6-403e-8cb6-c887d70948df.lovable.app/__l5e/assets-v1/78443dad-504a-4767-9941-99a7f6171779/segd3.txt');
  IF st <> 200 THEN RAISE EXCEPTION 'fetch failed %', st; END IF;
  parts := string_to_array(body, E'\n--@@SPLIT@@\n');
  FOREACH c IN ARRAY parts LOOP
    hdr := split_part(c, E'\n', 1);
    BEGIN
      EXECUTE c;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._mig_log(chunk, err) VALUES (hdr, SQLERRM);
    END;
  END LOOP;
END
$mig$;