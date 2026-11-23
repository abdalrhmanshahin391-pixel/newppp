# Roadmap

- [x] Apply approved idle savings: public startup snapshot, safe announcement reads, activity-only presence and sign-in-only device checks
- [x] Verify 51 focused regressions and public preview startup/focus: zero database calls, no runtime errors
- [ ] Authenticated idle/login verification — blocked: test-account permission declined and no matching requester account
- [ ] Production idle savings measurement — blocked: changes must be published first, then comparable usage records collected; full Chromium/WebKit CI not run locally

- [x] Restrict checkout to debit/credit cards and hide optional business tax-ID controls
- [x] Refine checkout and home typography/content
- [x] Diagnose and fix blank-page reliability and first-load performance
- [x] Add safe manual plan grants with expiry, audit history, revocation, and paid-plan fallback
- [ ] Verify payments, access limits, metadata, and desktop/mobile behavior

- [x] Recover the three saved homepage pictures and replace stale fallbacks
- [x] Verify restored homepage images on fresh visits and reloads (all images loaded; no browser errors)
- [ ] Authenticated homepage verification — blocked: no matching managed account/session; public artwork verified without login
