---
id: s2-03-prd-50-recording-is-trimmed
prd: 72
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The recorded example of an earlier delivery was read from the code host through a connector that returns a slimmer shape and cannot see when a pull request was marked ready. Is a trimmed recording good enough?

## The decision, in plain words

The recording keeps what the retro reads, in the code host's own shape, without long descriptions or code changes, and the files come from the repository itself. The moment the feature was marked ready is left unknown, and the retro says so.

## The intro, for fun

The recorder had a small suitcase, so it packed only what the trip would actually use.

## The punchline, for fun

One souvenir stayed behind: the minute the feature said it was ready to be looked at.

## The options, in plain words

A. Keep the trimmed recording, with the ready moment unknown, the option built.
B. Record again later with direct access to the code host, bodies, comments and events included.
C. Add the ready moment by hand from the pull request's page, marked as added by hand.

## What I had to decide

What `apps/omni-app/test/fixtures/prd-50/recording.json` holds. The plan asks for "#51 and its sub-PRs, as GitHub returned them". This session reads GitHub only through the GitHub connector: it returns pull requests, files and reviews in a slimmer shape, and has no route for issue events, so `ready_for_review` on #51 cannot be recorded.

## What I did meanwhile

The recording holds 20 responses: #51, the sub-PR list (#54, #56, #57), each sub-PR's files and each PR's reviews, in the REST shape trimmed of bodies and patches; `merge_commit_sha` for #51 is read from the squash commit on `main`; the trees and blobs at the merge SHA are built from that commit's own git objects. Issue events, comments, commits and check runs are not recorded, which `recording.json` states. The replay gives 3 slices in 2 waves, and the timeline reads "ready: not known".

## What it costs to change later

Recording again with a token that reads the REST API directly replaces one file and the retro pinned beside it; no code changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a later slice needs a response this recording leaves out; slice s5's test reads only the settled file, which is recorded.
