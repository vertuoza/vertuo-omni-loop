---
concept: 1964
title: The Anti-Loop
kind: product
scale: vast
---

## The brief

The Omni Loop goes forward: idea → PRD → inbox → building → outbox → shipped → retro. The person
asked for an **anti-loop** that runs it in reverse. It starts from a shipped PRD and rewinds
retro → PRs → CI → plan → slices → spec.

What the person said:

- It answers all four questions, in this priority order:
  1. Has the knowledge base drifted?
  2. Why did CI go red?
  3. Why did a PR need a human review?
  4. Is that code even required?
- It runs on each shipped PRD **and** continuously, sweeping the whole repository on a schedule.
- They wanted an illustration first, and loved the ∞ sketch: the forward loop in cyan, the
  anti-loop in magenta, the two meeting at SHIPPED.
- At the crown:
  - Anti-loop mode switches the UI to the anti-loop colours under the Omni theme.
  - The OMNI LOOP logo stays the same mark, mirrored onto the other side, with the wordmark reading
    ANTI LOOP, and its ring in anti-loop colours.
  - The game gets an anti-loop game in which you play the "mean guy", anti-heroes in the spirit of
    a conqueror race from comics.

What was assumed:

- It is read-only on the evidence, proposes and never merges.
- It never locks a law.
- It reuses the kit's tools (the retro, `kb status`, fallow, the CI logs).
- Its users are the people who run the loop (maintainer, PM) and the loop itself, whose findings
  feed the playbook and the next idea.
- Success: every finding ends in an action (a KB line, a guard, a question to an owner), and over
  time there are fewer reds and fewer review rounds per PRD.
- The anti-hero faction is our own, inspired by the archetype only: no name, likeness or design
  from any comic.

## The vision

**The Anti-Loop: one ledger of lessons, two entrances, one place to see it.**

- **Forward entrance: the fix carries its lesson.** When a commit turns a red check green, or a
  person resolves a review thread, a neutral check `omni / lesson` asks which lesson the fix
  carries. It never blocks a merge.
  - Before drafting, it looks for a KB line on those paths. If one exists, it asks "a rule existed:
    why didn't it hold?" (not read, unclear, or no check before CI), and each answer routes to a
    different fix.
  - The answer opens a sibling `omni:lesson` pull request that a person reviews and merges, so no
    slice leaves its territory.
  - "No lesson" is one click and is remembered.
  - Landed lessons move left: `/omni:plan` forewarns each slice whose territory touches a lesson's
    paths, and a pre-commit hook checks (never regenerates) what a lesson guards.
- **Rewind entrance: catch what slipped.** When a feature PR merges, the retro gets a `recommend`
  step that links its findings to earlier ones by cause.
  - The first echo is real: PRD 1628 F1 (`check` red on 3 commits, #1649) and PRD 1322 F1 (red on 7
    commits, #1349). Both were hand-edited database types drifting from the migrations.
  - The guard (`scripts/supabase-types.ts --check`) has existed since PRD 725. The lesson never
    landed: no KB rule says it, and `generated:` omits the file.
  - A weekly inverse sweep finds lessons without any retro: a guard with no rule, rules with no
    `Governs:`, and a baseline entry to recheck.
- **The place to see it: `/knowledge › Lessons`.**
  - Each lesson is a card: never landed → unsworn (its KB line merged, Proposed) → shining (an
    `Enforced by:` test, and a person locks it). It can also be cracked or kept on purpose.
  - Each card carries a journey strip whose nodes are the facts.
  - Counts are copied from evidence, never a rate: never landed 3, landed 1, kept on purpose 1, read
    10 of 171 retros.
- **Per PRD: the Rewind tab.**
  - Plain words first for the PM ("Lesson repeated: regenerate types, first seen in 1322"), then
    claims.
  - File questions are folded behind "for the agents". It never proposes a deletion.
- **Anti-loop mode: Rewind Light.**
  - On Lessons, the Retro and Rewind tabs and the game, under the Omni theme, six tokens remap:
    magenta takes the signal, the Recommended badge takes yellow, and errors stay red.
  - The lockup flips from `[mark] OMNI LOOP` to `ANTI LOOP [mirrored mark]`, the ring in anti-loop
    colours, in one 360 ms wipe.
- **The anti-hero game: Breach Night, with The Assay.**
  - You play **The Recurrent**, a conqueror race that can only land where something keeps happening
    again: "We return where you never learned."
  - They raid planets whose lesson never landed. The raid is The Assay: dive at the repository's wall
    of lessons, where landed lessons hold and gaps breach.
  - A breach is a wound. Defenders repel it only by landing the lesson, which closes the wound and
    pays them.
  - The villain earns a trophy, never points: playing a game never earns XP.

**Its wow moments:**

- The lesson lands at the fix, and its card flips from *never landed* to *unsworn*, then to
  *shining* when a person locks it, the journey strip lighting up node by node.
- The warlord landing on 1628 is visibly the same invader that landed on 1322, one rank larger,
  because the lesson never landed.

## Why this one

**Scores.** Round 3, on the merged prototype, 1–5, panel average: Wow 4.3 · Value 4.8 · Craft 4.2 ·
Fit 4.8 · Feasibility 3.6. All four critics and four of five personas would crown it.

**Stances:**

- **Visionary:** crown it, with Lessons as the opening frame and hub.
- **Craft:** crown it once the phone overflow and the Proposed/Locked contradiction are fixed. Both
  are fixed in the vision tour.
- **Skeptic:** crown it, scoped to the wedge; the claim map stays "coming".
- **Value:** crown it. The counts are truthful, and the neutral check removes the friction risk for
  `offering#316`.
- **Personas:**
  - F-E Developer: for. The lesson is a hunk a person reviews.
  - B-E DEv: for. Draw the silence.
  - Paul - Product Manager: for, through Forewarned with no extra PR in the queue.
  - Lead Engineer: strongly for. One ledger.
  - Irisa: for, once file questions fold away for the PM, which the tour does.

**Round 4, the look and the game.**

- **Mode.** Craft, the Skeptic, Value and four personas picked Rewind Light over Side B. The person
  found Side B "too much" and asked for the mirrored lockup.
- **Game.** The person picked Breach Night with The Assay as its raid. The critics favoured Breach
  Night (its win is a real merge); three personas preferred The Assay.

**Dissent, kept:**

- The developers distrust any model verdict that does not cite the lines it read.
- B-E DEv calls the game "fluff".
- Feasibility rests on matching findings by cause, and on backfilling retros: only 10 of 171 shipped
  PRDs have one.
- The Visionary wanted Side B's screenshot.
- The Skeptic wanted the fix check, not the retro echo, as the wedge. The Value critic wanted the
  Lessons screen first.

## Killed and why

- **A · Hindsight Forge:** replay one guard across all shipped PRDs. The guard it forged already
  existed, and its "9/171" was invented. It survives as proof inside each lesson PR.
- **B · As-Built:** code read back into a spec. Its demo proposed a false deletion (the spec claims
  `job-<id>.jsonl`). It survives as the Rewind tab, which asks and never deletes.
- **C · Black Box:** an NTSB-style investigation of one PRD. The aviation costume was dropped. Its
  recommendation grammar and cross-PRD link became the retro's echo.
- **D · The Dig:** a nightly trench, one layer per PRD. The strata encoded nothing. "Which layer
  buried it" survives in the inverse sweep.
- **E · The Oath Deck:** KB lines as cards that age. The deck was dropped. Its states became the
  Lessons states.
- **F · Entropy Hunt:** recurrences as bosses with XP bounties. It read as a gimmick, and the XP was
  invented. Recurrence as a wound survives in Breach Night.
- **G · The Reaper PR:** the only output is one deletion PR. Its deleted files did not exist. Split
  PRs survive as the sibling lesson PR.
- **H · The Ghost Check:** a check that argues before merge. Merged into the fix's lesson check and
  Forewarned.
- **Y · The Warrant:** every file needs a warrant. It leads on the person's last priority, and
  reading every file by model is costly. Its inverse sweep and question queue were grafted in.
- **Z · The Fix Carries Its Lesson:** merged as the forward entrance.
- **T2 · Side B:** a mirror world for anti-loop mode. The person found it "too much"; the mirrored
  lockup survives.
- **G2 · The Assay as its own cabinet:** folded into Breach Night as its raid.

## Fuel

**Product facts read:**

- the design form and the craft floor;
- the screen library (all drafts; `prd-dossier`, `app-shell`, `planet-overlay` relevant);
- the 10 shipped `retro.md` files;
- `kb status` (189 laws, 20 proposals, 59 stale citations, 10 rules with no `Governs:`);
- `scripts/supabase-types.ts`, which needs a running local database;
- `.omni-loop/config.yml › generated:`;
- the `ci` form's empty Known reds, and the missing `review` form;
- `game/README.md` (playing never earns XP), `game/rulebook.ts`, `game/events.ts`;
- `packages/design/src/tokens.ts` (the Omni signal is yellow) and `packages/design/src/logo.ts`;
- PRD 1904's 52 files.

**References**, each seen as a web-search result (none opened):

- Google SRE book, Postmortem Culture: https://sre.google/sre-book/postmortem-culture/
- Google SRE Workbook, Postmortem Culture: https://sre.google/workbook/postmortem-culture/
- DORA, the history of the metrics: https://dora.dev/guides/dora-metrics/history/
- Thoughtworks Radar, DORA metrics: https://www.thoughtworks.com/radar/techniques/dora-metrics
- Trunk, flaky-test quarantining: https://docs.trunk.io/flaky-tests/quarantining
- Swarmia, time to review: https://help.swarmia.com/features/metrics/pull-request-cycle-time/time-to-review
- GitLab #35924, review cycles: https://gitlab.com/gitlab-org/gitlab/-/issues/35924
- Swimm, code-coupled documentation: https://docs.swimm.io/new-to-swimm/benefits-of-code-coupled-documentation
- InfoQ, fitness functions: https://www.infoq.com/articles/fitness-functions-architecture/
- Knip: https://knip.dev
- Undo.io, time-travel debugging with rr: https://undo.io/resources/gdb-watchpoint/time-travel-debugging-rr-debugger/
- Chromium Chronicle #13, rr: https://developer.chrome.com/blog/chromium-chronicle-13
- Hudl, Coach Tagging: https://www.hudl.com/blog/new-coach-tagging-feature-enhances-hudl-replay
- NTSB, ASR2004: https://www.ntsb.gov/investigations/AccidentReports/Reports/ASR2004.pdf
- git bisect: https://rtime.ciirc.cvut.cz/gitweb/git.git/blob_plain/57886bc:/Documentation/git-bisect.txt

**Business claims cited:** `offering#316`, `rival#44`.

**Prerequisites the areas name:**

- backfill retros beyond 10 of 171;
- seed the missing `review` form.

**Side finding:** PRD 1904's migration is dated in the future (`20261208090000_runner_job_lines.sql`).

## Areas

| id | area | brief | PRD |
|---|---|---|---|
| retro-echo | Echo and land | The retro's recommend step links findings across PRDs by cause and opens the first lesson PR, for types drift: a ci.md Known-reds line and database.types.ts under `generated:`. | |
| lesson-check | The fix asks its lesson | A neutral `omni / lesson` check on red→green fixes and resolved review threads opens a sibling lesson PR; "No lesson" is remembered; Forewarned in /omni:plan; a pre-commit check. | |
| lessons-hub | Lessons, in anti-loop mode | /knowledge › Lessons (five states, a journey strip of facts, the weekly inverse sweep, Land it), in anti-loop mode: Rewind Light tokens, the mirrored ANTI LOOP lockup, one wipe. | |
| rewind-tab | Rewind | A PRD page tab: plain words and claims for the PM, file questions folded for the agents, never a deletion. | |
| breach-night | Breach Night | The Recurrent raid never-landed planets through The Assay; a breach is a wound closed and paid on landing the lesson; the villain earns a trophy only. | |
