---
prd: 487
title: A retro or knowledge PR opens only when it adds lasting knowledge
blocked-by: none
spec: file
---

# A retro or knowledge PR opens only when it adds lasting knowledge

**Date:** 2026-09-28 · **PRD:** #487 · **Follows:** PRD 72 (the retro), PRD 82 (the knowledge
harvest) · **Touches:** the GitHub App's retro (`apps/omni-app/src/retro/`) and knowledge harvest
(`apps/omni-app/src/knowledge-harvest/`), and the kit's harvest classifier
(`kit/lib/knowledge/classify.mjs`, `kit/lib/knowledge/pipeline.mjs`). No migration, and no change to
the galaxy app or the game.

## Problem

After every feature PR merges, the omni-loop app opens a retro PR and a knowledge PR. Most of
them are closed without being merged:

- **Knowledge PRs:** 7 of the last 15 were closed (#469, #409, #408, #319, #306, #300,
  #299). **Each closed one promoted nothing:** it held only "Stays here" lines, which the
  harvest writes into the PRD's ledger for candidates it did not promote. Four of them were a single
  line. The classifier already recognised these candidates as local choices; the PR opened anyway,
  because writing a "Stays here" note counts as an edit.
- **Retro PRs:** 11 of the last 18 were closed (#467, #446, #406, #402, #318, #305, #298, #296,
  #249, #234, #198). The closing comments give three reasons:
  - no finding at all, only the timeline and check dumps (#402);
  - findings that repeat a known pattern: a slice edited a file outside its territory, or the same
    lines were rewritten across slices (#467, #446, #406);
  - findings about how the product looks: one CSS line in `app-bar.css` rewritten three times, and
    `AppBar` markup and the test lines following it (#467, F2 to F5).
- Each retro finding also opens a retro issue (#462 to #466 for PRD 438), whatever it is worth.
- The knowledge base also holds entries that describe the look rather than the behaviour, for
  example `BR-PRODUCT-33` ("wide: ten columns and four shields; tall: six and three"). Such an
  entry changes every time a screen is redrawn, so it cannot be relied on.

A PR opened for its own sake costs a review, then a close. The knowledge base should stay stable
when a screen changes shape or colour.

## Solution

**The retro asks the model whether it teaches anything new, and opens a PR only when it does.**

1. **The judge.** The `narrate` call, which already writes the retro's prose, now also returns a
   verdict. Along with the findings, it is given:
   - a summary of the knowledge base: the id and one line of every register entry and ADR;
   - the lessons of the retros already merged: every `lessons[].text` in the `retro.json` files
     under `paths.delivery`'s shipped folder at the merge commit.

   Its reply gains `verdict: { worthIt: boolean, reason: string }`, and each finding's entry gains
   `keep: boolean` and `why: string`. The prompt keeps a finding only when its lesson is **new**
   (neither in the knowledge summary nor in an earlier retro's lessons) and **about behaviour, not
   look** (the shared rule, point 6).
2. **The guard.** `guard` checks the verdict like any other field:
   - `worthIt` is a boolean and `reason` a string within `FIELD_CAPS.reason`;
   - `worthIt: true` needs at least one finding with `keep: true` and a lesson.

   A verdict that fails any check is dropped with its reason, and the retro counts as **not judged**.
3. **Worth it.** The retro branch, `retro.md`, `retro.json` and the retro PR open as they do today.
   `retro.md` still lists every finding; each kept finding is marked kept, with its `why`. Retro
   issues open **only for kept findings**, worst first, at most `ISSUES_PER_RUN`.
4. **Not worth it, or not judged.** No branch, no files, no PR, no issue. The retro instead
   upserts **one comment on the merged feature PR**, marked `<!-- <markers.prefix>-retro-verdict -->`,
   so a replay rewrites it rather than adding a second. It says, in order:
   - `Retro: no new lesson — <reason>` or `Retro: not judged — <reason>`;
   - the timeline in two lines: the feature PR's minutes from open to merge, and the slice and wave
     counts;
   - one line per finding: its id, title and key.
5. **The day-14 run** is judged the same way, on both runs' findings:
   - worth it, with the merge run's PR still open: it commits to that PR, as today;
   - worth it, with no merge-run PR (the merge run was not worth one): it opens the PR then;
   - not worth it: it rewrites the verdict comment.

**The knowledge harvest opens a PR only when something became knowledge.**

6. **One rule for the look,** held once in the kit (`kit/lib/knowledge/look-rule.mjs`, exported as
   `LOOK_RULE`) and quoted in both the harvest's classifier prompt and the retro's judge prompt:

   > An entry states what the product does and guarantees, never how it looks: no colour, size,
   > layout, position, count of visual elements, font, or exact label or copy. A candidate that is
   > only about the look stays local. A candidate that mixes both is written as the behaviour alone.

   `omni harvest`, run on a computer, uses the same pipeline and so the same rule.
7. **No promotion, no PR.** When a harvest places no candidate as a new register entry or an ADR
   (every candidate is "stays here", "covered" or not placed), `finishHarvest` returns no edits:
   the "Stays here" notes are not written. The app then opens no branch and no PR, and upserts a
   comment on the merged feature PR, marked `<!-- <markers.prefix>-knowledge-verdict -->`:
   `Knowledge: nothing new — <n> candidates stayed local.` A harvest that promotes at least one
   entry writes everything, "Stays here" notes included, and opens its PR as today.

## Decisions

- **The model judges** whether a retro is worth a PR. A fixed rule by kind of finding was
  considered and not chosen; the model is given the knowledge base and earlier lessons so that
  "new" means something.
- **No verdict means no PR.** When the model cannot be asked, or its verdict is refused, the retro
  takes the quiet path (point 4), with `not judged` and the reason in the comment.
- **Issues follow the verdict:** a retro issue opens only for a kept finding, and only with a PR.
- **Two comments, one per function.** The retro and the harvest are separate Inngest functions
  that can finish at the same moment. Two functions editing one comment could drop each other's
  section, so each keeps its own marked comment.
- **Behaviour yes, look no,** for both the retro and the harvest (point 6).
- **Forward only.** Existing knowledge entries that describe the look are left as they are; a later
  PRD may retire or rewrite them.
- **The detectors are unchanged:** what counts as a finding (`rules.mjs` thresholds and kinds)
  stays as it is. Only what is published changes. `RULES_VERSION` does not move; the judge prompt
  carries its own version, `JUDGE_VERSION = 1`, written into `retro.md`'s front matter as `judge: 1`.

## User stories

- As the person who merges feature PRs, I see a retro PR only when it has a lesson I do not
  already have, so I merge it instead of closing it.
- As the same person, I see a knowledge PR only when it adds a register entry or an ADR.
- As anyone reading the knowledge base, I find rules about what the product does, which stay true
  when a screen is redrawn.
- As the same merger, when nothing was worth a PR, one short comment on the feature PR tells me
  so and why, and lists the findings, so nothing is lost silently.

## Scope

In:

- `apps/omni-app/src/retro/`: `narrate.mjs` (the judge's input and reply shape), `guard.mjs` (the
  verdict), `retro.mjs` (the branch on the verdict for both runs), `issues.mjs` (kept findings only),
  `render.mjs` (the kept mark, `judge:` in the front matter, the verdict comment), `rules.mjs`
  (`FIELD_CAPS.reason`, `FIELD_CAPS.why`), and a new `verdict-comment.mjs` (upsert by marker).
- `apps/omni-app/src/knowledge-harvest/`: no PR and a verdict comment when there is no promotion.
- `kit/lib/knowledge/`: `look-rule.mjs` (new), `classify.mjs` (quote the rule; its prompt snapshot
  moves), `pipeline.mjs` (`finishHarvest` returns no edits without a promotion).
- The knowledge summary and earlier lessons the judge reads: a new retro step, `gather-knowledge`,
  reads the knowledge folder and the shipped `retro.json` files at the merge commit through the
  harvest's tree reader (`knowledge-harvest/github.mjs` › `withTreeAt`), and builds the summary
  with the kit's existing `knowledgeSummary` (`kit/lib/knowledge/classify.mjs`).

Out:

- Rewriting or retiring existing knowledge entries.
- Any change to the detectors, their thresholds or `RULES_VERSION`.
- The galaxy app's Retro tab, which reads `retro.md` when it exists and already shows nothing when
  it does not.
- The `omni:retro` and `omni:knowledge` labels, which stay as they are.

## Test seams

All tests run on fixtures against a stubbed GitHub and a stubbed model; none calls GitHub, Supabase
or OpenRouter (`omni kb show testing` › Never).

- **`narrate`** (unit): `modelInput` includes the knowledge summary, the earlier lessons and the
  look rule. `checkReply` accepts a reply with a verdict and `keep`/`why` per finding, and rejects
  one whose verdict is missing or has the wrong type.
- **`guard`** (unit): `worthIt: true` with no kept finding, or a kept finding with no lesson, drops
  the verdict with a reason. A `reason` past its cap is dropped.
- **`retro`** (the function against a stubbed GitHub, as `retro.test.mjs` does):
  - worth it: branch, files, PR, and issues for the kept findings only;
  - not worth it: no ref created, no PR, no issue, one comment with the marker;
  - not judged (no model key): the same quiet path, the comment reading `not judged`;
  - replayed: the comment is edited in place, never duplicated;
  - day 14 worth it with no merge-run PR: a PR opens.
- **Replay of PRD 438** (`test/github-replay.mjs` with a recording of #440's merge and a model
  reply that keeps nothing): it ends with the verdict comment and no PR.
- **`finishHarvest`** (unit, kit): candidates all "stays here" give `noEdits(edits) === true`; one
  promoted candidate gives every note written.
- **`knowledge-harvest`** (the function against a stubbed GitHub): no promotion means no ref, no
  PR and one comment with the marker, edited in place on a replay.
- **The look rule** (unit): the classifier prompt snapshot and the judge's system prompt both
  contain `LOOK_RULE` word for word.

## Risks

- **What merging publishes.** The GitHub App (`apps/omni-app`) deploys with the merge, and the kit
  (`kit/dist/omni.mjs`, `kit/plugin`) is republished as the next `v0.0.N`
  (`omni kb show releasing`). From the first merge after that, retros and harvests follow the new
  gate. Inngest is not affected: no function is added or renamed, so no resync is needed.
- **The model keeps too little.** A real lesson could be judged "known" and end up in a comment
  instead of a PR. The comment lists every finding, so it is still visible on the feature PR.
- **The model keeps too much.** It could still pass a known pattern. That is today's behaviour at
  worst.
- **Rollback.** Revert the feature PR's merge commit; the next merge opens PRs as today. No stored
  data changes shape: `retro.json` only gains optional fields.

## Acceptance criteria

- A merged feature PR whose retro the model judges not worth it gets no retro branch, PR or
  issue, and one comment on the feature PR starting `Retro: no new lesson —`, with the timeline and
  one line per finding.
- The same with no model key gives a comment starting `Retro: not judged —`, and no PR.
- A retro judged worth it opens its PR as today, and opens issues only for the findings marked
  kept.
- Replaying either run of the retro never adds a second verdict comment.
- A harvest where no candidate becomes a register entry or ADR opens no knowledge PR and writes no
  "Stays here" note; the feature PR gets one comment starting `Knowledge: nothing new —`.
- A harvest that promotes at least one candidate opens its PR as today.
- The harvest's classifier prompt and the retro's judge prompt both contain the look rule word for
  word.
- Replaying PRD 438's merge (#440) with a reply that keeps nothing ends with the verdict comment and
  no PR.
- Owed live: on the next three feature merges on this repository, every retro or knowledge PR the
  app opens is one the person merges.
