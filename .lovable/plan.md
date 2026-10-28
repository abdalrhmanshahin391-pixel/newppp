# Cut idle database running cost by ~90%

## What the numbers say (Oct 15 – Oct 28)
- Database server (`cloud_compute_pico`): **15.0 credits**, 193.85 instance-hours. That is about 98% of all running (non-build) cost.
- Price: 0.0774 credits per hour, so ~1.86 credits per day when it never sleeps.
- Everything else is tiny: worker days 1.93, functions/network/storage/AI under 0.03 combined.
- So the only thing worth fixing is: **the database never goes to sleep.**

## Why it never sleeps
The database only sleeps after a quiet period with no activity. Four timed jobs keep poking it all day, even with zero visitors:

| Job | How often | Per day | Needed? |
|---|---|---|---|
| `rita-turn-review` | every 2 min | 720 | No. Reviews only matter after a Rita call |
| `rita-replay-auto` | every 10 min | 144 | No. Replays only matter after a call |
| `push-dispatch-hourly` | every hour | 24 | No. Push messages already wake the sender when created |
| `vault-daily-snapshot` | once a day | 1 | Yes, keep |

Total ~889 wake-ups per day. The 2-minute job alone makes sleep impossible.

## The plan
1. **Stop the three timed jobs** (`rita-turn-review`, `rita-replay-auto`, `push-dispatch-hourly`). Keep only the daily backup snapshot.
2. **Review and replay run when a call ends instead of on a timer.** When a Rita call finishes (session marked ended), a database trigger sends one request to the review function and one to the replay worker, using the same private worker key already used today. No call = no wake-up.
3. **Admin "Run reviews now" button** in the Rita quality admin page, so old/missed items can be processed by hand. Missed items are not lost; they stay "pending" until the next call ends or the button is pressed.
4. **Leave visitor-only features alone.** Presence heartbeat and account ping in the site only run while someone has a page open, so they don't affect the empty-site cost.
5. **Verify:** confirm only `vault-daily-snapshot` remains scheduled; end a test call and confirm a review row moves from pending to done; recheck instance-hours after 48 hours.

## Expected result
- Idle wake-ups drop from ~889/day to 1/day.
- With no visitors, database hours should fall from ~24/day toward ~1–2/day (wake-up for the snapshot plus a short idle window). That is roughly **90%+ fewer database credits on quiet days**. This is an estimate; real savings depend on how many people use the site, since every visit or call still wakes it.
- Trade-off: reviews/replays appear right after a call ends instead of within 2–10 minutes on a timer — effectively faster, never delayed by idle.
- Note: the first visitor after a quiet period may wait a few seconds while the database wakes.

## Technical details
- Migration: `cron.unschedule` for jobs 4, 6, 7; new SECURITY DEFINER function `wake_rita_post_call()` + `AFTER UPDATE` trigger on `rita_v3_sessions` `WHEN (old.ended_at IS NULL AND new.ended_at IS NOT NULL)` (column name confirmed before writing), calling `net.http_post` to the existing `rita-review` Edge Function and `/api/public/rita-replay` with `x-worker-key` from `site_secrets`. Revoke EXECUTE from anon/authenticated/public.
- The existing `wake_rita_worker` / `wake_push_dispatch` insert triggers stay as they are.
- Admin button calls a server function that checks `has_role(admin)` then posts to the same review endpoint.
- No change to Rita behavior, voices, lessons, RLS on learner tables, or secrets.

do u want to apply it like lovable
