---
id: s8-01-held-prd-sent-as-park
prd: 1162
slice: s8
rank: medium
bears-on: none
raised: 2026-10-07
wave: 5
---

## The question, in plain words

The spec says a project waiting on another's merge is named on the loop's page and on its own issue, but the loop's page only knows parked projects. How should a waiting project show there?

## The decision, in plain words

The loop sends a waiting project to the loop's page as a parked one, its line naming the pull request it waits on, and leaves one comment on the project's own issue each time that line changes.

## The intro, for fun

A project waiting on a merge and the loop's page has only one chair for waiting.

## The punchline, for fun

So it sits in the parked chair, with a note saying exactly whose merge it waits for.

## The options, in plain words

A. Send a held PRD as a park naming the pull request, and comment on its issue when the line changes (built)
B. Add a hold event to the loop's sending command and the Loop page, in a later slice
C. Leave held PRDs to the roadmap's page alone, with no Loop page line and no issue comment

## What I had to decide

Whether a project held on its blockers is sent to the loop's page as a park, and whether the loop comments on its issue, without a new kind of event in the loop's sending command.

## What I did meanwhile

/omni:drive and /omni:mega-drive send each held PRD with `omni loop push park`, splitting its `waits on <repo>#<pr> (<id> <title>): <state>` line into who and what, and post it once per distinct line with `gh issue comment` on the held PRD's issue; the roadmap's page gets it from `omni roadmap push`.

## What it costs to change later

Small: a `hold` event in `omni loop push` and the Loop page would replace one line in each of the two skills; the comments already posted stay on the issues.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The Loop page may count a held PRD among the parked ones, though the loop goes on running other steps; whether the page should tell them apart was not settled.
- (author) A held PRD's issue gets a new comment each time its waits-on state changes (building, outbox, CI red, ready), which may be noisy on a long wait.
