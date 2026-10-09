---
id: s2-03-who-the-author-is-and-when-a-request-stops-waiting
prd: 1322
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

Who counts as a PRD's author when nobody is recorded as having opened it, when is a request asked again, and when does it leave the asked person's bell?

## The decision, in plain words

The author is whoever opened the PRD on the page, or the person asking when nobody is recorded, and any request after the first is an asking again. A request leaves the bell once someone approves the PRD after it was asked.

## The intro, for fun

Every PRD has a parent, except the ones that do not.

## The punchline, for fun

Then whoever rings the bell is the parent for the day.

## The options, in plain words

A. A. Opener else asker; any later request re-asked; leaves the bell at the next approval (built).
B. B. Refuse a request when the PRD has no recorded opener, and call a request re-asked only after a void.
C. C. Also drop a request from the bell after a fixed time, such as a week.

## What I had to decide

Three small rules the spec leaves open: the author's identity, what `re-asked` means, and when the bell stops listing a request.

## What I did meanwhile

approval_request() takes dossiers.opened_by as the author, falling back to the caller; any request for a dossier that already has one is `re-asked`; approval_requests_waiting() lists, per dossier, the latest request that names the caller, until an approval dated at or after it exists. Logins follow dossier_approve()'s rule (player login, GitHub identity, email), names are the player's display name.

## What it costs to change later

Low: each rule is one line of one function, changed by a later migration; no row changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says re-asked follows a void; voids land in s6, so for now any later request is re-asked.
- (author) A request nobody ever approves stays in the bell; the spec says nothing of expiry.
