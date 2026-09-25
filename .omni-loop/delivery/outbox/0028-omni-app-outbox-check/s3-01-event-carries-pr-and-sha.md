---
id: s3-01-event-carries-pr-and-sha
prd: 28
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

What should the notice that asks for a check say, and what happens when someone presses Re-run on a check that belongs to several pull requests, or to none?

## The decision, in plain words

The notice names the repository, the pull request and the exact commit. A re-run asks for one check per pull request it belongs to, and for none when GitHub ties it to no pull request.

## The options, in plain words

A. A. One event per listed pull request, none when there is none, as built.
B. B. Look the pull request up by head SHA when the list is empty.
C. C. Carry the full pull request facts in the event instead of re-reading them.

## What I had to decide

The spec says a handled delivery becomes one Inngest event but does not fix the event's data, and a `check_run` payload lists zero or more pull requests (zero for a pull request opened from a fork).

## What I did meanwhile

`toCheckRequests` emits `{ installationId, owner, repo, repository, prNumber, headSha, trigger }` per pull request; `check_run.rerequested` yields one event per entry of `check_run.pull_requests` and none when it is empty. Base/head refs and labels are not carried: s5 reads the pull request fresh in its evaluate step, so a debounced run sees the latest state. A delivery without an installation is ignored with 200; an event that cannot be sent answers 502 so GitHub records a failed delivery.

## What it costs to change later

A change to the event's data shape between s3 and s5, both in `apps/omni-app`; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether fork pull requests should get a check on Re-run by looking the PR up from the head SHA.
