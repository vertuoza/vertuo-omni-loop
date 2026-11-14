---
prd: 2660
title: A fix's pull request carries its issue's reference, and is ready once its fix is pushed
blocked-by: none
spec: file
phase0: server
---

## Problem

PRD 2648 lets an issue carry an external reference, `<!-- omni-ref: ABC-123 -->`, and `/omni:pr`
formats the pull request's title from it with the repository's `pr.ref` (`omni ref`, then
`gh pr edit --title`). #2658 made it work for a pull request opened in another repository. Two gaps
remain for a team whose tracker links a pull request to its ticket by the title alone:

1. **A `none` title is never upgraded.** A repository whose `pr.openWith` is its own skill lets that
   skill write the title. When the skill cannot find the reference (it reads the branch name, which a
   fix branch `fix/<n>-<slug>` never holds), it writes the format's `none` title,
   `[NoRef]-fix(planning): keep the day`. `omni ref` then keeps it as it is: `formatTitle` treats a
   title that already reads as `none` as formatted, even when the issue carries a reference. The
   pull request reaches review with no reference, and the tracker never links it.
2. **A target pull request of `/omni:mega-bug-fix` is never marked ready.** The skill opens it
   "draft until its red and its fix are pushed", but no step marks it ready. A runner job ends with
   every target pull request still a draft, though its fix is pushed and only the record pull
   request waits on the proof.

## Solution

1. **`omni ref` upgrades a `none` title when a reference exists.** With a reference and a format,
   a title that reads as `none` has the `none` text around `{title}` taken off, then the format's
   `title` applied: `[NoRef]-fix: x` with `ABC-123` becomes `[ABC-123]-fix: x`. The change is in
   `formatTitle` (`kit/lib/ref/ref.ts`); the verb, `/omni:pr` and the skills call it as they do today.
2. **A title that already carries a reference is kept.** A title that reads as the format's `title`
   with any valid reference (the marker's characters, `[A-Za-z0-9._-]{1,64}`) is left as it is, the
   issue's reference or another one: a skill that found a reference itself is never overridden, and
   no title carries two references. Only a title that reads as `none`, or reads as neither, is
   formatted. The `none` reading is tested first, so a `none` text shaped like a reference is still
   upgraded.
3. **With no reference, nothing changes:** a title takes the format's `none`, once, as today.
4. **`/omni:mega-bug-fix` marks each target pull request ready** (`gh pr ready <pr>`) once its red and
   its fix are pushed and its preflight is green, in the step that opens it. `/omni:bug-fix` does not
   change: it marks its pull request ready once `omni bug` prints `ok` on a produced proof (levels A,
   B and C). A pull request whose proof was not produced (level D) or that stopped `labels.needsFix`
   stays a draft, as today: `omni bug`'s guard is not loosened. The record pull request keeps its
   rule: ready once `omni bug <n>` prints `ok`, a draft at level D.

## Conventions

No name chosen.

## Decisions

- **The `pr.ref` format is the repository's config, never its skill** (the person's choice, over
  passing `--ref <key>` to the `pr.openWith` skill): a repository that wants its titles to carry a
  reference commits a `pr.ref` block, and the kit corrects the title after its skill opened the pull
  request. No repository's own pull-request skill has to change.
- **A title that carries another reference is kept** (reverses PRD 2648's `prefixes again when the
  title carries another ref`): two references in one title link the pull request to two tickets, and a
  skill that found one itself knows its repository. The objection of persona:B-E DEv, "my pull
  requests are renamed after the fact; if my skill already put a reference from my branch, I want no
  title with two", is settled `accepted`: this decision is the answer.
- **Ready once the fix is pushed, the proof guard kept** (the person's choice, over "always ready"
  and "ready only with a reference"): a target pull request with its red and its fix pushed is ready;
  level D and `labels.needsFix` stay a draft.
- **No proof video** (the person's answer): unit tests and mutation are the proof. A proof on
  ephemeral environments is for later.

## User stories

- As a person who links pull requests to tracker tickets by title, I hand a fix to the runner from an
  issue that carries `<!-- omni-ref: ABC-123 -->`, and the pull request it opens is titled
  `[ABC-123]-…` even when my repository's pull-request skill wrote `[NoRef]-…`.
- As a person running `/omni:bug-fix` with no reference on the issue, I get a `[NoRef]-…` pull request,
  as today.
- As a person whose pull-request skill already put a reference in the title, I find it untouched.
- As the reviewer of a `/omni:mega-bug-fix` run, I find each target pull request ready once its fix
  is pushed, not left a draft.

## Scope

In: `formatTitle` in `kit/lib/ref/ref.ts` and its tests; `/omni:mega-bug-fix`'s target pull request
step; the guide's paragraph on `omni ref`; the rebuilt bundle.

Out: `pr.ref`'s keys and their validation (unchanged); `/omni:bug-fix`'s ready rule; `omni bug`'s
guard; any repository's own pull-request skill; writing the marker on an issue, which stays the job
of whatever opens the issue; committing `pr.ref` in another repository.

## Test seams

- `kit/lib/ref/ref.test.ts`, unit: a `none` title upgraded with a reference (prefix and suffix
  formats); a title carrying another reference kept; a title already carrying this reference kept;
  a `none` title kept with no reference; a `none` text shaped like a reference still upgraded; `$`
  in a title kept literal.
- `kit/bin/ref.test.ts`, through `main()` with a fake `gh`: `omni ref 12 --title "[NoRef]-x"` on an
  issue with a marker prints `title: [ABC-123]-x`, in this repository and with `--repo`.
- A test over `/omni:mega-bug-fix`'s text: the target pull request step names `gh pr ready` once its
  red and its fix are pushed, and level D and `labels.needsFix` stay a draft.
- Mutation: `pnpm mutation:changed` on `kit/lib/ref/ref.ts`, its floor kept.

## Risks

Merging publishes the change in the next kit release: every repository with a `pr.ref` block gets
`none` titles upgraded when its issue carries a reference, and titles carrying another reference are
no longer prefixed again. Rollback: revert the pull request; the next release restores PRD 2648's
behaviour. A repository with no `pr.ref` sees no change.

- N-PRODUCT-15: only a person merges into the main branch. The design marks pull requests ready and
  merges nothing, so it keeps the law. Changing it needs @pierrederval or @dervalp to approve the
  pull request on GitHub.
- The Legal entries: none touched.
- The business laws: none touched.

## Acceptance criteria

- `formatTitle` with a format and a reference turns a title that reads as `none` into the `title`
  format around the same text: `[NoRef]-fix: x` with `ABC-123` gives `[ABC-123]-fix: x`, and with a
  suffix format `fix: x (none)` gives `fix: x (ABC-123)`.
- A title that reads as the `title` format with any valid reference is returned unchanged, the
  issue's or another.
- With no reference, a title takes `none` once, and a title that already reads as `none` is
  unchanged, as today.
- `omni ref <issue> --title "[NoRef]-x"` on an issue carrying `<!-- omni-ref: ABC-123 -->` prints
  `title: [ABC-123]-x`, with and without `--repo`.
- `/omni:mega-bug-fix`'s target pull request step marks the pull request ready with `gh pr ready`
  once its red and its fix are pushed and its preflight is green; level D and `labels.needsFix` stay
  a draft; `/omni:bug-fix`'s ready rule is unchanged.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green, the bundle is rebuilt, and the mutation
  floor of `kit/lib/ref/ref.ts` is not lowered.
