---
prd: 2739
title: Keep what a fix or a review leaves open
blocked-by: none
spec: file
phase0: server
---

**Date:** 2026-11-12 · **PRD:** #2739 · **After:** PRD 556 (`omni bug`), PRD 2100 (the proof in the
fix PR's body), PRD 2508 (the `Follow-up:` lines of a bug-fix run), the care replies of `/omni:pr-care`
· **Touches:** `kit/bin/commands/follow-up.ts` (new), `kit/lib/follow-ups/` (new),
`kit/lib/bug/verdict.ts`, `kit/lib/bug/product.ts`, `kit/lib/care/marker.ts`,
`kit/bin/commands/care.ts`, `kit/lib/delivery/ship.ts`, `kit/lib/status/`, the skills `bug-fix`,
`mega-bug-fix` and `pr-care`, `.omni-loop/delivery/README.md`, `docs/guide/`.

## Problem

A bug fix fixes one cause, and a review settles one pull request. Both often see more than they fix,
and the loop keeps none of it:

1. **A bug record's open points stay prose.** A fix that sees a second problem says so in its record
   or in the `Follow-up:` lines its run ends with (PRD 2508). Those lines are for an app to read once;
   nothing in the repository keeps them, and nobody finds them after the issue closes.
2. **A promise made in review is never filed.** `/omni:pr-care` pushes back on a comment with a reply
   like *"Low value for this PR … Happy to take it as a follow-up."*, then resolves the thread. The
   thread is gone from every list, and the follow-up is in no list either.

**The evidence.** The kit-gaps review (Nov 2026), item 1: open points were left as text in 10 of 18
bug records of a plan repository built with the kit, and follow-ups promised in review threads of its
features were never filed. Cases are cited by the review's item number only (Decisions).

## Solution

The loop keeps every open point in the repository, one file each, and two gates refuse to close a
bug or ship a PRD while a point it named has no file. It never opens an issue and never notifies
anyone: the workspace's members read the list and decide what deserves an issue.

### Where the points live

One file per open point in `<paths.delivery>/follow-ups/` (in this repository
`.omni-loop/delivery/follow-ups/`), named `<yyyy-mm-dd>-<slug>.md`, `<slug>` the point's first words
in kebab-case, at most six:

```markdown
---
source: bug #412
date: 2026-11-12
repos: [demo-org/nimbus-api]
---

The export job retries a 4xx forever: 312 retries in the last run's log.
```

- `source` is `bug #<n>` (a bug fix of this repository), `<key>-B<n>` (a product bug), or
  `PRD #<n> · <thread url>` (a review reply on that PRD's feature PR or one of its sub-PRs).
- `date` is the day it was written. `repos` is optional, the repositories the point lives in as far
  as the run saw (`owner/name`, at most ten).
- The body is the point in one or two sentences, plain text, never a customer's, a tenant's or a
  person's name and never a secret (the same rule as PRD 2508's `Follow-up:` line).
- **A review point keeps the person's own words** (BL-ASK-1). For source `PRD #<n> · <thread url>`
  the body is two parts: `## Asked`, the person's review comment copied word for word from the
  thread (never shortened, summarised or reworded), and `## Agent's note`, the agent's own line on
  why it is postponed, signed as the agent's (L-AIACT-1). Only the second part is the agent's.
- One file per point means two branches that each add one never conflict.
- A person closes a point by deleting its file, in any pull request, or by opening an issue for it
  first. The loop never deletes one.

### `omni follow-up`

- `omni follow-up add --source <source> --text <text> [--repos <owner/name>,…]` writes the file
  and prints its path. It refuses (exit 1, one line naming the file) a point whose source and text
  are already in a file of the folder, and refuses (exit 2) an empty text, a text over 300
  characters, or a source of none of the three shapes. It writes in the checkout it runs in, never
  elsewhere, and touches no network.
- `omni follow-up list [--json]` prints every open point, oldest first: date, source, the text's
  first line. `none` when the folder is empty or missing.

### A bug fix

- `bug.md` gains an optional section, `## Still open`, after `## Mutation`: one `- ` bullet per
  point the fix saw and did not fix. `/omni:bug-fix` and `/omni:mega-bug-fix` write each of their
  `Follow-up:` lines (PRD 2508) there too, then run `omni follow-up add --source 'bug #<n>'` for each
  bullet on the fix branch, so the files merge with the fix, before the issue closes.
- `omni bug <n>` refuses a record whose `## Still open` holds a bullet with no follow-up file of
  source `bug #<n>` and the same text (whitespace collapsed), one line per bullet:
  `bug.md: "<bullet>" is still open but has no follow-up: omni follow-up add --source 'bug #<n>' --text '<bullet>'`.
- `omni bug check --product <key> <file>` does the same with source `<key>-B<n>` in the checkout it
  runs in; with `--new` (no number yet) the check is skipped and says so in one line.
- A record without the section, or with the one line `none`, passes as today.

### A review

- `omni care reply` takes a fourth verdict, `later`: the reply promises the point for later. It
  posts the reply with the marker `<!-- omni-care: later -->`, resolves the thread, and, with
  `--prd <n>`, writes the follow-up in the worktree it runs in, source `PRD #<n> · <thread url>`:
  `## Asked` is the thread's first comment by a person, copied word for word as GitHub returns it,
  and `## Agent's note` is the reply's text. There is no `--point`: the agent never writes the
  person's point in its own words. A thread whose comment cannot be read is refused,
  `not judged: could not read <thread url>`, and nothing is written.
  `/omni:pr-care` then commits it alone (`docs(follow-up): <slug>`) and pushes with its round.
- **A person agrees to postpone it** (never#2). Putting a person's review comment off is a decision
  the agent takes alone, so the same `later` reply also records **one outbox item ranked high** in
  the PRD's outbox, through the writer `omni item new` uses: what the comment asked, why the agent
  proposes to postpone it, the thread's url and the follow-up file's path, and the question
  *"Postpone this to a follow-up, or fix it in this PRD?"*. The kit ranks a `later` decision high,
  whatever rank the agent proposes, so it is never adopted silently. `omni ship`'s existing outbox
  gate then holds the PRD until a person answers it; an answer "fix it now" goes to
  `/omni:yolo-fix` like any other, and the follow-up file is deleted in that rework.
- `/omni:pr-care` replies `later`, never `pushed-back`, whenever the reply offers to do the point
  afterwards. A plain push-back with no promise stays `pushed-back`.
- `omni ship <n>` reads the feature PR's review threads, and those of its merged sub-PRs, through
  the reader `omni care` already uses, and refuses while a `later` reply has no follow-up file of
  source `PRD #<n> · <that thread's url>`:
  `PR #<pr>: the reply "<first words>" promised a follow-up that has no file: omni follow-up add --source 'PRD #<n> · <url>' --text '…'`.
  It also refuses a `later` reply with no outbox item of its thread url:
  `PR #<pr>: the reply "<first words>" postpones a person's comment with no outbox item: a person must agree to it`.
- When GitHub cannot be read, `omni ship` prints the one line
  `not judged: could not read the review threads of PRD <n>'s pull requests: <why>` and exits 1: a
  check that cannot decide says so and never shows a pass (BL-GATE-1); it never ships unchecked.

### `omni status`

One line under the bar when the folder holds at least one point:
`follow-ups  4 open · oldest 2026-10-02 → omni follow-up list`. No line when it holds none.

### Not in it

No GitHub issue, comment, label, notification or push to anything outside the repository. No config
key and no flow hook point: a target that wants an issue per point opens one by hand, or with its
own script over `omni follow-up list --json`.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | cli | `omni follow-up add` / `list` | no written convention: follows `kit/bin/commands/care.ts` (verb sub-commands, `--json`) |
| vertuo-omni-loop | cli | `kit/lib/follow-ups/` | no written convention: follows `kit/lib/bug/` (one lib folder per command) |
| vertuo-omni-loop | delivery | `follow-ups/<yyyy-mm-dd>-<slug>.md` | no written convention: follows `.omni-loop/delivery/bugs/<nnnn>-<slug>/` (a dated, slugged file per record) |
| vertuo-omni-loop | cli | verdict `later`, marker `omni-care: later` | `CARE_VERDICTS` ← kit/lib/care/marker.ts:6 |
| vertuo-omni-loop | docs | section `## Still open` | no written convention: follows `kit/lib/bug/verdict.ts` `SECTIONS` (title-case `##` sections) |

## Decisions

- **The person's words are copied, never reworded** (BL-ASK-1, flagged by the page's business-law
  judge on 2026-11-12). The first version took the follow-up's text from the agent's reply or a
  `--point` option, which rewrote a person's review comment in the agent's words. Now `## Asked`
  holds the comment word for word, the agent's words sit under `## Agent's note`, and `--point` is
  gone.

- **One file per point, not one shared file.** The idea named one file (`follow-ups.md`). Every fix
  branch appending to it would conflict on GitHub, whose merge button ignores git's union merge. The
  person chose one file per point.
- **A care verdict `later`, not parsing push-back text.** The person chose a verdict of its own, so
  the gate reads a marker, never wording.
- **Gates refuse.** The person chose that `omni bug` and `omni ship` refuse a point with no file,
  since the skill steps alone are how the points are lost today.
- **The evidence is cited by the review's item number only.** The source review is of a private
  delivery; this repository is open source, and never#11 keeps that delivery out of it. The person
  chose item numbers and anonymised shapes; the test fixtures are fictional (`demo-org`).
- **`omni ship` says `not judged` when GitHub cannot be read.** Shipping unchecked would let the
  promise slip again, and BL-GATE-1 says a check that cannot decide says so, never a pass: the line
  starts `not judged:` and names why. Settled after the person flagged the rules on 2026-11-12.
- **A `later` reply also records one high outbox item.** Postponing a person's review comment is a
  decision the agent takes alone; never#2 says every such choice is written down for a person to
  answer, and a follow-up file nobody must answer is not that. Settled after the person flagged
  never#2 on 2026-11-12: the follow-up file keeps the point, the high item asks the person to agree.
- **Words.** The spec uses the glossary's own terms (workspace, member), never the words it avoids
  (fixed on 2026-11-12 after the person flagged it).
- **The voice.** persona:B-E DEv objected: *"Another folder of markdown nobody opens. I'd rather see
  it where I already look."* Settled `accepted`: the count line in `omni status`.

## User stories

- As a developer who fixed one cause of a bug, I want the other problem I saw kept in the
  repository, so the next person finds it without reading a closed issue.
- As a person whose review comment was answered "later", I want to agree to it first and then see
  that promise listed, so it is not lost
  when the thread resolves.
- As a lead, I want one count in `omni status`, so I decide with the workspace's members which points deserve an
  issue.

## Scope

In: the folder and its file shape; `omni follow-up add` and `list`; the `## Still open` section and
its check in `omni bug` and `omni bug check --product`; the `later` care verdict and its check in
`omni ship`; the status line; the three skills' steps; the delivery README and the guide.

Out: opening issues, notifying, a server or page view of the points, closing points automatically,
a config key or hook point, rewriting existing bug records.

## Test seams

Following `omni kb show testing`: unit tests on pure functions, CLI tests through the command with a
temporary repository and an injected `exec`, never a call to GitHub.

- `kit/lib/follow-ups/`: parse and write a file; the slug and name; the duplicate rule; the three
  source shapes.
- `kit/bin/follow-up.test.ts`: `add` writes the file and refuses a duplicate; `list` prints oldest
  first, and `none`.
- `kit/bin/bug.test.ts`: **the test that would have caught item 1's bug records**: a record whose
  `## Still open` holds a bullet with no follow-up file → `not ok` naming the bullet; with the file →
  `ok`; no section → `ok`.
- `kit/lib/bug/product.test.ts`: the same for `bug check --product`.
- `kit/bin/care.test.ts`: `reply --verdict later --prd 7` posts the marker, resolves the thread,
  writes the file whose `## Asked` is byte-for-byte the person's comment (a comment with
  punctuation, a code span and two lines, unchanged) and records one outbox item ranked high naming the thread, even when the agent
  proposes medium.
- `kit/lib/delivery/ship.test.ts`: **the test that would have caught item 1's review promises**: a
  feature PR thread with a `later` reply and no file → refused naming the PR and the reply; with the
  file → ships; threads unreadable → refused with its line.
- `kit/lib/status/` tests: the line with points, none without.

## Risks

Merging publishes a new kit version: every repository on it gets the new gates. A repository whose
bug records already hold a `## Still open` section by hand would see `omni bug` refuse a new fix
until its points have files; only open fix branches are graded, so shipped records are untouched.
Rollback: revert the feature PR and release; the follow-up files are plain markdown and stay
harmless.

- The Legal entries: none touched. The point's text forbids personal data and secrets (L-GDPR-1,
  L-GDPR-2 stay kept).
- N-PRODUCT-15: only a person merges into the main branch. If broken, unreviewed work reaches every
  user. This PRD keeps it: nothing here merges, and the follow-up files land through the fix or
  feature PR a person merges. Changing it needs @pierrederval or @dervalp to approve the pull
  request on GitHub.
- BL-APPROVALS-1 — An approval covers exactly the files the approver read; a later change voids it. Kept: a follow-up file is added on the fix or feature branch before the person approves the PR, and `omni ship` refuses before the feature PR is marked ready, never after.
- BL-ASK-1 — An answer a person gave is never changed or reworded afterwards. Kept: a review follow-up copies the person's comment word for word under `## Asked`, beside its thread url, and the agent's words sit apart under `## Agent's note`; there is no option to write the point in the agent's own words.
- BL-GATE-1 — A check that ends without deciding says so in its result: "not judged", with the reason; it never shows a pass. Kept: `omni ship` prints `not judged: could not read the review threads …` and exits 1 when GitHub cannot be read.
- The `later` reply's outbox item touches the gate's laws (owners for each: @pierrederval or @dervalp approve the pull request that changes it):
  - BR-PRODUCT-3: an agent never applies the override label itself. If broken, an agent waves its own postponement through. Kept: nothing here applies a label.
  - BR-PRODUCT-5: a feature stays a draft while any question is open. If broken, a person merges a PRD whose postponed comment nobody agreed to. Kept: the high item holds the feature PR draft.
  - BR-PRODUCT-6: the live check always reads the changed files. If broken, a risky change nobody explained reaches main. Kept: untouched.
  - N-PRODUCT-3: a question an agent raises is graded by the gate's own check before it is written. If broken, a badly ranked postponement slips past. Kept: the item goes through the `omni item new` writer and its check.
  - N-PRODUCT-4: a pull request never changes the rules it is judged by. If broken, a change switches its own gate off. Kept: the gate's rules are not changed, only a new item kind is ranked.
  - N-PRODUCT-14: the terminal checks always compare with the base branch. If broken, a rule loses its test unnoticed. Kept: untouched.

## Acceptance criteria

1. `omni follow-up add --source 'bug #12' --text 'The retry loop never stops.'` writes one file under
   `.omni-loop/delivery/follow-ups/` with that source, today's date and that text; run again, it
   refuses and names the file.
2. `omni bug <n>` prints `not ok` and one line naming the bullet when `bug.md`'s `## Still open`
   holds a point with no follow-up file; `ok` once the file exists.
3. `omni bug check --product <key> <file>` refuses the same way for source `<key>-B<n>`.
4. `omni care reply --verdict later --prd <n> --thread <id> --file <f>` posts a reply ending with
   `<!-- omni-care: later -->`, resolves the thread, writes the follow-up file, its `## Asked` the
   person's comment word for word and its `## Agent's note` the reply, and records one
   outbox item ranked high in PRD n's outbox asking a person to agree to postpone it.
5. `omni ship <n>` refuses while a `later` reply on the PRD's pull requests has no follow-up file,
   naming the PR; it refuses a `later` reply with no outbox item of its thread; it ships once both
   exist and the item is answered; when GitHub cannot be read it prints
   `not judged: could not read the review threads of PRD <n>'s pull requests: <why>`, exits 1 and
   never shows a pass.
6. `omni status` shows `follow-ups  N open · oldest <date> → omni follow-up list` when points exist,
   and no follow-ups line when none do.
7. No command of this PRD calls GitHub to write, opens an issue or sends a notification
   (`omni follow-up` makes no network call; tests inject `exec` and assert no `gh issue`).
8. `/omni:bug-fix`, `/omni:mega-bug-fix` and `/omni:pr-care` say when to write a point and with which
   command.
