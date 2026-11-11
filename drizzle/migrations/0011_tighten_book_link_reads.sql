DROP POLICY IF EXISTS "shelf items are readable" ON public.book_shelf_items;
CREATE POLICY "shelf items are readable" ON public.book_shelf_items FOR SELECT TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM public.book_shelves s WHERE s.id = book_shelf_items.shelf_id AND s.visible)
  AND EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_shelf_items.book_id AND b.status = 'published')
);
DROP POLICY IF EXISTS "book tag links are readable" ON public.book_tag_links;
CREATE POLICY "book tag links are readable" ON public.book_tag_links FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_tag_links.book_id AND b.status = 'published'));
DROP POLICY IF EXISTS "secondary categories are readable" ON public.book_secondary_categories;
CREATE POLICY "secondary categories are readable" ON public.book_secondary_categories FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_secondary_categories.book_id AND b.status = 'published'));