DO $$
DECLARE
  duplicate_policy_count integer;
BEGIN
  SELECT count(*) INTO duplicate_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'subjects'
    AND policyname = 'Published subject outlines are visible';

  IF duplicate_policy_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one published subject outline policy, found %', duplicate_policy_count;
  END IF;
END
$$;