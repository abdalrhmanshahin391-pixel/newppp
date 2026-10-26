-- Lovable Cloud uses the authenticated request context for server functions.
-- The exercise editor is already guarded in TypeScript with assertAdmin(); this
-- policy supplies the matching database guarantee without requiring a separate
-- service-role secret in the Lovable project settings.
--
-- Learners still receive no policy for this table, so answer keys cannot be
-- queried from the browser.

drop policy if exists "admins manage lesson contents" on public.rita_lesson_contents;
create policy "admins manage lesson contents" on public.rita_lesson_contents
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant insert, update, delete on public.rita_lesson_contents to authenticated;
