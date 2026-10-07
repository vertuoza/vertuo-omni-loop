---
id: s6-01-roadmap-push-reads-the-prs
prd: 1162
slice: s6
rank: medium
bears-on: none
raised: 2026-10-07
wave: 3
---

## The question, in plain words

The page colours each piece of a roadmap by where it stands, and says what a waiting piece waits on. The spec names the states but not how to tell them apart from the work on GitHub.

## The decision, in plain words

A piece counts as building once its work is open, waiting on answers when its draft holds open questions, ready once every part is ready, and merged once every part merged; a waiting piece names the first unfinished piece before it. When the code host cannot be read, nothing is sent and one line says so.

## The intro, for fun

Six colours, one Gantt, and GitHub as the only witness.

## The punchline, for fun

We asked the pull requests; they rarely lie about being drafts.

## The options, in plain words

A. Derive the state and the waits-on line from the feature pull requests alone, in the push (built)
B. Push no waits-on line until the next slice, and leave every piece without work as waiting with no reason
C. Run the whole reading of the next-step command inside the push, board and checks included

## What I had to decide

How `omni roadmap push` derives each PRD's state and its waits-on line from GitHub: a feature PR (and, in a plan repository, each target PR its row names, by the same branch) decides `building`, `outbox` (an open draft with high or human-action items on its branch), `ready`, `merged`, `closed`; a PRD not started names its first unmerged blocker as `waits on <repo>#<pr> (<id> <title>): <state>`. The spec's `building wave <k>/<m>` and `CI red` words are not produced: they need the board and the care state, which `omni next` reads (s7). GitHub unreadable stops the push with `github unreachable`, exit 1.

## What I did meanwhile

`kit/lib/roadmap/push.ts` holds `prdState`, `prdTimes` and `waitsOn` as pure functions, tested in `push.test.ts`; `readStandings` reads `gh pr list --head <branch>` per repository and the outbox items on the fetched feature branch.

## What it costs to change later

Small: s7 can hand its own held `why` to the push, or widen `stateWords` with the board's wave and the CI state; the contract and the page do not change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether `outbox` should also show while slices are still building and a high item is open: it does today, as soon as the draft holds one.
