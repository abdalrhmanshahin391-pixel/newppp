DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'subjects'
    AND policyname = 'Published subject outlines are visible';
  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Question-bank outline rule verification failed';
  END IF;
END
$$;