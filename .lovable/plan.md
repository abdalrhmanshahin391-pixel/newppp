# Fix the failed build (Rita voice page)

## What is actually wrong
This is not GitHub or the database connection. The build log shows one clear error: the Rita voice page imports a new browser-only file (the call-tracking file added in the last round) directly, and the build forbids browser-only files from loading on the server. The other browser-only files on that page are already loaded safely; this one was not.

## Fix
- Rename the tracking file so it is no longer marked browser-only (`rita-turn-telemetry.client.ts` -> `rita-turn-telemetry.ts`). It only contains plain helpers and a `fetch` call made inside functions, so it is safe to load on the server.
- Update the one import in the Rita voice page to the new name.
- No behavior change: recording, admin table, and voice flow stay exactly the same.

## Verify
- Confirm the build log shows "build OK".
- Load `/rita-live` and the admin voice page to confirm they open.
- Re-publish the live site only if you ask.

## Technical details
- Error: `[import-protection] Denied by file pattern **/*.client.*`, importer `src/routes/rita-live.tsx`, import `src/lib/rita-turn-telemetry.client`.
- Check that nothing in the renamed file touches `window`/`navigator` at module top level; if it does, move it inside the functions.
