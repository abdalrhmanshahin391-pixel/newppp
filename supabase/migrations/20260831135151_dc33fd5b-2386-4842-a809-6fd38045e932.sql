DO $mig$
DECLARE body text; st int; parts text[]; c text; hdr text;
BEGIN
  SELECT status, content INTO st, body FROM extensions.http_get('https://id-preview--05a7273e-65b6-403e-8cb6-c887d70948df.lovable.app/__l5e/assets-v1/ce7269c8-62cd-42a6-883d-257462a6f723/segd4.txt');
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