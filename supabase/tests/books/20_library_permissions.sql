-- Entire fixture rolls back. These checks run against real RLS under each database role.
begin;
insert into public.book_categories(id,name_ar,name_en,color,icon) values
 ('10000000-0000-4000-8000-000000000001','اختبار','Test','sky','book');
insert into public.books(id,title,published,featured,file_path,category_id) values
 ('20000000-0000-4000-8000-000000000001','Published',true,true,'public.pdf','10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','Draft',false,false,'draft.pdf','10000000-0000-4000-8000-000000000001');
insert into storage.objects(bucket_id,name) values
 ('book-files','public.pdf'),('book-files','draft.pdf'),('book-files','orphan.pdf');

set local role anon;
do $$
declare changed integer;
begin
  if (select count(*) from public.book_categories) <> 1 then raise exception 'Anon cannot read categories'; end if;
  if (select count(*) from public.books) <> 1 then raise exception 'Anon must see only published books'; end if;
  if exists(select 1 from public.books where not published) then raise exception 'Draft leaked to anon'; end if;
  if exists(select 1 from storage.objects) then raise exception 'Private PDF leaked to anon'; end if;
  begin
    insert into public.books(title,published) values ('Forbidden',true);
    raise exception 'Anon INSERT books allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.book_categories(name_ar,name_en) values ('ممنوع','Forbidden');
    raise exception 'Anon INSERT categories allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values ('book-covers','forbidden.jpg');
    raise exception 'Anon upload allowed';
  exception when insufficient_privilege then null; end;
  update public.books set title='Forbidden'; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Anon UPDATE books allowed'; end if;
  delete from public.books; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Anon DELETE books allowed'; end if;
  update public.book_categories set name_en='Forbidden'; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Anon UPDATE categories allowed'; end if;
  delete from public.book_categories; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Anon DELETE categories allowed'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000b1',true);
set local role authenticated;
do $$
declare changed integer;
begin
  if (select count(*) from public.books) <> 1 then raise exception 'Reader must see only published books'; end if;
  if (select count(*) from public.book_categories) <> 1 then raise exception 'Reader cannot see categories'; end if;
  if (select count(*) from storage.objects) <> 1 then raise exception 'Reader PDF access is not limited to a published referenced file'; end if;
  if exists(select 1 from storage.objects where name <> 'public.pdf') then raise exception 'Draft/orphan PDF leaked'; end if;
  begin
    insert into public.books(title,published) values ('Forbidden',true);
    raise exception 'Reader INSERT books allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.book_categories(name_ar,name_en) values ('ممنوع','Forbidden');
    raise exception 'Reader INSERT categories allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values ('book-files','forbidden.pdf');
    raise exception 'Reader upload allowed';
  exception when insufficient_privilege then null; end;
  update public.books set title='Forbidden'; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Reader UPDATE books allowed'; end if;
  delete from public.books; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Reader DELETE books allowed'; end if;
  update public.book_categories set name_en='Forbidden'; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Reader UPDATE categories allowed'; end if;
  delete from public.book_categories; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Reader DELETE categories allowed'; end if;
  update storage.objects set name='forbidden.pdf'; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Reader UPDATE storage allowed'; end if;
  delete from storage.objects; get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Reader DELETE storage allowed'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000a1',true);
set local role authenticated;
do $$
declare changed integer;
begin
  if (select count(*) from public.books) <> 2 then raise exception 'Admin lost draft access'; end if;
  if (select count(*) from storage.objects) <> 3 then raise exception 'Admin lost file management'; end if;
  insert into public.book_categories(id,name_ar,name_en) values
    ('10000000-0000-4000-8000-000000000002','إدارة','Admin');
  update public.book_categories set name_en='Admin updated' where id='10000000-0000-4000-8000-000000000002';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Admin UPDATE categories denied'; end if;
  delete from public.book_categories where id='10000000-0000-4000-8000-000000000002';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Admin DELETE categories denied'; end if;
  insert into public.books(id,title) values ('20000000-0000-4000-8000-000000000003','Admin draft');
  update public.books set title='Admin updated' where id='20000000-0000-4000-8000-000000000003';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Admin UPDATE books denied'; end if;
  delete from public.books where id='20000000-0000-4000-8000-000000000003';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Admin DELETE books denied'; end if;
  insert into storage.objects(bucket_id,name) values ('book-files','admin.pdf');
  update storage.objects set name='admin-new.pdf' where name='admin.pdf';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Admin UPDATE storage denied'; end if;
  delete from storage.objects where name='admin-new.pdf';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Admin DELETE storage denied'; end if;
  begin
    update public.books set featured=true where id='20000000-0000-4000-8000-000000000002';
    raise exception 'Two featured books were allowed';
  exception when unique_violation then null; end;
  update public.books set featured=false where featured;
  update public.books set featured=true where id='20000000-0000-4000-8000-000000000002';
  if (select count(*) from public.books where featured) <> 1 then raise exception 'Featured replacement failed'; end if;
end $$;
reset role;

do $$
begin
  if has_function_privilege('anon','public.has_role(uuid,public.app_role)','execute') then
    raise exception 'Fix must not grant anon access to has_role';
  end if;
  if (select public from storage.buckets where id='book-files') then raise exception 'PDF bucket must stay private'; end if;
  if not (select public from storage.buckets where id='book-covers') then raise exception 'Covers must stay public'; end if;
end $$;
rollback;
select 'PASS: anonymous/reader/admin RLS, private PDFs, featured uniqueness, unchanged function grants' as result;
