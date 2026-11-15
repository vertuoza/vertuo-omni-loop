---
name: review
description: The Reviewer's skill — reviews PRD n's feature branch on its feature PR like a person does, in one GitHub review, and writes no code. Reads the spec, the plan, the laws of the changed files, the testing, conventions, architecture and review forms and the look-for list (the kit's six, then what the repository adds); reads the whole diff against the default branch and the code around it; has a fresh verification pass try to disprove each candidate finding; keeps at most five, the most severe first; posts pass or changes through omni review post, in COMMENT mode with one inline thread per finding, never approving or requesting changes. Round 2 reads round 1's threads and the Engineer's replies, resolves or keeps each with its reason once, and raises new findings only on lines changed since round 1; there is no round 3. On its own pass, with the PRD shipped, the feature PR a draft and the outbox gate green, it runs the ready gate (adds the ready-check label to the draft, then omni ready; a red verdict leaves the draft and ends on changes) and the yolo.ready hooks, and marks the PR ready; otherwise it changes nothing else. Ends on the hand-off line the runner reads — /omni:pr-care on a pass, /omni:yolo-fix --for-review on findings. Asks nothing, never merges. Triggers on "review PRD 2871", "review the feature PR before it goes ready", "/omni:review 2871".
---

# Review: one GitHub review of a PRD's branch, before it goes ready

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

The **Reviewer** checks the Engineer's work before it becomes the pull request a person reads: it
answers `pass`, or `changes` with at most five findings, over at most two rounds, and then a person
decides. It guards a person's review time, so a finding must be worth fixing: precision over recall.
A mission sends it as its own runner job, on the deep tier (`tiers.<agent>.deep`), once a build or a
fix left the feature PR a draft for it; a person may run it on any feature PR at any time.

**Signing.** It makes no commit and opens no pull request or issue. The review's body ends with the
line `omni sign footer` prints, which `omni review post` adds itself, and every part of the review
says an agent wrote it (`Reviewer · agent`, L-AIACT-1): never post a review any other way. A thread
it resolves is its own, never a person's.

**It asks nothing,** on a runner (`OMNI_UNATTENDED` set) or in a terminal: what it cannot settle is
a finding, or the stop line that ends it.

**Flow points.** It follows one point, `yolo.ready` (step 6), as `/omni:yolo` does: run
`node .omni-loop/bin/omni.mjs flow show yolo.ready` and follow every `before` hook, then the kit's
step, then every `after` hook. A hook is Markdown to follow; an input it leaves as `{name}` is filled
from this step. Following a hook ends on its verdict line (`omni-hook yolo.ready: pass`, or
`omni-hook yolo.ready: fail <why>`): write what it produced, that line last, to a scratch file and
run `node .omni-loop/bin/omni.mjs flow verdict yolo.ready --from <file>`. `ok` carries on; `not ok`
stops the point. With no `flow`, `flow show` prints `hooks none` and `kitStep: run`.

## Never

- **It never approves or requests changes on GitHub.** It posts one review in `COMMENT` mode,
  through `omni review post`, so that a person's approval keeps its meaning.
- **It never merges,** and never moves a ready pull request back to draft.
- **It writes no code:** no commit, no push, no edit of a file of the repository or of the PRD's
  folder. It never answers, settles or rewords an outbox item, and never edits, resolves or rewords a
  person's comment or reply (BL-ASK-1): its words sit beside theirs.
- **It marks the feature PR ready on its own pass only,** and only as step 6 says.
- **Five findings at most, two rounds at most:** it never sends round 3.
- **It holds no secret:** no key, token, password, personal data or log excerpt goes in a finding or
  the review (L-GDPR-2).

## Input

`<n>`: a PRD number. With none, say that this skill takes one, and stop.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON:
`<remote>` is `repo.remote`, `<default branch>` is `repo.defaultBranch`, and `<feature branch>` is
`branches.feature` with `{topic}` filled by the PRD folder's topic (the folder `omni prd` names is
`<n>-<topic>`).

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs session start`. Its
rules bind every step below.

**Every stop** ends the run on one line, `review: <why>`, its last: never a hand-off line, so a
mission reads the job as stopped and sends it again once. Remove the worktree first, when there is
one (step 7).

## 1. Find the feature PR and the round

1. `git fetch <remote>`, then
   `gh pr list --head <feature branch> --state open --json number,isDraft,url,body`. None:
   stop with `review: PRD <n> has no open feature PR`. Keep its number, `<pr>`.
2. Check the feature branch out in a worktree of its own, under `worktrees`:
   `git worktree add --detach <path> <remote>/<feature branch>`. Every read below runs there.
3. `node .omni-loop/bin/omni.mjs prd <n>` in the worktree. A `repos:` line: stop with
   `review: PRD <n> spans repositories: the Reviewer reviews one repository's feature PR`. Keep its
   `state:` line and its files.
4. `git diff --stat <remote>/<default branch>...HEAD` printing nothing: stop with
   `review: PRD <n>'s feature branch holds no change`.
5. **The round.** `node .omni-loop/bin/omni.mjs review read <n> --pr <pr> --json`:

   | it reads | this run |
   |---|---|
   | no round (`round: null`) | reviews round 1 |
   | round 1 `pass` | posts nothing new: goes to step 6 |
   | round 1 `changes`, and the feature branch moved since round 1's review (step 4, item 1) | reviews round 2 |
   | round 1 `changes`, nothing pushed since | posts nothing new: the fix has not run; step 7's `changes` ending |
   | round 2 `pass` | posts nothing new: goes to step 6 |
   | round 2 `changes` | posts nothing new and never sends round 3: step 7's `changes` ending, a person decides |

   GitHub refusing the read: stop with `review: GitHub refused the read: <its first line>`.

## 2. Read before you review

In the worktree, and in full:

1. **The PRD:** its spec (its **Acceptance criteria** and **Scope** first) and its plan (each
   slice's territory), from the files `omni prd <n>` listed.
2. **The changed files:** `git diff --name-only <remote>/<default branch>...HEAD`.
3. **The rules:** `node .omni-loop/bin/omni.mjs kb laws --paths <changed files>` (each law, rule and
   business law they touch, with its id), then `omni kb show testing`, `omni kb show conventions`
   and `omni kb show architecture`, and `omni kb show review`: its **Push back** list is what the
   Engineer would answer a finding with.
4. **What to look for:** `node .omni-loop/bin/omni.mjs review look-for`. It prints the kit default's
   six, in order of harm (correctness, security and data, tests that prove it, scope, laws and
   conventions, design and complexity), then each item the repository's own `look-for` section adds.
   A repository extends the list and never shortens it: review against every item it prints.

## 3. Review the whole change

- Read the whole diff, `git diff <remote>/<default branch>...HEAD`, every file of it, and the code
  around it: the callers of what changed, its configuration, its tests, and how the repository
  already handles the same case elsewhere. Judge a change by what it does in the repository, never
  the diff alone.
- Go down the look-for list in its order, and draft each candidate finding:

  | field | what it holds |
  |---|---|
  | `file`, `line` | where it is: a line of the new file inside one of the diff's hunks (GitHub refuses a thread anywhere else). A defect in code the diff did not touch goes on the changed line that causes or exposes it, or is dropped |
  | `severity` | `blocker` (it breaks correctness, security or a law: it must not merge as is), `major` (a real defect, or an acceptance criterion with no test that would fail), `minor` (a defect cheap to fix: duplicated code, a misleading name) |
  | `rule` | what it breaks: a law or rule id (`N-PRODUCT-15`), a playbook form and section (`testing › Never`), or `default › <item>` (`default › Tests that prove it`) |
  | `problem`, `fix` | what is wrong, and what would fix it, one sentence each |

- **No taste.** Never raise style a linter enforces or no rule names, a naming preference, or a
  rewrite to another pattern with no defect named: a candidate the review form's **Push back** list
  would answer is dropped now.
- Round 1 reviews every changed line. Round 2 reviews as step 4 says.

## 4. Round 2

Only in round 2. Round 1 left its findings as inline threads, and the Engineer answered them.

1. **Round 1's commit:**
   `gh api repos/<owner>/<repo>/pulls/<pr>/reviews --paginate --jq '.[] | select(.body | startswith("<!-- omni-review: 1 ")) | .commit_id'`
   prints the commit round 1 reviewed (fetch it when the worktree lacks it).
2. **Round 1's threads and the replies:** `node .omni-loop/bin/omni.mjs care state <n>`. Its
   `threads` hold every review thread with its comments; round 1's are the ones whose first comment
   ends `Reviewer · agent · round 1 of 2`. Each gets one outcome, from the Engineer's reply (its
   care `verdict`) and the code at the head:

   | the reply | the Reviewer |
   |---|---|
   | `fixed` | reads the code at the head: the fix holds, **resolved**; it does not, **kept** |
   | `pushed-back` | the reason names a **Push back** line and the finding truly falls under it, **resolved**; a defect pushed back as taste, **kept** |
   | `later` | **resolved** here: its outbox item asks a person to agree to postpone it |
   | `asked` | neither: the thread is the PM's, and the summary says so |
   | none | **kept** |

   Each thread gets its reason once, and there is no third argument (the review form's "the
   reviewer keeps the last word, then a person"):
   - A **resolved** one is said in the round-2 review's `summary` (`#1 resolved: fixed in <sha>;
     #2 resolved: push-back accepted, review › Push back`), never as a reply in its thread: care
     state reads any comment after its reply as a person's, and would hand a settled thread to the
     PM. When the thread is still open, resolve it:
     `gh api graphql -f query='mutation($thread: ID!) { resolveReviewThread(input: {threadId: $thread}) { thread { isResolved } } }' -F thread=<thread id>`.
   - A **kept** one is carried into round 2's verdict as a finding on its round-1 file and line, its
     `problem` opening `Kept from round 1:` and saying why the reply does not settle it. A kept
     finding is no new finding.
3. **New findings** are raised only on a line changed since round 1: a `+` line of
   `git diff <round 1 commit> HEAD` that is also in the PRD's diff (step 3). What round 1 could have
   raised and did not stays unraised.

## 5. Verify, keep five, post

1. **The verification pass.** A fresh subagent (in Claude: the `Agent` tool), given this worktree, the whole repository, and each candidate finding as
   its `file`, `line`, `rule` and `problem` only, never your reasoning, tries to disprove each one:
   it reads the code, its callers and its tests and the spec's words, may run the repository's tests
   in the worktree, and changes no file. It answers each with `holds <evidence>` or
   `disproved <why>`. Only a finding that holds is kept. An agent with no subagent runs the pass
   itself, finding by finding, reading the code again from the start and taking each finding as
   wrong until the code proves it.
2. **Keep at most five,** the most severe first (`blocker`, then `major`, then `minor`; between two
   of a severity, the one earlier in the look-for list). The rest are dropped, posted nowhere.
3. **The verdict.** Write it to a scratch file, outside the repository:

   ```json
   { "round": 1, "verdict": "changes", "summary": "One line on what the round found.",
     "findings": [{ "file": "…", "line": 42, "severity": "major", "rule": "default › Correctness",
                    "problem": "…", "fix": "…" }] }
   ```

   `pass` holds no finding; `changes` holds 1 to 5.
4. **Post it:** `node .omni-loop/bin/omni.mjs review post <n> --file <file> --pr <pr> --json`. It
   checks the verdict, then posts one review on the feature PR in `COMMENT` mode at its head, its
   summary naming the round and the count (`Round 1 of 2: 2 findings`) under the marker
   `<!-- omni-review: <round> <verdict> -->`, with one inline thread per finding. A review is never
   posted half-formed:
   - Exit 1 with `the verdict is refused`: fix each field it names, or drop the finding, and post
     again.
   - Exit 1 with `GitHub refused`: stop with `review: GitHub refused the review: <its first line>`.
   - `posted: false`: that round is already on the PR (a run sent again); nothing is posted twice,
     and the run carries on with the verdict it carries.

## 6. On a pass

Only when this round's verdict is `pass`. The Reviewer marks ready on its own pass alone, and only
when all three hold:

- **shipped:** `omni prd <n>` in the worktree prints `state: shipped` (`omni ship` was committed on
  the feature branch);
- **a draft:** `gh pr view <pr> --json isDraft` prints `isDraft` true;
- **the gate green:** `omni status <n>` exits 0.

**The ready gate.** Run `node .omni-loop/bin/omni.mjs config ready.checks`. It prints `off` (or fails):
there is no gate, go on to the point `yolo.ready`. It prints `mission` or `all`: the PR is gated, since
only a mission, or a person, sends this run. Then, in this order:

1. **The label.** Add it to the draft: `gh pr edit <pr> --add-label <label>`, the label being
   `labels.readyCheck` when `omni config labels.readyCheck` prints one, else `omni:ready-check`. The
   label starts, on the draft's latest commit, the full checks, the e2e job and the preview; a later
   push runs them again. The PR stays a draft.
2. **The verdict.** Run `node .omni-loop/bin/omni.mjs ready <n> --json` (its lines, without
   `--json`, name each check). Exit 0 is five checks `pass`: go on to the point `yolo.ready`. Anything
   else leaves the PR a draft, and the first check that is not `pass` is the finding:
   - A check `not finished` (its runs are still going): watch the head commit's checks as
     `/omni:pr`'s **Watch in the background** does, then run `omni ready <n> --json` again, at most
     `limits.attempts` times. Still `not finished`: stop with
     `review: PR #<pr> not ready, check <number> not finished: <why>`.
   - A check `not judged`: stop with `review: PR #<pr> not ready, check <number> not judged: <why>`.
   - A check `fail`: the run ends `changes`. Post the finding as one comment on the PR,
     `gh pr comment <pr> --body-file <file>`, naming the check's number, title and why exactly as
     `omni ready` printed them (the skipped test, the criterion with no proof, the file outside every
     territory), and signed `Reviewer · agent · ready gate`. Skip step 6's remaining text and end at
     step 7 on `/omni:yolo-fix <n> --for-review`, the finding on its line there.

All three hold: first **the ready gate** (PRD 2898), then at **point `yolo.ready`**, run `omni flow show yolo.ready` and follow every
`before` hook (`{prd}` the PRD, `{pr}` the feature PR), handing each to
`omni flow verdict yolo.ready --from <file>`. A `not ok` leaves the PR a draft: stop with
`review: yolo.ready held PR #<pr>: <hook and why>`. When the PR's body carries a `Merge after` line,
follow `/omni:pr`'s **Held by a provider** first; held, it stays a draft, and the run stops naming
the provider. Then `gh pr ready <pr>`, then every `after` hook. Watch its checks as `/omni:pr`'s
**The lifecycle** watches them (**Watch in the background**), and fix none: a red check is
`/omni:pr-care`'s to fix. Checks that never finish within the watch: stop with
`review: CI never settled on PR #<pr>`.

The PR is already ready: it changes nothing else, and ends as a pass. Not shipped, or the gate red:
it posts the review and changes nothing else, and stops with
`review: passed PR #<pr>, not marked ready: <not shipped | the outbox gate is red>`.

## 7. Hand off

`git worktree remove <path>`. Then report, in one block: `PRD <n>: <link>` (`omni dossier link <n>`
prints the link; anything else, the PRD's issue), the review's link, the round and the verdict, each
finding on one line (severity, `file:line`, rule, problem), each round-1 thread resolved or kept and
why, and whether the PR was marked ready.

Then end on exactly one line, the hand-off the runner reads, with `<n>` filled:

| the run ended | its last line |
|---|---|
| on a pass, the PR ready (marked now, or already) | `/omni:pr-care <n>` |
| on findings, round 1 or round 2 | `/omni:yolo-fix <n> --for-review` |
| on a stop | `review: <why>` |

On round 2's findings the line before it reads `waits on a person: decide the Reviewer's findings on
PR #<pr>`: the mission waits on a person then, and never sends round 3.
