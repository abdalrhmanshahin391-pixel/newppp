# Free conversation time

The database is the authority. `free_talk_config.enabled` starts false; enable only after the
migration, web publication and the independently deployed voice worker all succeed.

Initial plan allowances (editable in Admin → Plans): Free 10 minutes once per account;
Toolkit 1 hour/month; Study 2; Boost 3; Pro 6; Ultimate 10. Monthly means UTC calendar month,
even for a prepaid quarterly/yearly subscription. A server-verified admin has no total time
limit, with the existing one-hour session duration. New plans default to zero. Verified lesson
calls retain their existing access rules; arbitrary browser mode flags cannot exempt a call.

A transaction/advisory lock reserves up to one hour from the remaining allowance. Only one
unclosed session per account may exist; starts are limited to six/minute. Email confirmation
is required for non-admins. Paid access requires an active live subscription, a valid manual
access grant, or a live pack record, in addition to the effective plan. Client checkout success
cannot assign a plan; only trusted payment/grant paths can. Price ids determine webhook plans.

The worker claims a lease exactly once, creates a deterministic private Daily room and binds
its function call id. Both meeting tokens and the room share the database deadline and have
expiry ejection enabled. The worker also cancels its pipeline at the deadline. Learners never
supply a duration, deadline, provider identifier or quota settlement. The worker callback uses
the existing session/end route, with a separate constant-time, server-secret-authenticated branch
and the fixed production callback origin. No new Edge Function, cron or periodic database poll.

Time includes connection/setup and provider-stop confirmation, rounded up to whole seconds.
Unclaimed starts can be cancelled atomically for zero usage; claimed starts keep their hold
until trusted cleanup confirms closure. Cleanup failures retain the hold; expiry charges the
reserved amount. This deliberately prefers a conservative balance over refunding live access.
Duplicate settlement is idempotent. Deleting a parent session cannot erase its quota ledger.
The UI counts down locally from a fresh server snapshot and refreshes on start/end/focus.
Changing a browser clock, UI or timer never authorizes voice access. Reuse of an account on
another device does not create another allowance. This does not establish one physical person
per account or eliminate all service/provider failures.

## Validation

- `node --test src/lib/free-talk-time.test.ts src/lib/rita-v3-startup.test.mjs src/lib/rita-voice-connection.test.ts`
- From voice-agent: `python -m pytest tests/test_free_talk_guard.py tests/test_free_talk_provider.py -q`
- `node scripts/test-free-talk-db.mjs`: requires either an existing `PGLITE_MODULE` module path,
  or `FREE_TALK_TEST_DATABASE_URL` pointing to a fresh **local** database named
  `uzyra_free_talk_test`. It refuses other database URLs. Fixture SQL must never run on production.
  The real Postgres mode uses independent connections for the competing starts; PGlite serializes
  concurrent requests and therefore cannot verify actual lock contention.
- The free-talk CI runs those SQL checks on PostgreSQL 16, countdown/startup tests, types and build.
  Existing worker PR checks run the broader voice suite. `scripts/preview-voice-time.mjs` serves
  actual Credits, countdown hook and balance components with offline auth/plan/provider fixtures;
  it makes no real calls. Check Arabic/English, small/large widths, empty, error and admin states.
- `rita-modal-deploy.yml` verifies the private `quota_readiness` result against the deployed commit;
  it reports no secret values and contacts no speech/model provider. Confirm the deploy step ran,
  rather than only the workflow's missing-credentials skip.

## Release and rollback

1. Review/test the migration, then apply it while the gate remains false. Verify six functions
   are service-only, both new tables have RLS and role restrictions, and the six plan values.
2. Publish the matching web build; deploy/attest the matching Modal worker. Keep the gate false
   until both are confirmed. Old web builds cannot use the versioned worker start protocol.
3. Confirm no older non-admin calls remain, then set `free_talk_config.enabled=true`.
4. Rollback: set the gate false to block new free calls; existing leases still expire. Preserve
   the ledger and restrictive grants. Restore a known compatible enforcement build or fix forward;
   reverting to the old unmetered worker/web would remove the protection. Do not drop the ledger
   or regrant arbitrary plan activation. No database restore is needed for this additive release.
