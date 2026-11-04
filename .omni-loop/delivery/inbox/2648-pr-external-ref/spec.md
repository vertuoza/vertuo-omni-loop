---
prd: 2648
title: A pull request carries its issue's external reference
blocked-by: none
spec: file
phase0: server
---

## Problem

Many teams track work in a tracker other than GitHub, and name every pull request after its ticket:
`[ABC-123]-fix(planning): keep the absent day on save`. Some enforce it: a check refuses a title
with no key, or one with a key but no link to the ticket in its body. Some build a preview
environment only when the title carries a key.

When a tool files an issue for the loop (a support or triage tool, sending the issue to a runner),
the issue knows the ticket: its title or a line of its body names it. The pull request the loop
opens for it does not. `/omni:bug-fix` and `/omni:visual-fix` title their pull request with the
commit's subject, and `/omni:pr` passes that title to `gh pr create`. The pull request then fails
the repository's title check, or skips the preview, and a person renames it by hand.

The only way out today is `pr.openWith`: teach the repository's own pull-request skill to dig the key
out of the issue's prose. Each repository then carries its own copy of the same lookup, written for
an agent to interpret, and the lookup drifts from one repository to the next.

## Solution

The issue carries the key in a form the kit can read without judgment, and the kit puts it in the
title and the body, in the format each repository declares.

1. **The marker.** An issue's body may hold one line `<!-- omni-ref: <ref> -->`. `<ref>` is 1 to 64
   characters of letters, digits, `.`, `_` and `-`. The first marker in the body counts; a line
   that does not match the shape is not a marker. Whoever files the issue writes it: a tool, or a
   person. The kit never writes one. The marker is an HTML comment, so GitHub does not render it.
2. **The config, `pr.ref`.** In `.omni-loop/config.yml`, under `pr`:

   ```yaml
   pr:
     ref:
       title: "[{ref}]-{title}"                 # must hold {ref} and {title}
       none: "[NoRef]-{title}"                  # with no marker; null: the title is left as it is
       link: "https://tracker.example/{ref}"    # null: no link line
   ```

   `pr.ref` is `null` by default, and then nothing in this PRD changes anything. `omni check`
   refuses a `title` without `{ref}` or `{title}`, a `none` without `{title}`, and a `link` without
   `{ref}` or that is not an `https://` URL, naming the key.
3. **The verb, `omni ref <issue> --title "<title>"`.** It reads the issue's body with `gh`, and
   prints two lines: `title: <the formatted title>` and `link: <the link>` (or `link: none`). With
   `--json` it prints `{ ref, title, link }`, `ref` being `null` with no marker. It is idempotent:
   a title that already reads as the format with this ref (or as `none`) is printed unchanged, never
   prefixed twice. With `pr.ref` null, it prints the title unchanged and `link: none`. An issue it
   cannot read (`gh` fails, no such issue) exits 1 with one line naming it; the skill then opens the
   pull request with its title unchanged and says so.
4. **Where it is applied: point `pr.open` of `/omni:pr`,** for a feature, landing or standalone
   pull request that has an issue: the issue `--issue` names for a bug fix or a visual update, the
   PRD's issue for a feature or landing PR. A sub-PR never is.
   - **With no `replace`:** the title passed to `gh pr create` is the one `omni ref` printed, and
     its `link` line, when it is not `none`, is one of Omni's lines at the top of the body.
   - **With a `replace` (or `pr.openWith`):** the skill opens the pull request as today. Then, when
     `omni ref` prints a title other than the pull request's, the kit sets it with
     `gh pr edit <n> --title`, and adds the link line when it completes the body (step 3 of
     **Opening**). The skill's title is formatted, never replaced: `{title}` is the skill's title.
5. **The triage line.** `/omni:bug-fix` reads the marker when it reads the issue, and its triage
   comment gains `- **Ref:** <ref>` (or `- **Ref:** none`) when `pr.ref` is set, so a person sees
   a wrong key on the issue before any pull request is opened. With `pr.ref` null, there is no line.
6. **The guide.** `docs/guide/flow.md` documents the marker, `pr.ref` and `omni ref` beside
   `pr.openWith`.

The runner and its job do not change: the runner runs `/omni:bug-fix` on the issue, and the marker
is in the issue. A person running `/omni:bug-fix` on the same issue gets the same title.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | config key | `pr.ref` (`title`, `none`, `link`) | no written convention: follows `pr.openWith` ← `kit/lib/config.ts:388` and `prLinks` ← `kit/lib/config.ts:380` (`{name}` placeholders) |
| vertuo-omni-loop | CLI verb | `omni ref` | no written convention: follows `omni visual`, `omni bug` ← `kit/bin/commands/index.ts:81` |
| vertuo-omni-loop | marker | `<!-- omni-ref: <ref> -->` | no written convention: follows `<!-- omni-bug:triage -->` ← `kit/plugin/skills/bug-fix/SKILL.md:163` (an `omni-` HTML comment) |
| vertuo-omni-loop | module | `kit/lib/ref/` | no written convention: follows `kit/lib/bug/` (one folder per verb) |

## Decisions

- **The key is a marker in the issue, not a field of the runner's job.** It works the same whether
  a runner or a person runs the skill on the issue, and it needs no change to the runner's API.
  Settled with the person during the design.
- **The kit formats, the repository's skill does not change.** The format is three lines of config
  per repository, read by the CLI, instead of a lookup written in each repository's skill.
- **With a `replace`, the kit corrects the title after the skill opens the pull request,** with
  `gh pr edit`, rather than passing the ref to the skill: no repository's skill needs to learn a new
  argument. The `{title}` of the format is the skill's own title.
- **The objection,** from persona:B-E DEv: a marker in an HTML comment is invisible, so a wrong key
  would only show once the pull request is open with a wrong title. Accepted: the triage comment
  of `/omni:bug-fix` shows the ref it found (Solution, item 5).
- **No proof video:** the change is a CLI verb and a title; there is nothing to film.
- **Out of this PRD:** the tool that files the issues writes the marker, in its own repository;
  each repository that wants the format adds `pr.ref` to its config once this ships.

## User stories

- As a team whose title check wants a ticket key, I want the loop's pull requests to carry the key
  of the issue's ticket, so the check passes without a person renaming them.
- As a team that names no ticket, I want nothing to change until I set `pr.ref`.
- As the person reading the triage on an issue, I want to see which ref the loop found, so a wrong
  key is fixed on the issue before the pull request.
- As a repository that opens its pull requests with its own skill, I want the format applied
  without changing that skill.

## Scope

In:
- the `pr.ref` config section and its checks;
- the marker's reading and the title's formatting, in `kit/lib/ref/`;
- the `omni ref` verb, its help and its `--json`;
- `/omni:pr`'s point `pr.open` (with and without a `replace`), `/omni:bug-fix`'s triage line;
- `docs/guide/flow.md`.

Out:
- writing the marker (the filing tool's job);
- any repository's config;
- sub-PRs, phase-0 PRs, retro and concept PRs;
- reading a key from the issue's title or prose: only the marker counts.

## Test seams

- `kit/lib/ref/`: pure functions, tested alone. Reading the marker (first one wins, a malformed one
  ignored, the length and character bounds) and formatting (`title`, `none` set or null, `link` set
  or null, idempotence on a title already formatted).
- `kit/lib/config.ts`: `pr.ref` defaults to null, and each refusal names its key.
- `omni ref`: driven with a fake `gh`, as the other verbs' tests do; its two-line and `--json`
  outputs, and exit 1 with one line on an issue it cannot read. No test calls GitHub.
- The skills: `/omni:pr`'s text calls `omni ref` at point `pr.open` for both paths, and
  `/omni:bug-fix`'s triage template has the **Ref** line; read by the kit's skill-text tests.
- `kit/dist/` rebuilt; `kit/test/dist.test.ts` stays green.

## Risks

- **What merging publishes:** a new config key, a new verb and two skill changes, released with the
  next kit version. A repository with no `pr.ref` sees no change. Rollback: remove `pr.ref` from a
  repository's config, or revert the PR; no data is stored.
- **A wrong marker** puts a wrong key in a title. The triage line shows it before the pull request,
  and the marker is fixed on the issue.
- **The Legal entries:** none touched. The ref is a ticket key, not personal data or a credential.
- **The locked laws:** the design changes `/omni:pr` at point `pr.open`, a file the following laws
  govern, without changing them: the pull request stays a draft, no label is added and nothing
  merges.
  - BR-PRODUCT-3: an agent could wave its own work through the gate. Changing it needs @pierrederval
    or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-5: a person could merge work whose open decisions nobody answered. Changing it needs
    @pierrederval or @dervalp to approve the pull request on GitHub.
  - N-PRODUCT-15: unreviewed work could reach every user. Changing it needs @pierrederval or
    @dervalp to approve the pull request on GitHub.

## Acceptance criteria

- With `pr.ref` null, `omni ref <issue> --title "fix: x"` prints `title: fix: x` and `link: none`,
  and every pull request the loop opens has the title it has today.
- With `pr.ref.title: "[{ref}]-{title}"`, an issue whose body holds `<!-- omni-ref: ABC-123 -->`
  and the title `fix(planning): keep the day` give `title: [ABC-123]-fix(planning): keep the day`.
- Run again on `[ABC-123]-fix(planning): keep the day`, `omni ref` prints the same title.
- With no marker and `none: "[NoRef]-{title}"`, the title is `[NoRef]-fix(planning): keep the day`;
  with `none: null`, it is unchanged.
- With `link: "https://tracker.example/{ref}"` and a marker, `omni ref` prints
  `link: https://tracker.example/ABC-123`, and the pull request's body carries that link among
  Omni's lines.
- A body whose first marker is malformed (`<!-- omni-ref: ABC 123 -->`) and a later valid one reads
  the later one; a body with two valid markers reads the first.
- `omni check` refuses `pr.ref.title: "[{ref}]"`, naming `pr.ref.title`.
- In a repository with `pr.openWith`, a pull request the skill opened as `fix: x` for an issue with
  the marker ends up titled `[ABC-123]-fix: x`.
- A sub-PR's title is never formatted.
- With `pr.ref` set, `/omni:bug-fix`'s triage comment on the issue shows `- **Ref:** ABC-123`.
