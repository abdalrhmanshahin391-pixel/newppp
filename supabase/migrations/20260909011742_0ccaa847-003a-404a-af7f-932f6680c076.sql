DROP POLICY IF EXISTS "events insert" ON public.announcement_events;

CREATE POLICY "Anonymous visitors can record anonymous events"
ON public.announcement_events
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

CREATE POLICY "Members can record their own events"
ON public.announcement_events
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());