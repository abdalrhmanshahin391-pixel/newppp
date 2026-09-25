# Make the privacy promise match reality (deletion by email)

## Your questions, answered first

**Will Paddle check that deletion works?** Paddle's review reads your public policy pages and your site. They do not create an account and click a delete button. What they check is that the pages exist, are reachable without logging in, name you as the seller, name Paddle as Merchant of Record, and state a refund window between 14 and 90 days. So a policy that says "email us and we will delete your data within 30 days" is enough for them.

**Is it legally enough?** Yes, as long as you actually honour the emails. Handling deletion requests by hand is a normal, lawful way to do it. The only thing that is a problem is promising something you do not do — that is what we are fixing.

**If Paddle rejects you, is the site doomed?** No. Rejection is not permanent. Paddle tells you what was missing, you fix it and re-submit. People commonly get one round of "add this to your terms" feedback and pass the second time. Nothing about your domain or site gets blacklisted.

## What I will change

One thing only: the wording on the privacy page, so it stops implying deletion is available inside the app.

- Rewrite the "Your rights" section: you can ask for access, correction, export or deletion of your data by emailing [ritajetnetwork@outlook.com](mailto:ritajetnetwork@outlook.com), and it is acted on within 30 days. Keep the EEA/UK complaint line.
- Adjust the "How long we keep it" line so the 30-day recovery window is described as counted from your deletion request, not from a self-service delete.
- Add a short, plain "How to ask for deletion" note under the rights section: what to send, from which email address, what gets removed, and what has to stay (billing records for tax law).

No database changes, no new pages, no account-settings changes.

Can u also remove special offer page just remove the button from the header 

## Technical detail

Edits are confined to `src/lib/legal-content.ts` (the privacy sections around lines 155 and 158). The legal routes render from that file, so both the privacy page and any linked copy update at once.