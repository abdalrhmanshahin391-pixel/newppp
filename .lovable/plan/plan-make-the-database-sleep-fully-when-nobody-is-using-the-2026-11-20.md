# Plan: Make the database sleep fully when nobody is using the site

## Honest limit first
- When no tab is open, the database can sleep and database compute stops. This plan targets that.
- Not everything can be literally zero: the daily backup (`vault-daily-snapshot`) wakes the database once a day for a short time (~10–15 min of billed awake time), and the small "worker days" charge (~0.18/day) is platform hosting, not your database. Removing the backup is possible but risky — it stays unless you say otherwise.
- Expected quiet-day result: from ~0.79/day today to roughly 0.02–0.2/day (estimate, must be measured after 48h).

## What keeps the database awake now (found last analysis)
1. Presence heartbeat every 3 min for every signed-in tab (`src/hooks/usePresence.ts`).
2. Device check timer every 5 min (`src/routes/__root.tsx`).
3. Admin pages auto-refresh every 60 s (`admin.people.tsx`, `PeoplePulse.tsx`).
A forgotten open tab (yours too) keeps the database awake all day.

## Changes
1. Presence: write only when the tab is visible AND you interacted in the last 5 min; heartbeat every 15 min; stop fully when tab hidden/idle; one write on return.
2. Device check: remove the timer; check only on sign-in, token refresh and page navigation.
3. Admin polling: remove automatic refresh; refresh on page open, window focus, and a manual Refresh button.
4. Sweep the code for any other `setInterval`/`refetchInterval`/realtime subscription that touches the database and apply the same rule (only while visible and active).
5. Keep event-driven work as is (call-end review/replay, push on message). No new timers.

## Trade-offs
- "Online now" in admin becomes approximate (15-min window).
- Second-device lock is enforced on next navigation, not within 5 min.
- First visit after a quiet period may take a few seconds longer while the database wakes.

## Verification
- Typecheck/build; Playwright: open site, hide tab / stay idle, confirm zero database requests.
- Re-run cost analysis after 48h and compare instance-hours.

do u want to apply it like lovable
