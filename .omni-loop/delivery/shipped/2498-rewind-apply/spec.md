---
prd: 2498
title: Approving a missing-rule finding proposes that rule in the repository's own knowledge
blocked-by: none
spec: file
phase0: server
---

## Problem

PRD 2410's rewind turns a PRD that broke main into findings, each a card a member approves or
rejects. A finding whose origin is `knowledge` and that is about a playbook rule or a product fact
(not a glossary term or a Legal entry) is the one that should make the next run better: the lesson
nobody wrote down. Today Approve queues `/omni:knowledge-add` on a runner, which writes nothing there
(it refuses to write under `OMNI_UNATTENDED`, and handles only constituents, Legal entries and
glossary terms). The card admits it: the rule still waits for a person to write it (PRD 2410, item
s7-02). The lesson stays on the card.

## Solution

**Approve queues `/omni:rewind-apply <finding>`.** For a `knowledge` finding that is not a glossary
term or a Legal entry, Approve queues `/omni:rewind-apply <finding id>` on a runner of the workspace,
sent by the member who approved, in place of `/omni:knowledge-add`. The line carries the finding's id
only, so no text has to survive the runner line's character rules.

**The skill settles one finding, in the repository the PRD shipped in,** modelled on
`/omni:retro-apply`. It reads the finding with `omni rewind facts`, then the playbook forms and the
product registers it could belong in, and decides exactly one of three:

- **Proposes.** No rule states it.
  - A lesson about how to work in this repository becomes one new bullet appended to the one
    playbook slot it belongs in, in the words of that slot's own bullets, ending
    `(rewind of PRD <prd>)`.
  - A fact about the product becomes one new entry in the register it belongs in, marked
    `Proposed: rewind <date>`, never locked and never a law: its owner confirms it, as harvest's
    proposed entries are confirmed today.

  Both are committed on a branch of their own, `branches.knowledge` with `{topic}` =
  `rewind-<prd>-<finding short id>`, cut from the default branch, and opened as one docs-only pull
  request into the default branch, signed, for a person of this repository to review and merge.
- **Already said.** A rule already states it: nothing is written, and the outcome names that rule
  (`playbook/<form>#<slot>` or the register entry's id).
- **Asks.** No slot or register fits, the finding contradicts a written rule, or it would change a
  locked law: nothing is written, and the outcome is one question in plain words, the option the
  skill would take included.

It writes only in this repository's own `.omni-loop/knowledge/`: never the kit, never another
repository, never a locked law, never merges.

**The outcome goes back to the card.** The skill records it with `omni rewind outcome <finding>`
(`--pr <n>`, `--already '<rule id>'` or `--asks '<question>'`), once: a finding's outcome is never
rewritten. The PRD page's Main tab then shows, on the approved card, `Rule proposed in PR #<n>`,
`Already said by <rule id>`, or the question, in place of today's note that nothing is written.

## Conventions

| repo | layer | name | source |
| --- | --- | --- | --- |
| vertuo-omni-loop | skill | `/omni:rewind-apply` | no written convention: follows `/omni:retro-apply` ← kit/plugin/skills/retro-apply/SKILL.md:1 |
| vertuo-omni-loop | cli | `omni rewind outcome` | no written convention: follows `omni retro outcome` ← kit/bin/commands/retro.ts:1 |
| vertuo-omni-loop | db | `rewind_findings.outcome`, `outcome_pr`, `outcome_note` | no written convention: follows `rewind_findings` ← supabase/migrations/20261230090000_main_watch.sql:1 |
| vertuo-omni-loop | branch | `branches.knowledge` with `rewind-<prd>-<finding>` | `branches.knowledge` ← .omni-loop/config.yml |
| vertuo-omni-loop | register | `Proposed: rewind <date>` | no written convention: follows `Proposed: harvest <date>` ← .omni-loop/knowledge/product/rules.md:648 |

## Decisions

- **Only the repository's own knowledge.** The person's words: "omni-loop is repo agnostic, not sure
  a rewind should update the kit of omni… a repo should not be able to merge". A lesson about Omni
  itself stays an `omni-setup` finding, an issue on the kit (PRD 2410); this PRD never changes the
  kit, and every change is a pull request a person of the repository merges.
- **Both kinds, product facts as proposed** (the person's pick): a how-we-work lesson becomes a
  playbook line, a product fact a proposed register entry, never a law.
- **One pull request per approved finding**, so each can be merged or closed alone. "Already said"
  and "Asks" open none.
- **Glossary and Legal findings are unchanged:** they still file a product knowledge proposal (PRD
  2410). `/omni:knowledge-add` is no longer queued by Approve, and stays a skill a runner may run.
- **The voice.** The Lead Engineer objected: "Every approved lesson is one more pull request on my
  plate to review" (persona:Lead Engineer). Settled **accepted**: the design already meets it, since a
  PR is opened only when a member chose to approve, it is docs-only and one line long, and "already
  said" opens none.

## User stories

- As a member, when I approve a finding that says a rule was missing, the rule is proposed in my
  repository's playbook as a pull request I can merge, so the next agent follows it.
- As a member, when the rule already exists, the card tells me which one, and nothing is opened.
- As a member, when the finding would touch a locked law, the card asks me one question instead of
  changing anything.
- As the owner of a product register, a product fact from a rewind reaches me as a proposed entry I
  confirm, never as a law.

## Scope

In:

- the approve route sends a playbook or register finding to `/omni:rewind-apply`;
- the skill `/omni:rewind-apply`, and `rewind-apply` among the skills a runner may run (the kit's and
  the galaxy's lists);
- `omni rewind outcome`, its endpoint, and the three outcome columns on `rewind_findings`;
- the approved card's outcome on the Main tab.

Out:

- changing the kit from a repository, in any form;
- merging anything;
- glossary and Legal findings (unchanged);
- grouping several findings into one pull request;
- locking a register entry or writing a law.

## Test seams

The repository's testing form: tests beside the code, the narrowest level that proves the risk.

- **The approve route:** a playbook or register `knowledge` finding queues `/omni:rewind-apply <id>`
  sent by the member; a glossary or Legal one still files its proposal; nothing queues
  `/omni:knowledge-add` any more (`rewind.approval.test.ts`, `rewind.service.test.ts`).
- **The migration:** the outcome columns, written once through a definer function by the service
  role or an agent link of the workspace, refused a second time, read by members
  (`supabase/checks/`).
- **The kit:** `omni rewind outcome` through `main()` on a fixture repository: each of the three
  outcomes sent, an outcome refused without its value, and a second outcome refused.
- **The skill:** its SKILL.md tested as `kit/test/retro-apply-skill.test.ts` tests retro-apply's: the
  three outcomes, the knowledge branch, one docs-only PR, never the kit, never a locked law, never a
  merge; `kit/test/plugin.test.ts` (N-PRODUCT-15) passes untouched.
- **The card:** a component test of the approved card's three outcomes and of an approved card with
  no outcome yet.

## Risks

Merging publishes a migration on production Supabase (three nullable columns and one function), a
change to the approve route and the Main tab, and the kit's new skill and command. Rollback: revert
the merge; a follow-up migration drops the columns, which nothing else reads.

- **A wrong rule in the playbook.** It reaches the default branch only through a person's merge; a
  wrong one is closed unmerged.
- **Noise.** One PR per approved finding; none when already said or asked.

The Legal entries it touches:

- L-AIACT-1, content an agent makes says so: the docs pull request and each line it adds are signed
  as written by an agent.
- L-GDPR-4, decisions kept for good: a finding's outcome is written once and never rewritten.

The locked laws it touches:

- N-PRODUCT-15: only a person merges into main. The skill opens a pull request and never merges it.
  Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent link reads only repositories in its own workspace. The skill runs on the
  workspace's runner and writes only in the repository the PRD shipped in. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-12: an answer never changes after it is given. A finding's outcome is written once.
  Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-28, BR-PRODUCT-29, BR-PRODUCT-39, BR-PRODUCT-59, BR-PRODUCT-64, N-PRODUCT-16: printed
  because the design touches the galaxy app and the migrations folder they govern; the design changes
  none of them. Changing one needs @pierrederval or @dervalp to approve the pull request on GitHub.

## Acceptance criteria

- Approving a `knowledge` finding about a playbook rule or a product fact queues exactly one
  `/omni:rewind-apply <finding id>` job, sent by the member who approved; nothing queues
  `/omni:knowledge-add`.
- Approving a glossary or Legal finding still files its product knowledge proposal, as before.
- `/omni:rewind-apply` on a lesson no rule states opens one docs-only pull request in the PRD's
  repository, adding one playbook bullet ending `(rewind of PRD <prd>)`, or one register entry marked
  `Proposed: rewind <date>`; it changes no file outside `.omni-loop/knowledge/` and never the kit.
- On a lesson a rule already states, it opens nothing and records that rule as the outcome.
- On a lesson that fits nowhere or would change a locked law, it opens nothing and records one
  question as the outcome.
- The approved card shows `Rule proposed in PR #<n>`, `Already said by <rule id>`, or the question;
  a second outcome for the same finding is refused.
- The skill never merges.
