# Your books: database-only rollout

`supabase/migrations/20261118120000_books_user_library.sql` is the reviewed correction
of the supplied `Uzyra-your-books.sql`. It preserves its two private tables, two
slots per person, fixed `<user>/<book>/book.pdf` path, PDF-only 50 MiB bucket,
10 additions per rolling 24 hours, and owner-only access. Private books never
enter `public.books` or its public search/counts. It does not build the upload UI.

Corrections: an explicit transaction; immutable book id; explicit client grants
(no anonymous table access, no client changes to rate history or TRUNCATE);
owner validation before the rate counter; a before-delete guard; and a narrowly
scoped, owner-checked write-lock helper in the Storage INSERT/UPDATE policies.
No extra scheduled work or Edge Function is added.

## Delete order and concurrency

The client must remove the PDF through `supabase.storage.from('user-books').remove`
before deleting its `user_books` row. The row deletion fails with SQLSTATE `23503`
and hint `user_book_file_must_be_removed_first` while the file metadata remains.
An upload or replacement holds a row lock on its book for its metadata transaction.
A concurrent row deletion waits, then checks the committed file. If row deletion
wins, the waiting write check sees no reservation and refuses the upload. Empty
or interrupted reservations still consume a slot until deleted.

This preserves at most two registered file paths per person, each limited by the
bucket to 52,428,800 bytes. It does not claim to control provider-internal copies,
backups, or bytes left by failures inside the Storage service itself. Do not delete
`storage.objects` metadata in SQL to clean up a binary file; use the Storage API.
The bucket checks the declared MIME type; validating that bytes are a readable PDF
belongs in the upload/reader integration, not this database migration.

## Validation

`scripts/test-books-db.sh` applies the migration twice on isolated CI Postgres,
runs `90_books_user_library_test.sql`, then `test-user-books-concurrency.sh`.
The latter uses independent sessions for same-slot additions, the daily limit,
upload-before-delete, and delete-before-upload. It simulates Storage metadata
transactions and does not upload or delete a real user's PDF.

Run `supabase/checks/user-books.sql` for read-only catalog checks after rollout.
These checks verify deployed rules; behavioral tests are run on the isolated
database. Existing bucket policies must remain scoped to their named buckets.

## Recovery

An execution error inside the transaction rolls the migration back. After a
successful rollout, do not drop these tables or bucket as a routine rollback:
readers may have uploaded data. Disable the feature in the client, preserve data,
and fix forward. Restore an entire database backup only with a separately reviewed
recovery plan, since it affects changes outside this feature too.
