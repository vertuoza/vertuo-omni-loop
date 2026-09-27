---
id: s6-01-manual-acceptance-needs-live-settings
prd: 251
slice: s6
rank: human-action
bears-on: none
raised: 2026-09-27
wave: 5
---

## The question, in plain words

Someone has to see the new answer doors work for real, but they only work once the robot's settings and a few passwords are set on the live services, which only a person can change.

## The decision, in plain words

The written guides are done and name every setting. The live checks, with screenshots, wait for a person to change those settings and then try each door once.

## The intro, for fun

Three doors are built, painted and labelled.

## The punchline, for fun

Nobody has handed out the keys yet, so nobody has walked through one.

## What a person must do

1. On the App's Vercel project, set OMNI_PAGE_URL to the galaxy's production address and OMNI_OUTBOX_SECRET to a new random secret, then redeploy (apps/omni-app/README.md, The Omni page, human steps).
2. On the galaxy's Vercel project, set OMNI_OUTBOX_SECRET (the same value), SUPABASE_SERVICE_ROLE_KEY, GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET for Production, then redeploy (apps/galaxy/README.md, Create the Vercel project).
3. In the omni-loop App's settings, subscribe to the Issue comment event and accept it on each installation; add https://<galaxy host>/prd/github/callback as a callback URL.
4. Once the migration is applied, push to the feature pull request and screenshot its questions on the PRD's Outbox tab within a minute.
5. Press Send on the tab, screenshot the reply posted under your own account, then run /omni:yolo-fix and check settled.md names that reply's link as its channel URL.
6. Type a reply on GitHub and screenshot it shown as pending on the tab.
7. End a /omni:yolo red with answers on, screenshot the opening question, answer here, and check the same run settles the answers. Attach every screenshot to the s6 sub-PR.

## What I had to decide

The last slice asks for the manual acceptance to be recorded with screenshots in its sub-PR. Each check needs production settings a person must change first: the App's two variables, the galaxy's four, the issue_comment event accepted on each installation, and the galaxy host listed as a callback URL in the App's settings. None of that can be done or faked from here, and a preview deployment cannot send (GitHub refuses a callback on an unlisted host).

## What I did meanwhile

Wrote ADR-0048 and the kit, App and galaxy README lines, which name every variable and every App setting, and left the four acceptance checks for a person, listed in the steps below.

## What it costs to change later

Nothing to undo: the checks only confirm what is merged. Until they pass, PRD 251 is built and tested against fakes but not seen working live.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the production galaxy and App already carry any of the six variables could not be read from here.
- (author) apps/galaxy/.env.example, outside this slice's territory, does not yet list OMNI_OUTBOX_SECRET, GITHUB_APP_CLIENT_ID or GITHUB_APP_CLIENT_SECRET.
