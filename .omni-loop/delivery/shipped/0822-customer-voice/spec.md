---
prd: 822
title: The customer voice
blocked-by: none
spec: file
---

# The customer voice

**Date:** 2026-09-30 · **PRD:** #822 · **From:** concept #746, area `customer-voice`, second of its
two PRDs (after PRD 799, the personas)
**Touches:**
- `kit/plugin/skills/think-big/SKILL.md`, `kit/plugin/skills/brainstorm/SKILL.md`,
  `kit/plugin/skills/yolo/SKILL.md`, `kit/test/plugin.test.mjs`
- `kit/lib/voice/` (new: the `voice.json` schema), `kit/lib/dossier/` (push the `voice` artifact)
- `kit/bin/commands/business.mjs`, `kit/lib/ask/client.mjs`, `kit/lib/help/entries.mjs`,
  `kit/test/fake-ask-server.mjs`, `kit/dist/omni.mjs`
- `supabase/migrations/` (one new file), `supabase/checks/business.sql`
- `apps/galaxy/app/api/business/claims/` (new), `apps/galaxy/src/business-api/`
- `apps/galaxy/src/dossier/` (the `voice` artifact and the User voice tab)

## Problem

PRD 799 gave each product a cast of personas, and agents can read them, but nothing speaks for them.
`/omni:think-big` still invents its User panelists on every run, and `/omni:brainstorm` never reads
the business at all. So a design for "a six-entity holding" reaches a phase-0 PR for a product sold
to five-plumber companies, and nobody in the room says so. When someone does push back, their answer
is lost when the session ends.

The person asked for the voice to be seen, not only heard: on the PRD's page, every persona's
verdict at every stage and every version, as a score that moves (3/5 → 5/5), with a way to rework
the PRD from that feedback.

## Solution

**The personas speak in think-big.** Step 2's fuel sheet copies the product's personas, from
`omni business show --json`, under ids `persona:<name>`, beside the claim ids. When the product has
personas, they are the panel's **User** panelists in place of invented ones: all of them up to five,
or the five that differ most in stance and trade. Each gets the User card filled from its own name,
stance, who and usage, scores and debates by name, and cites `persona:<name>` or a claim id in each
post. For each standing concept on each board, the persona it fits worst **objects once**: one or two
first-person sentences, each citing a persona or claim id. A sentence without a citation is dropped,
and the objection stays silent when every persona fits. The reshaped concept then gets a fit line
("fits persona:Marc ✓ · size#2 ✓ · beats rival#20 ✓"). Without personas, think-big runs as today.

**The personas speak in brainstorm.** Step 0 reads `omni business show --json` too. When the design
is shown (the Bounded design, or the Architectural design's first section), just before the approval
question, the persona it fits worst objects once, with citations, or stays silent when it fits. The
spec's Decisions record the objection and how it was settled.

**Overrule.** When the person answers an objection with a fact about the business ("we're going after
50-person firms now"), the skill asks through AskUserQuestion "Is that new about the business?", with
two options:
- **Save as a claim**: stored `proposed`, source `answer`, receipt `<skill> · <run>`, and confirmed
  later by a member on Settings › Business, where the bell (PRD 774) already counts it;
- **Just this run**: nothing is stored, and the personas accept the fact until the session ends.

**One gap question.** At most once per run, when the design leans on a kind (region, offering, size,
trade, rival) with no confirmed claim, the skill asks one question through AskUserQuestion, so ask
mode takes it to the page. Its options are the Business page's pick lists, then Other and Not sure.
The answer is stored `confirmed`, source `answer`. Not sure stores nothing, and the run carries on.

**The write.** `omni business claim add --kind <kind> --value <value> --state proposed|confirmed
--ref <text>` posts to a new bearer route, `POST /api/business/claims`, for the repository it runs
in. Like every `omni business` verb, it never blocks: any failure prints one skip line and exits 0.

**The record: `voice.json`.** Beside the spec, in the PRD's folder, one file keeps a **round** per
stage:
- `design`: when brainstorm shows the design;
- `spec`: when brainstorm has written the spec;
- `rework-<k>`: after each rework;
- `shipped`: when `/omni:yolo` reaches the green gate, before ready, judging the release note and the
  final before/after.

Each round holds the date, and for every persona its name, stance, a **score from 1 to 5** (how well
this stage serves them) and a reaction of at most two sentences with its citations. It also holds the
round's objection (the persona, the text, the citations, and how it was settled: `accepted`,
`saved-as-claim`, `just-this-run` or `none`) and the fit line. `omni dossier push` sends it as a new
artifact kind, `voice`, so every change is a version.

**The User voice tab.** The PRD's page gains a tab beside Spec, Plan and Before/after:
- one row per persona: portrait (PRD 799's sprite), name, stance chip, the latest reaction;
- one column per round, left to right: the score and its move from the round before ("3/5 → 5/5 ▲",
  "4/5 ▼", "5/5 ="); tapping a score shows that round's reaction;
- the round's objection is outlined, with how it was settled;
- a **Rework with this feedback** button copies `/omni:brainstorm --rework <n>`;
- without a `voice` artifact: "No voice yet: it appears once a brainstorm runs with personas".

**Rework.** `/omni:brainstorm --rework <n>` reads the PRD's latest round and rewrites the spec and the
before/after on the PRD's branch to answer its objection and its lowest scores. It then asks the
personas again as round `rework-<k>`, pushes all three to the dossier as new versions, and updates
the open phase-0 PR, or opens a new docs-only PR when the phase-0 PR is already merged. It refuses in
one line once building has started (a first sub-PR merged).

## Decisions

Settled with the person during the brainstorm:

1. **In think-big, the personas are the User panelists** when the product has any; without, today's
   invented Users stay.
2. **In brainstorm, the voice speaks once, when the design is shown,** before the approval question.
3. **An overrule saved as a claim is `proposed`,** confirmed later on Settings › Business; the other
   option is "Just this run".
4. **One gap question per run at most, answered claims stored `confirmed`,** "Not sure" stores
   nothing.
5. **Everything PRD-side ships in this PRD:** the voice in the skills, the User voice tab with scores
   per stage and per version, and the rework. Concept pages in the app are out.
6. **Scores are out of 5 per persona per stage,** shown with their move between rounds.

Made in this spec, recorded here:

7. **Every line the voice says cites** a `persona:<name>` or a claim id; an uncited line is dropped,
   never shown.
8. **At most five personas speak,** chosen for the widest spread of stance and trade, so a product
   with twelve personas does not flood a board.
9. **Persona ids are not logged** by `omni business cited`: personas are not claims. Claim ids cited
   by the voice are logged as today.
10. **`voice.json` is the source of truth,** versioned in the PRD's folder like the spec, so the tab,
    the phase-0 review and the retro all read the same rounds.
11. **The `shipped` round is written by `/omni:yolo`** on its green path, before the release note is
    committed, so the tab ends on what actually shipped.
12. **Rework is refused once building has started**; after that, `/omni:yolo-fix` owns changes.

## User stories

1. As a product person running think-big, I see Marc, Sofia and Els on the panel, each arguing from
   who they are, and the one a concept misses objects once, with the claims behind it.
2. As a product person in a brainstorm, I hear one objection before I approve the design, and I can
   save my answer as a claim or keep it for this run.
3. As a product person, I answer at most one gap question per run, by tapping.
4. As a reviewer of a phase-0 PR, I open the User voice tab and see each persona's score move from
   the design to the spec.
5. As a product person, I press Rework with this feedback, run the copied command, and see a new
   round with the scores that moved.
6. As a member after ship, I see the `shipped` round beside the first one.

## Scope

**In:**
- think-big's fuel, panel and objection lines;
- brainstorm's step 0 read, objection, overrule, gap question, `voice.json` rounds, and `--rework`;
- yolo's `shipped` round;
- `omni business claim add` and `POST /api/business/claims`;
- the `voice.json` schema and its check in `omni check inbox`;
- the `voice` dossier artifact (the kind in the database, `omni dossier push`, the page);
- the User voice tab, at 393px and in demo mode;
- the help entries.

**Out:**
- concept pages in the app, and the voice on them;
- `/omni:mega-brainstorm` and `/omni:ultra-yolo`;
- AI-generated personas;
- a persona speaking outside these three skills.

## Test seams

Tests follow `omni kb show testing`: beside the code, run by `pnpm test`, never calling GitHub,
Supabase or OpenRouter.

- **Plugin** (`kit/test/plugin.test.mjs`): think-big's fuel line for personas, its User card from
  personas and its once-per-concept objection; brainstorm's step 0 read, its objection before the
  approval question, its overrule question, its one gap question, its `voice.json` rounds and
  `--rework`'s refusal once building has started; yolo's `shipped` round. The unknown-command guard
  requires `business claim` in `COMMAND_TABLE`.
- **Kit:** `kit/lib/voice/` schema tests (a valid file, a score out of range, a round without
  personas, an unknown stage, an uncited reaction); `omni check inbox` refusing a bad `voice.json`;
  `omni dossier push` sending `voice`; `omni business claim add` against the fake server: each
  state, exit 0 and one skip line on every failure, exit 2 on a usage error.
- **SQL:** `supabase/checks/business.sql` extended: a claim added as `answer`, proposed or confirmed;
  another workspace refused; the dossier artifact kind `voice` accepted on a `prd` dossier only.
- **Galaxy:** the claims route (401, 403, a bad kind or state, `proposed` and `confirmed` stored);
  render tests for the User voice tab (empty, one round, three rounds with ▲ ▼ =, an outlined
  objection, the Rework button's command, 393px, demo mode).

## Risks

- **What a merge publishes** (`omni kb show releasing`): the migration goes to the production
  Supabase project; the skills' new lines reach every plugin user and `omni business claim` every
  install through the next `chore(release)`; the tab ships with galaxy.
- **Migration order:** check the latest migration on `main` right before merging (the lesson of #771).
- **A persona can be put words in its mouth.** Every line cites a persona or a claim, uncited lines
  are dropped, and the voice never states a business fact the claims do not hold.
- **Noise.** One objection per concept or design, five speakers at most, one gap question per run.
- **Rollback:** revert the PR, then a follow-up migration removes `voice` from the artifact kinds
  (after deleting `voice` artifacts). Claims saved as `answer` stay, as ordinary claims.
- **Not proven by CI:** a real think-big and brainstorm on a Vertuoza repository with its five
  personas, and the tab in a browser. Owed after merge by a person.

## Acceptance criteria

1. With personas on the repository's product, think-big's fuel sheet lists them under
   `persona:<name>`, the panel's User panelists are those personas (five at most), and each standing
   concept gets at most one objection, from the persona it fits worst, citing a persona or claim id.
2. Without personas, think-big's panel and output are as today, with no objection.
3. Brainstorm reads the business at step 0, and one cited objection (or none, when the design fits)
   comes before the design's approval question.
4. An overrule offers Save as a claim and Just this run; Save stores a `proposed` claim with source
   `answer`, and Just this run stores nothing.
5. At most one gap question is asked per run, only for a kind with no confirmed claim that the design
   leans on; its answer is stored `confirmed`, and Not sure stores nothing.
6. `omni business claim add` stores through `POST /api/business/claims` and exits 0 with one skip line
   on any failure; the route refuses a non-member, a bad kind and a bad state.
7. Brainstorm writes `voice.json` rounds `design` and `spec`, yolo writes `shipped`, and
   `--rework <n>` writes `rework-<k>`; `omni check inbox` refuses an invalid `voice.json`.
8. `omni dossier push` sends `voice.json` as the `voice` artifact, a new version only when it changed.
9. The PRD page's User voice tab shows one row per persona and one column per round with each score's
   move (▲ ▼ =), the outlined objection with how it was settled, and the Rework with this feedback
   button copying `/omni:brainstorm --rework <n>`; without a `voice` artifact it shows its empty line.
10. `/omni:brainstorm --rework <n>` refuses in one line once a sub-PR of the PRD has merged.
