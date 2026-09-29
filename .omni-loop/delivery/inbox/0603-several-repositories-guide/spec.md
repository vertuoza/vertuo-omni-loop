---
prd: 603
title: Several repositories — a guide page with three drawings
blocked-by: none
spec: file
---

# Several repositories: a guide page with three drawings

**Date:** 2026-09-29 · **PRD:** #603 · **Touches:** `docs/guide/` (a new page, three new diagrams,
`meta.json`, the Invade and First PRD pages) and `apps/galaxy/src/docs/guide.test.ts`. No kit code,
no migration.

## Problem

The multi-repository mode shipped in three PRDs (522 mega-invade, 549 mega-brainstorm, 563
ultra-yolo), but the guide only tells it as a prose section at the end of the Invade page. The Loop
page shows how one repository works in three drawings (the loop, its pull requests, its skills);
nothing shows how a plan repository, its targets and the mega and ultra skills fit together. The
skill pages under `/docs/skills` describe each skill alone, not the whole.

## Solution

**1. A new page, `docs/guide/several-repositories.md`,** titled "Several repositories", placed after
First PRD in `docs/guide/meta.json`: First PRD's Next link points to it, and its Next link points to
Use cases. In order:

1. **What it is:** the plan repository (it holds PRDs, no product code), its target repositories,
   and the rule of the mode: one plan, one phase-0, one gate.
2. **Drawing 1, the map** (`diagrams/repositories.svg`): the plan repository in the middle, its
   targets around it, each with its role and where its knowledge lives (`own`, `imported`, `none`).
   Then setting it up: `/omni:mega-invade`, `omni targets`, `/omni:mega-invade --sync`: the prose now
   in the Invade page, moved here.
3. **Plan across them:** `/omni:mega-brainstorm`: the `repo` column, and one phase-0 with its
   **What lands where** table.
4. **Drawing 2, the pull requests over time** (`diagrams/pull-requests-repositories.svg`): swim
   lanes, as the Loop page's pull-requests drawing, one lane group per repository: the plan
   repository's default branch with the one phase-0 and the plan PR carrying the one outbox; each
   target's default branch with its feature PR and its sub-PRs wave by wave; dashed agent arrows
   carrying each slice's decisions into the outbox; numbered merge order, the target PRs first, the
   plan PR last.
5. **Build:** `/omni:ultra-yolo`: a feature PR per target, decisions relayed into the one outbox, a
   target's own committed preflight only, the plan PR marked ready last, and the merge order.
6. **Drawing 3, which skill runs which** (`diagrams/skills-repositories.svg`), drawn as the Loop
   page's skills drawing: you type `/omni:mega-invade`, `/omni:mega-brainstorm`, `/omni:ultra-yolo`
   and `/omni:ultra-yolo-fix`; `/omni:ultra-yolo` runs `/omni:ultra-wave`; `/omni:do-work`
   (`--target`) and `/omni:pr` (`--repo`) are shared with the single-repository skills.
7. **A red gate:** answer on the plan PR, then `/omni:ultra-yolo-fix`.

**2. The drawings** follow the guide's diagram rules (`apps/galaxy/src/docs/diagrams.ts`): each is
an SVG file under `docs/guide/diagrams/`, shown on a line of its own with alt text; its shapes and
words carry the `dg-*` classes the app paints with the theme's tokens; its own `<style>` (light and
dark, the same as `pull-requests.svg`'s), `<title>` and `<desc>` serve GitHub. The example is the
same in all three: PRD 600 in `vertuo-automation-plan`, s1 in `vertuo-backend-php`, s2 and s3 in
`vertuo-apps`.

**3. The Invade page's "A plan repository" section** becomes two sentences and a link to the new
page.

## Decisions

- **A page of its own, after First PRD:** the loop is learnt on one repository first.
- **Three drawings, like the Loop page:** the map, the pull requests over time, the skills.
- **Swim lanes for the pull requests over time** (direction A of four shown), to match the Loop
  page's pull-requests drawing.
- **One example across the page,** so the three drawings read as one story.

## User stories

- As a PM new to the mode, I read one page and see where the plan lives, where the code goes, and
  in which order I merge.
- As a tech lead of a target repository, I find in the drawing that my repository gets one feature
  PR, built slice by slice, and that decisions are answered in the plan repository.
- As a reader of the Invade page, I am sent to the page that tells the whole mode.

## Scope

In: `docs/guide/several-repositories.md` (new), `docs/guide/diagrams/repositories.svg`,
`pull-requests-repositories.svg`, `skills-repositories.svg` (new), `docs/guide/meta.json`,
`docs/guide/first-prd.md` (its Next link), `docs/guide/invade.md` (the section becomes a pointer),
`apps/galaxy/src/docs/guide.test.ts`.

Out: the skill pages under `/docs/skills` (built from the help entries already); the kit; any new
diagram class or change to `docs.css`.

## Test seams

- `apps/galaxy/src/docs/guide.test.ts`: the guide holds nine pages in order, with
  `several-repositories` after `first-prd` and its title; the Next links run First PRD → Several
  repositories → Use cases; the new page draws `diagrams/repositories.svg`,
  `diagrams/pull-requests-repositories.svg` and `diagrams/skills-repositories.svg`, each alone on
  its line.
- The guide's guard (`guide.ts`, run by that test) already refuses a `/omni:` skill the plugin does
  not have, an `omni` command the CLI does not have, a diagram with no file, no alt text or that
  does not read, and a code block that names nowhere to go.
- `apps/galaxy/src/docs/diagrams.test.ts` reads every diagram of the guide.

## Risks

- **What a merge publishes** (`omni kb show releasing`): the guide, served by the galaxy app
  (`/docs`), and the repository's own `docs/guide` on GitHub. Rollback: revert the merge.
- **Drawings drift from the skills.** They name skills and flags the guard checks by name only; a
  later change to the mode updates them by hand.

## Acceptance criteria

- `/docs/several-repositories` exists, after First PRD and before Use cases, titled "Several
  repositories", with the seven parts of point 1.
- It shows the three drawings, each alone on its line with alt text, following the theme in the app
  and readable on GitHub in light and dark.
- The pull-requests drawing shows one phase-0 in the plan repository, a feature PR with sub-PRs per
  target, decisions flowing into one outbox, and the merge order with the plan PR last.
- The Invade page's plan-repository section is two sentences and a link to the new page.
- `apps/galaxy/src/docs/guide.test.ts` and `diagrams.test.ts` pass, and `pnpm test` is green.
