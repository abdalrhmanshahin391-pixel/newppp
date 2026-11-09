-- has_role is executable by authenticated users, not anon. The original shared SELECT policy
-- called it for visitors too, so /books failed with 42501 even when the library was empty.
-- Visitors and ordinary users read published metadata. The separate permissive ALL policy
-- "admins manage books" still lets authenticated admins read drafts and manage the library.
-- No function grants, write policies, storage policies or existing migration files change.
alter policy "published books are readable" on public.books using (published);
