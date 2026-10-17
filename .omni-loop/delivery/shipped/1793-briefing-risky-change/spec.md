---
prd: 1793
title: The briefing is a risky change
blocked-by: none
spec: file
---

## Problem

The briefing (`<paths.playbook>/briefing.md`, `.omni-loop/knowledge/playbook/briefing.md` here) holds
the Never lines every agent reads before it changes anything: never merge into the default branch,
never lower a coverage floor, never bypass a hook. `AGENTS.md` sends every agent to it first, and
`omni kb show briefing` prints it at the start of every session.

Today nothing guards it. The outbox check grades a range with seven rules: six in
`kit/lib/outbox/decision-coverage.ts` (`stored-shape`, `law-proof`, `law-text`, `test-removed`,
`shared-contract`, `law-demoted`) and PRD 1726's `law-locked`. None of them reads the playbook. An
agent building a slice can delete "Never lower a coverage floor" from the briefing, owe no account,
raise no item, and the feature PR's check stays green. If it raises a `medium` item, `/omni:wave`
adopts it on its own. No person is asked, and the CODEOWNERS block `omni kb owners` writes
(`kit/lib/codeowners-laws.ts`) does not name the briefing, so no owner is asked to review either.

An agent can loosen the rules that govern its own work, and nobody has to see it.

## Solution

### A new coverage rule: `briefing-text`

`decision-coverage.ts` gains one per-change rule, `briefing-text`, beside the five in `RULES`
(`decision-coverage.ts:126`). It fires on a change, of any status (added, modified or deleted; a
rename reaches the rule as a delete and an add, `kit/lib/git.ts:18`), to one of **the briefing's
files**:

- the briefing form itself, at `ctx.layout.formPath('briefing')` (`kit/lib/layout.ts:94`), so a
  repository that sets `paths.playbook` elsewhere is covered at its own path;
- when the briefing is a pointer form (`state: pointer`), the file its `points-to` names;
- the file each of its sections points to with a `See: <path>[#anchor]` line, the whole file, its
  anchor dropped.

The pointers are read from the head of the range, with the form parser that already reads them
(`kit/lib/playbook/forms.ts`). A pointer added, removed or moved changes the briefing file itself,
so the rule fires on that change too.

It fires in every repository that has a briefing, whatever `laws.source` says. It never fires on any
other playbook form (`testing.md`, `conventions.md` and the rest) and never on the kit's template
`kit/templates/playbook/briefing.md`.

### Only a person accounts for it

`briefing-text` joins `LAW_RULES` (`kit/lib/outbox/account.ts:275`), the rules only an item ranked
`high` or `human-action` accounts for. A `spec <where>` account, or an item ranked `medium`, names the
change without accounting for it, and the check says why, as it already does for a change to a rule:

```
PRD #812: `.omni-loop/knowledge/playbook/briefing.md` is risky (briefing-text) and its account
names item s2-03, ranked medium: a change to the briefing needs an item ranked high.
```

A high item stays open until a person answers it on the pull request, so the check stays red until
then. That is 1726's rule tier, unchanged: any person may answer.

Where the rule applies, by pull request:

| Pull request | A change to the briefing |
|---|---|
| a feature PR | red until a `high` or `human-action` item, named by an account, is answered |
| a fix PR (`/omni:bug-fix`, `/omni:visual-fix`) | the same, in the fix's own `outbox/`, as for a change to a rule (`fixGateResult`, `kit/lib/outbox/status.ts:224`); fix PRs are graded only when `laws.source` is `knowledge`, as today |
| a knowledge PR, an enforce PR | never blocked, as today: the person merging it is the answer. Its CODEOWNER is asked to review (below) |

The skills that grade their own diff learn the rule: `/omni:do-work`'s list of risky changes, the
rule tables of `/omni:bug-fix` and `/omni:visual-fix`, and the guide's "A person answers every
change to a rule" section in `docs/guide/loop.md`.

### The CODEOWNERS block names the briefing

`omni kb owners` adds the briefing's files to the block it writes between its markers, after the
thesis and the registers, under their own comment line:

```
# The briefing: the rules every agent follows.
/.omni-loop/knowledge/playbook/briefing.md @pierrederval
```

A pointer target of the briefing gets its own line under the same comment. `omni check knowledge`
already goes red when the block differs from what `omni kb owners` would write
(`ownersBlockProblems`, `kit/lib/codeowners-laws.ts`); with this PRD, a block that misses the
briefing is out of date. The rule that asks nothing of a repository with no lock and no block, or
with `laws.owners` empty, stays as it is.

CODEOWNERS asks the owner to review. It is not the gate: the briefing is not a locked law, and
`law-locked` does not fire on it.

### This repository

This PRD runs `omni kb owners` here, so `.github/CODEOWNERS` gains the briefing line, and rebuilds
`kit/dist/omni.mjs` and `apps/omni-app/api/`. It does not edit the briefing.

## Decisions

- **Q1 — recommended default, accepted when the phase-0 PR merges:** Keep the tiers PRD 1726 shipped: a rule through a high item any person answers, a locked law only through its CODEOWNER; no review-policy line per entry. (Who approves changing a business rule?)
- **Keep 1726's tiers.** A rule is changed by any person through a high item; a locked law is
  changed only with a CODEOWNER's approving review. The briefing takes the rule tier.
- **The briefing is raised; the other playbook forms are not.** A change to `testing.md`,
  `conventions.md` or any other form stays unrisky, as today.
- **No review-policy line per entry.** It was dropped from the roadmap.
- **No screen changes.**
- **The rule fires on the briefing's pointer targets too** (this spec). Otherwise a pointer form
  would move the Never lines out of reach of the rule. A whole file fires, even when the pointer
  names one anchor in it, because the rule reads paths, not sections.
- **The kit's template of the briefing is not raised** (this spec). It is kit source, released with
  the kit; a repository's own briefing file is what this PRD guards.

## User stories

1. As a **person reviewing a feature PR**, I see a high question whenever an agent changed the
   briefing, and the PR stays red until I answer it.
2. As a **CODEOWNER** of the laws, GitHub asks me to review any pull request that changes the
   briefing.
3. As an **agent building a slice**, `omni check coverage` tells me that my change to the briefing
   needs a high item, before I push.
4. As a **person editing `testing.md`**, nothing changes for me.

## Scope

**In:**

- the `briefing-text` rule in `kit/lib/outbox/decision-coverage.ts`, with its pointer reading;
- `briefing-text` in `LAW_RULES` (`kit/lib/outbox/account.ts`) and the refusal sentence that names
  the briefing;
- the fix PR's gate reporting it (`kit/lib/outbox/status.ts`);
- the briefing's files in the block `omni kb owners` writes (`kit/lib/codeowners-laws.ts`), and the
  stale-block check that follows from it;
- the rule in the text of `/omni:do-work`, `/omni:bug-fix`, `/omni:visual-fix` and
  `docs/guide/loop.md`;
- this repository's CODEOWNERS block, and the two rebuilt bundles.

**Out:**

- Raising any other playbook form.
- Raising the kit's template `kit/templates/playbook/briefing.md`.
- Blocking a knowledge PR or an enforce PR, and gating an invade PR (`branches.invade`), which the
  check skips today.
- Branch protection on GitHub (required reviews stay the repository's own choice, as in 1726).
- Escalating a question nobody answers: P2, PRD 1794.
- The product's Legal and Glossary pages: P3, PRD 1795.
- Domain contracts: P4, PRD 1796.
- The knowledge graph: P5, PRD 1797, and P6, PRD 1798.

## Test seams

Following `omni kb show testing`: tests sit beside the code, run on fixtures, and never call GitHub
or the network.

- `kit/lib/outbox/decision-coverage.test.ts`: `briefing-text` fires on an added, modified and
  deleted briefing, and on a briefing moved away (its delete); at a custom `paths.playbook`; on a
  pointer form's `points-to` file; on a section's `See:` file; and never on `testing.md`, on the kit's template, or on a file only
  another form points to. A change that also fires another rule reports both.
- `kit/lib/outbox/account.test.ts`: an account naming a `high` or `human-action` item accounts for
  `briefing-text`; a `spec` line or a `medium` item is refused with the sentence that names the
  briefing.
- `kit/lib/outbox/status.test.ts` and `kit/lib/outbox/status-fix.test.ts`: a feature PR and a fix PR
  that change the briefing are red with a medium item and green once a high item is answered.
- `kit/lib/knowledge/check-knowledge.test.ts` and `kit/bin/kb.test.ts` (through `makeRepo()`):
  `kb owners` writes the briefing's lines inside its markers and nothing outside them; a block
  without them is reported out of date.
- `apps/omni-app/src/outbox-check/end-to-end.test.ts`, against the stubbed GitHub: a feature PR
  changing the briefing with a medium item fails; with an answered high item it succeeds; a
  knowledge PR changing it succeeds.
- New skill-text assertions go in a new test file, not in `kit/test/plugin.test.ts`, which is the
  test of locked laws BR-PRODUCT-3 and BR-PRODUCT-5.
- `pnpm mutation:changed` on `kit/lib/outbox/` (delivery core); the floor in `mutation/floor.json`
  is not lowered.

## Risks

- **What merging publishes.** The kit (`kit/dist/omni.mjs` and the plugin) and the Omni GitHub App
  (`apps/omni-app`), deployed by the release commit that follows the merge. Every repository's
  outbox check gains `briefing-text` once its base branch carries a kit with it: the App reads the
  rules from the base (N-PRODUCT-4), so this PRD's own pull request is not graded by it.
- **A slice already in flight** that changed the briefing turns red on its next push after the
  release. Its fix is one high item a person answers.
- **A README behind a `See:` pointer** now needs a high item for any edit, wherever it is. That is
  the cost of the pointer rule; a repository that minds it keeps its Never lines in the briefing
  itself.
- **Rollback.** Revert the merge. The previous kit and App ignore `briefing-text`; an account entry
  naming it becomes a stale entry, which is reported and never fatal. The CODEOWNERS line stays
  until `omni kb owners` runs again.
- **The locked laws it touches.** None of their tests change.
  - BR-PRODUCT-6: if the live check stopped reading the changed files, a risky change nobody
    explained would reach the main branch unseen. Changing it needs @pierrederval to approve the
    pull request on GitHub.
  - N-PRODUCT-3: if a question were not graded by the gate's own check before it is written, a
    badly ranked question would slip past the person answering it. Changing it needs @pierrederval
    to approve the pull request on GitHub.
  - N-PRODUCT-4: if a pull request could change the rules it is judged by, any change could switch
    its own gate off. Changing it needs @pierrederval to approve the pull request on GitHub.
  - N-PRODUCT-14: if the terminal checks stopped comparing with the base branch, a rule could lose
    its test unnoticed until the server refuses the pull request. Changing it needs @pierrederval
    to approve the pull request on GitHub.

## Acceptance criteria

1. On a feature PR, a change to `<paths.playbook>/briefing.md` is reported by `omni check coverage`
   and the outbox check as `briefing-text`.
2. That change is accounted for only by an account naming an item ranked `high` or `human-action`;
   with a `spec` line or a `medium` item, the check stays red and says the briefing needs an item
   ranked high.
3. The check turns green once a person answers that high item, with no other change.
4. A change to a file the briefing points to (`points-to`, or a section's `See:` line) fires
   `briefing-text` the same way.
5. A change to any other playbook form, or to `kit/templates/playbook/briefing.md`, fires no rule
   it did not fire before.
6. On a fix PR, with `laws.source: knowledge`, a change to the briefing needs a high item in the
   fix's `outbox/`, as a change to a rule does.
7. A knowledge PR or an enforce PR that changes the briefing stays green.
8. `omni kb owners` writes the briefing's lines inside its CODEOWNERS block, and nothing outside its
   markers; `omni check knowledge` reports a block without them as out of date.
9. In this repository, `.github/CODEOWNERS` names `/.omni-loop/knowledge/playbook/briefing.md`
   `@pierrederval`, and `omni check knowledge` is green.
10. `/omni:do-work`, `/omni:bug-fix`, `/omni:visual-fix` and `docs/guide/loop.md` name
    `briefing-text` among the changes a person answers.
