#!/usr/bin/env bash
# Isolated CI Postgres only. These are metadata/RLS transaction races, not live uploads.
set -euo pipefail
cd "$(dirname "$0")/.."
case "${PGHOST:-localhost}" in localhost|127.0.0.1|::1) ;; *) echo "Use local test Postgres only" >&2; exit 1;; esac
DB="${1:-books_test}"
case "$DB" in books_test|books_*_test) ;; *) echo "Use an isolated books test database" >&2; exit 1;; esac
scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
run() { psql -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -q -X -d "$DB" "$@"; }
run <<'SQL'
grant select, insert, update, delete on storage.objects to authenticated;
create unique index if not exists test_storage_bucket_name on storage.objects(bucket_id,name);
insert into auth.users values
 ('a9100000-0000-4000-8000-000000000001'),
 ('a9100000-0000-4000-8000-000000000002'),
 ('a9100000-0000-4000-8000-000000000003'),
 ('a9100000-0000-4000-8000-000000000004');
SQL

# The first session announces that it holds the relevant lock before the second
# starts. Its sleep only keeps the transaction open; assertions decide success.
race() {
 local label="$1" expected="$2"
 run -f "$scratch/a.sql" >"$scratch/a.log" 2>&1 &
 local first_pid=$!
 local seen=0
 for _ in $(seq 1 100); do
  if grep -q '^LOCK_HELD$' "$scratch/a.log"; then seen=1; break; fi
  if ! kill -0 "$first_pid" 2>/dev/null; then break; fi
  sleep 0.05
 done
 if [ "$seen" -ne 1 ]; then cat "$scratch/a.log"; wait "$first_pid" || true; echo "$label: first session failed" >&2; exit 1; fi
 local second_status=0 first_status=0
 run -f "$scratch/b.sql" >"$scratch/b.log" 2>&1 || second_status=$?
 wait "$first_pid" || first_status=$?
 cat "$scratch/a.log" "$scratch/b.log"
 if [ "$first_status" -ne 0 ] || [ "$second_status" -eq 0 ] || ! grep -q "$expected" "$scratch/b.log"; then
  echo "$label: expected the first commit and the second refusal ($expected)" >&2; exit 1
 fi
 echo "ok - $label"
}

cat >"$scratch/a.sql" <<'SQL'
begin;
set local role authenticated;
set local request.jwt.claim.sub='a9100000-0000-4000-8000-000000000001';
insert into public.user_books(id,slot,title,size_bytes,file_path) values
 ('b9100000-0000-4000-8000-000000000001',1,'slot race A',1,'a9100000-0000-4000-8000-000000000001/b9100000-0000-4000-8000-000000000001/book.pdf');
\echo LOCK_HELD
select pg_sleep(2);
commit;
SQL
cat >"$scratch/b.sql" <<'SQL'
begin;
set local role authenticated;
set local request.jwt.claim.sub='a9100000-0000-4000-8000-000000000001';
insert into public.user_books(id,slot,title,size_bytes,file_path) values
 ('b9100000-0000-4000-8000-000000000002',1,'slot race B',1,'a9100000-0000-4000-8000-000000000001/b9100000-0000-4000-8000-000000000002/book.pdf');
commit;
SQL
race 'concurrent same-slot additions leave one book' '23505'
run <<'SQL'
do $$ begin
 if (select count(*) from public.user_books where user_id='a9100000-0000-4000-8000-000000000001') <> 1
 or (select count(*) from public.user_book_adds where user_id='a9100000-0000-4000-8000-000000000001') <> 1 then
  raise exception 'same-slot race count mismatch';
 end if;
end $$;
insert into public.user_book_adds(user_id) select 'a9100000-0000-4000-8000-000000000002'::uuid from generate_series(1,9);
SQL
sed 's/a9100000-0000-4000-8000-000000000001/a9100000-0000-4000-8000-000000000002/g;s/b9100000-0000-4000-8000-000000000001/b9100000-0000-4000-8000-000000000003/g' "$scratch/a.sql" >"$scratch/daily-a.sql"
sed 's/a9100000-0000-4000-8000-000000000001/a9100000-0000-4000-8000-000000000002/g;s/b9100000-0000-4000-8000-000000000002/b9100000-0000-4000-8000-000000000004/g;s/,1,/,2,/' "$scratch/b.sql" >"$scratch/daily-b.sql"
cp "$scratch/daily-a.sql" "$scratch/a.sql"
cp "$scratch/daily-b.sql" "$scratch/b.sql"
race 'parallel tenth and eleventh adds do not exceed ten' 'P0001'
run <<'SQL'
do $$ begin
 if (select count(*) from public.user_book_adds where user_id='a9100000-0000-4000-8000-000000000002') <> 10
 or (select count(*) from public.user_books where user_id='a9100000-0000-4000-8000-000000000002') <> 1 then
  raise exception 'daily race count mismatch';
 end if;
end $$;
select test_as('a9100000-0000-4000-8000-000000000003', $$insert into public.user_books(id,slot,title,size_bytes,file_path) values
 ('b9100000-0000-4000-8000-000000000005',1,'upload wins',1,'a9100000-0000-4000-8000-000000000003/b9100000-0000-4000-8000-000000000005/book.pdf')$$);
select test_as('a9100000-0000-4000-8000-000000000004', $$insert into public.user_books(id,slot,title,size_bytes,file_path) values
 ('b9100000-0000-4000-8000-000000000006',1,'delete wins',1,'a9100000-0000-4000-8000-000000000004/b9100000-0000-4000-8000-000000000006/book.pdf')$$);
SQL
cat >"$scratch/a.sql" <<'SQL'
begin;
set local role authenticated;
set local request.jwt.claim.sub='a9100000-0000-4000-8000-000000000003';
insert into storage.objects(bucket_id,name) values('user-books','a9100000-0000-4000-8000-000000000003/b9100000-0000-4000-8000-000000000005/book.pdf');
\echo LOCK_HELD
select pg_sleep(2);
commit;
SQL
cat >"$scratch/b.sql" <<'SQL'
begin;
set local role authenticated;
set local request.jwt.claim.sub='a9100000-0000-4000-8000-000000000003';
delete from public.user_books where id='b9100000-0000-4000-8000-000000000005';
commit;
SQL
race 'upload first keeps its book reservation through concurrent deletion' '23503'
run <<'SQL'
do $$ begin
 if not exists(select 1 from public.user_books where id='b9100000-0000-4000-8000-000000000005')
 or not exists(select 1 from storage.objects where bucket_id='user-books' and name='a9100000-0000-4000-8000-000000000003/b9100000-0000-4000-8000-000000000005/book.pdf') then
  raise exception 'upload-first race lost its reservation';
 end if;
end $$;
SQL
cat >"$scratch/a.sql" <<'SQL'
begin;
set local role authenticated;
set local request.jwt.claim.sub='a9100000-0000-4000-8000-000000000004';
delete from public.user_books where id='b9100000-0000-4000-8000-000000000006';
\echo LOCK_HELD
select pg_sleep(2);
commit;
SQL
cat >"$scratch/b.sql" <<'SQL'
begin;
set local role authenticated;
set local request.jwt.claim.sub='a9100000-0000-4000-8000-000000000004';
insert into storage.objects(bucket_id,name) values('user-books','a9100000-0000-4000-8000-000000000004/b9100000-0000-4000-8000-000000000006/book.pdf');
commit;
SQL
race 'deletion first refuses the upload when its reservation disappears' '42501'
run <<'SQL'
do $$ begin
 if exists(select 1 from public.user_books where id='b9100000-0000-4000-8000-000000000006')
 or exists(select 1 from storage.objects where bucket_id='user-books' and name='a9100000-0000-4000-8000-000000000004/b9100000-0000-4000-8000-000000000006/book.pdf') then
  raise exception 'delete-first race left a book or orphan';
 end if;
end $$;
SQL
echo '4 concurrency scenarios passed'
