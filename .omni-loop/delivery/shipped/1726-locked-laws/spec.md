---
prd: 1726
title: Locked laws — a thesis per repository, laws a CODEOWNER locks, only the laws a change touches
blocked-by: none
spec: file
phase0: server
---

## Problem

A repository with `laws.source: knowledge` keeps what is true about its product in three registers:
principles, rules and invariants (`kit/lib/knowledge/registers.ts`). This repository holds 81
principles, 96 rules and 12 invariants. Four gaps follow.

1. **The registers grow from the bottom only.** Every rule and invariant is harvested from an outbox
   item after a PRD ships. In this repository, 106 of the 108 say `Decided: nobody — adopted when
   raised (medium)` (`decidedLine`, `kit/lib/knowledge/write.ts:160`). Many say how the code
   behaves ("each game/cli script parses its own arguments…"). None says what the product promises.
   Nobody has written down the few truths that cost the most when broken, and the briefing says so
   itself, in an open `TODO(human)`.
2. **Every entry weighs the same.** The 108 are all "laws" to the gate (`law-proof`, `law-text`,
   `law-demoted` in `kit/lib/outbox/decision-coverage.ts`). The code also disagrees on what a law
   is: `kit/lib/laws.ts:78` counts principles, and `decision-coverage.ts:139` does not.
3. **No law belongs to a person.** A high outbox item clears a change to a law's test, and any
   person can answer it. Knowledge and enforce pull requests are never blocked (PRD 1342). No
   CODEOWNERS file exists, and nothing generates one.
4. **Agents read everything or nothing.** `/omni:do-work` reads the whole knowledge folder
   (`kit/plugin/skills/do-work/SKILL.md:66`), which is 189 entries here. Brainstorm, plan, wave and
   bug-fix read none of it. No command returns the entries that govern a given file.

vertuoza/vnext writes its laws from the top: a `PRODUCT.md`, then a constitution of laws N1–N35. Its
`test/invariants/` folder is owned by a person and guarded by CODEOWNERS and an approval trailer.
This PRD gives omni-loop the same property, for every repository that installs the kit, and keeps
agents from being swamped.

## Solution

**Three tiers, one word each:**

| Tier | What it is | Who changes it | How many |
|---|---|---|---|
| **Principle** | the why: a person's decision about what the product should be | a person, as today | any |
| **Rule** (HIGH) | what may or may not happen, with a test | **any person**, by answering its high outbox item (today's gate, unchanged) | any |
| **Law** (MUST) | a rule or invariant a **CODEOWNER locked** | only with a **CODEOWNER's approval of the pull request on GitHub** | at most `laws.max` (20 by default) |

### A law is a locked entry

A law keeps its rule or invariant id and its `Enforced by:` test. It gains two lines:

```
Locked: @pierrederval, 2026-10-14
Governs: apps/omni-app/src/outbox-check/**, kit/lib/outbox/**
```

- `Governs:` lists the paths an entry rules over. Every rule may carry it, and every law must.
  Paths are matched by the flow areas' matcher (`kit/lib/flow/resolve.ts`), so there is one glob
  dialect.
- An agent never writes `Locked:` on its own judgement. It writes `Proposed law: <one plain
  sentence: what breaks, and who gets hurt>`. A `Locked:` line counts only in a pull request a
  CODEOWNER of the law's files approved, which the gate checks (below).
- `omni check knowledge` refuses:
  - a `Locked:` entry with no test or no `Governs:`;
  - a `Locked:` principle (a principle is never a law);
  - more locked entries than `laws.max`;
  - a CODEOWNERS block that is stale (below).
- "Law" now means one thing everywhere: a locked entry. `kit/lib/laws.ts`,
  `decision-coverage.ts` and `/omni:bug-fix`'s text are brought into line.

### The thesis

`<paths.knowledge>/product/thesis.md` is the one page a newcomer reads first. Everything in it is
written so a junior developer or a junior PM understands it without opening code: plain words, one
sentence per idea, no file paths in a statement. It has four sections:

- **Who it is for**: the people, one line each.
- **What it promises**: three to five sentences.
- **The laws**: one line per locked law, as `<id> — <plain sentence>. If broken: <what breaks, for
  whom>.` The line is a pointer; the entry in its register holds the law.
- **What it refuses**: what the product will never do.

The thesis holds no parsed entries. `omni check knowledge` refuses a thesis whose laws section
names an id that is not locked, or misses one that is.

### Disclosure: only what a change touches

One command, `omni kb laws`, returns a headline per entry, never a whole register:

```
omni kb laws                     the locked laws, one plain line each
omni kb laws --paths <file>…     the locked laws + the rules whose Governs: matches those files
omni kb laws --slice <prd> <s>   the same, for a slice's territory in plan.md
omni kb laws --area <domain>     one domain folder's rules, for a person browsing
```

`omni knowledge <id>` still prints one entry in full. A rule with no `Governs:` line is never
printed by `--paths` or `--slice`, so nothing falls back to loading everything. `omni kb status`
counts those rules as a backlog.

| Reader | Today | After |
|---|---|---|
| `omni kb show briefing` | the playbook only | + the thesis's laws section |
| `/omni:brainstorm` | the briefing | `--paths` of what the design touches; each locked law it touches, and that law's CODEOWNERS, named in the spec's **Risks** |
| `/omni:plan` | the briefing | `--slice` per slice; a slice that touches a locked law gets `law: <id> · owner @x` |
| `/omni:do-work` | the whole knowledge folder | `--slice` only |
| `/omni:bug-fix` | the briefing | `--paths` of the fix |

### The gate

A new coverage rule, `law-locked`, runs in `decision-coverage.ts` and in the Omni app's outbox check:

- **When it fires.** A pull request adds or removes a `Locked:` line, edits a locked entry's text,
  changes a file a locked entry's `Enforced by:` names, or deletes a locked entry.
- **Which pull requests.** Every kind, knowledge and enforce PRs included.
- **What clears it.** Only an approving review on GitHub from a person whom CODEOWNERS lists for
  every file that fired it. CODEOWNERS is read from the base branch. An outbox item does not clear
  it, an override label does not clear it, and a trailer does not clear it.
- **Fail closed.** When no CODEOWNER is found for a locked law's files, the check stays red and
  names the law.
- **Re-runs.** The webhook starts the outbox check on `pull_request_review` (submitted, dismissed)
  as well, so an approval turns it green without a new push.
- **The record.** The feature PR's merge carries `Law-Change-Approved-By: @<login>` for each
  approving CODEOWNER. `/omni:pr` writes it from the reviews; it is history, not what decides.
- **Rules are unchanged.** `law-proof`, `law-text` and `law-demoted` still need a high item, which
  any person may answer.

### CODEOWNERS

`omni kb owners` writes one block between markers in `.github/CODEOWNERS`. The block covers each
locked law's `Enforced by:` file, the thesis and the register files. The owners come from a new
setting, `laws.owners` (logins or teams). The command never touches a line outside its markers.
`omni check knowledge` goes red when the block is out of date with the locked laws.

### `/omni:invade` drafts a thesis

On a first invade and on `--refresh`, invade drafts `product/thesis.md`. It is written in plain words
from what the repository proves: its README, its docs, and the rules its code enforces. Every
sentence that has no evidence is a `TODO(human)` line. Invade proposes up to `laws.max` candidate
laws as `Proposed law:` lines on existing or drafted entries, each with its `Governs:` line. It
locks nothing, and its pull request says which CODEOWNER locks them.

### This repository's triage

Slices of this PRD triage the 108 rules and invariants here:

1. Write `Governs:` on each, starting from the paths of its `Enforced by:` test.
2. Draft `product/thesis.md` for omni-loop, readable by a junior.
3. Propose at most 20 candidate laws as `Proposed law:` lines, each one plain sentence saying what
   breaks and who gets hurt. The main candidates are:
   - only a person merges into main;
   - the gate's rules come from the base branch;
   - a hook never blocks a person;
   - the ledger projection never rewrites history;
   - no secret reaches the browser.
4. Leave every other entry a rule. Each "keep as rule" is a medium outbox item, which is reversible.
5. Raise one **high** outbox item listing the candidate laws in plain words, for the owner to lock
   or strike. The locks land on the feature PR, and the owner's approval of it as CODEOWNER clears
   `law-locked`.

`laws.owners` is `[pierrederval]` here.

## Decisions

- **One big PRD.** The person chose one PRD over a roadmap of four (brainstorm, 2026-10-12).
- **A law is person-stated, locked, capped and tested.** Agents only propose (brainstorm).
- **A law is a lock line on its entry**, not a new register or file. No renumbering, and no test
  moves (brainstorm).
- **Law = MUST, agreed by a CODEOWNER. Rule = HIGH, amended by any person** (the person's words).
  The rules' gate stays as it is.
- **What makes an approval real is a CODEOWNER's approving review on GitHub.** A trailer is not
  enough, because an agent can type any name into one; the trailer stays as the record (brainstorm).
- **The gate plus generated CODEOWNERS**, not a local CI script, because a PR could edit a script
  it is judged by (brainstorm).
- **Disclosure is by path and area** (brainstorm).
- **The triage:** the agent proposes, a person locks, and everything is written for a junior
  developer or a junior PM (the person's words).
- **The voice, persona:Irisa, objected** at the design: "If my small fix touches a file a locked
  law governs, I now wait for a CODEOWNER I may not know. Tell me before I build, not as a red check
  at the end." **Accepted:** brainstorm names each locked law the design touches, and its
  CODEOWNERS, in the spec's Risks, and plan marks the slice.
- **No proof video** (brainstorm).
- **`Governs:` reuses the flow areas' matcher**, so there is no second glob dialect. "Area" here
  means a domain folder, as the spec's `areas:` field already does.

## User stories

- As a **junior developer**, I read one page, `thesis.md`, and know the twenty things I must never
  break, and why, in words I understand.
- As an **agent** building a slice, I get the locked laws and only the rules that govern the files
  I touch, not 189 entries.
- As the **owner**, I am the only one whose approval turns a change to a law green, and no agent
  can fake it.
- As a **PM pushing a quick win**, I learn at the brainstorm which law my change touches and whom
  to ask, before anything is built.
- As a **person answering the outbox**, I still amend a rule by answering its high item, as today.
- As a **new repository**, `/omni:invade` gives me a drafted thesis and candidate laws to lock.

## Scope

**In:**

- the `Locked:`, `Governs:` and `Proposed law:` fields, read by `registers.ts` and written by
  `write.ts`;
- the `laws.max` and `laws.owners` settings;
- the checks in `omni check knowledge`;
- `thesis.md` and its check;
- `omni kb laws` and the briefing's laws section;
- the reads in brainstorm, plan, do-work and bug-fix;
- the `law-locked` rule, in the kit and in the Omni app, and the outbox check re-run on reviews;
- the `Law-Change-Approved-By:` record written by `/omni:pr`;
- `omni kb owners` and its CODEOWNERS block;
- invade drafting the thesis;
- this repository's triage, and its high item.

**Out:**

- Locking principles.
- Changing how rules are harvested.
- Branch protection settings on GitHub. Required reviews stay the repository's own choice; the
  gate is what enforces.
- A lock button on the PRD page. A later PRD may add one; this PRD's lock is an approved pull
  request.
- Parsing individual tests inside a file.

## Test seams

Following `omni kb show testing`: the tests sit beside the code, run on fixtures, and never call
GitHub.

- `kit/lib/knowledge/registers.test.ts`: the new fields are parsed; a `Locked:` principle is refused.
- `kit/lib/knowledge/check-knowledge.test.ts`: refusals for a lock with no test, a lock with no
  `Governs:`, too many laws, a thesis out of date, and a stale CODEOWNERS block.
- `kit/bin/kb.test.ts` through `makeRepo()`:
  - `kb laws` with no flag, `--paths` (a match, no match, and a rule without `Governs:` left out),
    `--slice`, `--area`;
  - `kb owners` writes only inside its markers;
  - the briefing prints the laws section.
- `kit/lib/outbox/decision-coverage.test.ts`: `law-locked` fires on each of its four changes and
  never on a rule.
- `apps/omni-app/src/outbox-check/end-to-end.test.ts` against the stubbed GitHub:
  - no approval: red;
  - a non-owner's approval: red;
  - a CODEOWNER's approval: green;
  - no CODEOWNERS: red, naming the law;
  - a knowledge PR that changes a locked law: red;
  - a `pull_request_review` event re-runs the check.
- `kit/test/plugin.test.ts`: the skills' new reads and the junior-readable rule.
- `pnpm mutation:changed` on `kit/lib/outbox/` (delivery core).

## Risks

- **What merging publishes.** The kit (`kit/dist/omni.mjs` and the plugin) and the Omni GitHub App
  (`apps/omni-app`). Every repository with `laws.source: knowledge` gets the new checks when it
  updates the kit. The App's `law-locked` rule applies to any repository that has locked entries.
  Until then it fires on nothing, so repositories with no lock see no change.
- **The locked laws this PRD touches.** None exist yet, so no CODEOWNER approval is needed to build
  it. The triage's locks land on its feature PR and need @pierrederval's approval as CODEOWNER.
- **Fail closed can block a repository** that locks a law before it lists `laws.owners`.
  `omni check knowledge` refuses that state before any PR is opened.
- **Rollback.** Revert the merge. The kit's previous release ignores the new lines (unknown fields
  are kept as prose), and the App's previous deploy ignores `law-locked`. `Locked:` lines left in
  the registers are then inert.

## Acceptance criteria

1. `omni kb laws` prints only the locked laws, one plain line each; with `--paths`, it adds exactly
   the rules whose `Governs:` matches, and none without `Governs:`.
2. `/omni:do-work` no longer reads the whole knowledge folder; it reads `omni kb laws --slice`.
3. `omni check knowledge` refuses a locked entry with no test or no `Governs:`, a locked principle,
   more than `laws.max` locks, a thesis out of date with the locks, and a stale CODEOWNERS block.
4. The outbox check stays red on any pull request (knowledge and enforce included) that adds,
   removes, edits or changes the test of a locked law, until a CODEOWNER of those files approves it
   on GitHub. A non-owner's approval, an outbox item or a label leaves it red.
5. An approving review re-runs the outbox check without a push.
6. A change to a rule's test still needs a high item any person may answer, and nothing more.
7. `omni kb owners` writes the CODEOWNERS block for the locked laws and changes nothing outside its
   markers.
8. `/omni:invade` drafts `thesis.md` and proposes candidate laws, and locks none.
9. In this repository: every rule and invariant has `Governs:`, `thesis.md` exists and reads plainly,
   at most 20 candidate laws are proposed, and one high item lists them for @pierrederval to lock
   or strike.
10. A brainstorm whose design touches a locked law names the law and its CODEOWNERS in the spec's
    Risks.
