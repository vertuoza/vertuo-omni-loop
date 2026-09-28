---
id: s12-01-manual-acceptance-needs-live-settings
prd: 251
slice: s12
rank: human-action
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

Someone has to see the new answer doors work for real, but that needs two passwords and one address set on the live services, which only a person can change, and the work merged first.

## The decision, in plain words

The written guides are done and name every setting. The live checks, with screenshots, wait for a person to change those settings once the work is merged, then try each door once.

## The intro, for fun

Three doors are built, painted and labelled.

## The punchline, for fun

Nobody has handed out the keys yet, so nobody has walked through one.

## What a person must do

Settings first (production only; a preview deployment cannot send, GitHub refuses a callback on an unlisted host):

1. In the omni-loop GitHub App's settings (github.com › Settings › Developer settings › GitHub Apps › omni-loop › General): note the **Client ID**, press **Generate a new client secret** and copy it, and under **Callback URL** add `https://vertuo-omni-loop-galaxy.vercel.app/prd/github/callback` beside the URLs already listed. Save.
2. On the galaxy's Vercel project (`vertuo-omni-loop-galaxy`) › Settings › Environment Variables, for **Production**: set `GITHUB_APP_CLIENT_ID` to the Client ID and `GITHUB_APP_CLIENT_SECRET` to the new secret (server only, no `NEXT_PUBLIC_` name). `SUPABASE_SERVICE_ROLE_KEY` and the App's `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` are already set (PRD 359); check they still are.
3. Merge the feature PR of PRD 251 into `main`, wait for the `supabase` workflow's deploy job to apply `20261005090000_outbox_sends.sql`, and for the galaxy's production deployment (redeploy it if it built before step 2).

Then the checks, on a feature PR whose outbox has at least one open human-action or high question (a throwaway PRD is fine), with `answers.enabled` on (the default):

4. Open the PRD's Outbox tab (`/prd/<id>?tab=outbox`, or the link in the outbox comment). **Screenshot A:** the open questions in the pull request's numbering, the context rail beside them.
5. Type a reply on the pull request (for example `1: A`). Within a minute, reload the tab. **Screenshot B:** that answer shown as pending on its card (who, where, when).
6. On the tab, pick an answer and press **Send**; authorise the App if GitHub asks. **Screenshot C:** the tab's *Sent as @login* with the comment's link. **Screenshot D:** the reply on the pull request under your own account, marked with omni-loop.
7. Run `/omni:yolo-fix <prd>`. **Screenshot E:** the new `settled.md` entry naming you as approver and the reply's link as its channel URL.
8. End an `/omni:yolo` red with the switch on. **Screenshot F:** its opening question with the three choices (Answer here now · carry on · Later). Choose **Answer here now**, answer, and **Screenshot G:** the same run posting the reply and settling it.
9. Attach screenshots A to G to sub-PR #493 (or the feature PR once it has merged), one line under each naming the acceptance criterion it shows (A: 6, B: 9, C and D: 8, E: 8, F: 1, G: 2 and 3), then reply `<n>: ok` to this question on the feature PR.

## What I had to decide

The last slice asks for the manual acceptance to be recorded with screenshots in its sub-PR. Each check needs the App's Client ID and a client secret set on the galaxy's production project, the galaxy's `/prd/github/callback` listed as a callback URL in the App's settings, the `outbox_sends` migration applied and the Send code deployed, which happens only once the feature PR merges into `main`. None of that can be done or faked from a slice.

## What I did meanwhile

Wrote ADR-0052 (the spec's Decisions 1 to 3) and the kit and galaxy README lines, which name the switch, `omni answers`, the end of yolo, the Outbox tab, both routes, the short address, `outbox_sends`, the two variables and the App's callback URL. Left the checks, with the screenshots to attach, as the steps below.

## What it costs to change later

Nothing to undo: the checks only confirm what is merged. Until they pass, PRD 251 is built and tested against fakes but not seen working live, and Send answers that it is not open here.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the production galaxy already carries GITHUB_APP_CLIENT_ID or GITHUB_APP_CLIENT_SECRET, or the App already lists the callback URL, could not be read from here.
- The production galaxy address is taken from this repository's ask.url; a person should use whatever host actually serves production.
