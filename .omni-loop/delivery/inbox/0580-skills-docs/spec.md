---
prd: 580
title: Skills section in the docs
blocked-by: none
spec: file
---

# Skills section in the docs

**Date:** 2026-09-29 · **PRD:** #580 · **Touches:** `kit/lib/help/` (the help table and its renderer),
`apps/galaxy/app/docs/` and `apps/galaxy/src/docs/` (two new routes, the sidebar, the search index),
and one link on `docs/guide/loop.md`. No change to any `SKILL.md`, to the guide's page order, or to
any other app page.

## Problem

The kit has 17 skills, with more coming (the multi-repo ones are being built now), and the docs at
`/docs` do not list them. A reader meets a handful of them inside the guide's pages: the loop page's
diagram and its table name three, and the rest appear only where a page happens to mention them.
Nobody, the author included, has one place that says every skill there is, what each one does,
when to reach for it and what to type.

What exists is written for other readers: each skill's `SKILL.md` is written for Claude, long and
procedural; the terminal's `omni help` has a hand-written entry per skill, but only in the terminal,
and it says what a skill does, not when to use it or what typing it looks like.

## Solution

**One source.** The skill entries of `kit/lib/help/entries.mjs`, which `omni help` already prints and
`entries.test.mjs` already holds to the skill folders, become the source of the docs too. Each skill
entry gains three fields:

| Field | What it holds |
|---|---|
| `group` | one of `start`, `build`, `setup`, `multi-repo`, `everyday`, `run-by-skills` |
| `when` | one line, a sentence that starts `Use it when` |
| `example` | `{ type, result }`: one line a person types (`/omni:yolo 580`), and one line of what they get back |

The groups, in this order, with these titles:

| `group` | Title | Skills on main today |
|---|---|---|
| `start` | Start a change | brainstorm, visual-fix, bug-fix |
| `build` | Build it | yolo, yolo-fix, plan, wave, do-work, pr |
| `setup` | Set up a repository | invade |
| `multi-repo` | Several repositories | mega-invade, mega-brainstorm |
| `everyday` | Every day | status, ask, help |
| `run-by-skills` | Run by other skills | dossier-open, dossier-push |

The group list and its titles live beside the entries (`SKILL_GROUPS` in `entries.mjs`), so the
terminal and the docs read the same list.

**In the terminal.** `omni help <skill>` (and `/omni:help <skill>`) prints, after the entry's
sentences, a blank line, then `When`, then `Example` with the typed line and, under it, `→` and the
result, all within 80 columns and wrapped like the rest. A command's entry is unchanged, and so is
the overview.

**In the docs.**

- **`/docs/skills`, the overview.** Title *Skills*, a one-line lede (*Every skill of the Omni Loop,
  by what you want to do.*), then one section per group, in the order above, headed by its title.
  Under each, one card per skill in the entries' order: its slash command (`/omni:yolo`), its
  summary, and the whole card links to its page. A group with no skill is not shown.
- **`/docs/skills/<name>`, one page per skill.** Title: the slash command. Lede: the summary. Then,
  as headings the table of contents lists:
  1. **What it does**: the `detail`.
  2. **When to use it**: the `when` line.
  3. **How to use it**: every `usage` line in one code block, then *Example*, the `example.type` in a
     code block and the `example.result` under it.
  4. **Who runs it**: for a skill run by you, *You type it in Claude Code.*; for one run by the
     skills, *Other skills run it:* and each skill whose `detail` or `when` names it, linked.
  5. **Related skills**: each other skill its `detail`, `when` or `example` names, linked, in the
     order they are named; the section is left out when there is none.
  6. A closing line linking its full instructions, `kit/plugin/skills/<name>/SKILL.md` on GitHub
     (`https://github.com/vertuoza/vertuo-omni-loop/blob/main/…`).
- **Words in braces** are filled for a reader with no repository: `{defaultBranch}` → *the default
  branch*, `{remote}` → *the remote*, and `{delivery}`, `{inbox}`, `{shipped}` → the kit's default
  folders (`.omni-loop/delivery`, `.omni-loop/delivery/inbox/`, `.omni-loop/delivery/shipped/`).
- **Every page is built at build time** from the entries, like the guide: a name with no skill is
  a 404, and nothing reads a session, a cookie or a database.
- **The sidebar** keeps the guide's eight pages, then a heading **Skills** with one link,
  *All skills* (`/docs/skills`). On a skills page, the skills follow under it, one link each in the
  overview's order, the one shown marked current. On a phone the sidebar still stacks above the page.
- **Search.** The search box finds a skill page by its slash command, its summary and its sentences,
  beside the guide's pages.
- **The loop page** (`docs/guide/loop.md`), under its table in *Which skill runs which*, gains one
  line: *Every skill, what it does and when to use it: [Skills](/docs/skills).*

## Decisions

- **D1. The help table is the one source.** No hand-written docs page for skills: a new skill folder
  with no entry already fails `entries.test.mjs`, and the new fields extend that test, so a skill
  cannot ship without its docs page.
- **D2. `SKILL.md` is not rendered.** It is written for Claude; the page links it for the curious.
- **D3. Grouped by what you want to do,** not by the loop's stages: `ask`, `help` and `status` have
  no stage.
- **D4. The docs fill `{…}` with generic words,** not with a repository's config: the docs are the
  same for every reader.
- **D5. The skills pages are their own routes** (`app/docs/skills/…`), not markdown pages of
  `docs/guide/`: the guide's order, its Next links and its guard stay as they are.
- **D6. Who runs it and Related skills are derived,** from the `/omni:<name>` the entries' words
  name; nothing is stored twice.

## User stories

- As someone new to the loop, I open `/docs/skills` and see every skill, grouped by what I want to
  do, each with one line, so I know which one to reach for.
- As the author of the kit, I open `/docs/skills/wave` and see what it does, when to use it, what to
  type and which skill runs it, without reading its `SKILL.md`.
- As a user in the terminal, `/omni:help yolo` tells me when to use it and shows an example.
- As whoever adds a skill, the tests fail until its entry has a group, a when line and an example,
  and then its docs page exists with nothing else to write.

## Scope

In: the three fields on every skill entry and their guard; the `When` and `Example` lines of
`omni help <skill>`; the `/docs/skills` and `/docs/skills/<name>` routes; the sidebar's Skills
heading; the search index; the one line on the loop page.

Out: rewriting any `SKILL.md`; entries for commands (they get no docs page); the skills of the
ultra-yolo PRD (#563) that are not on `main` yet (they get their fields when they land, and the
test forces it); translating the docs.

## Test seams

Tests sit beside the code they test (`omni kb show testing`) and never call GitHub or Supabase.

- **`kit/lib/help/entries.test.mjs`:** every skill entry has a `group` from `SKILL_GROUPS`, a
  one-line `when` starting `Use it when`, and an `example` with a one-line `type` starting
  `/omni:<its name>` and a one-line `result`; a command entry has none of the three. Each rule on
  the live table, then on a fixture built to break it, as the file does today.
- **`kit/lib/help/render.test.mjs`:** `renderEntry('yolo')` prints the When and Example lines after
  the sentences, within 80 columns; a command's entry prints neither; the overview is unchanged.
- **`apps/galaxy/src/docs/skills.test.ts`** (a pure module, `src/docs/skills.ts`): the overview's
  groups in order with their skills, an empty group left out; a page model per skill with its
  sections; braces filled with the generic words; *Who runs it* for `dossier-push` naming
  `brainstorm` and `plan`; *Related skills* in naming order, without the skill itself; a page for
  every skill folder under `kit/plugin/skills`.
- **A render test** (as `docs.test.ts` does, `renderToStaticMarkup`): the overview and one skill
  page drawn in `DocsPage`, the sidebar holding the guide's eight pages then *Skills*, and on a skill
  page the skills' links with the current one marked.
- **The search index:** holds `/docs/skills/<name>` for every skill beside the guide's pages.
- **The guide guard** (`guide.test.ts`) stays green, the loop page's new link included.
- Manual: `/docs/skills` and one skill page in a browser, light and dark, desktop and phone.

## Risks

- **What merging publishes:** the kit (`kit/dist/omni.mjs`, rebuilt, and the plugin) with the longer
  `omni help <skill>`, and the galaxy app's `/docs` pages. No migration, no stored shape, no shared
  contract. Rollback: revert the feature PR; nothing to undo elsewhere.
- **Wording drift across branches:** a skill added on another branch (the ultra-yolo PRD's) fails
  `entries.test.mjs` on the first merge that meets this one, until its entry gets the three fields.
  That is the guard doing its job; the fix is three lines per skill.
- **Static routes beside the catch-all:** `/docs/skills` must win over `/docs/[[...slug]]`, whose
  `dynamicParams` is false. A build that serves the guide's 404 there is caught by the render test
  only in part; the browser check covers the rest.

## Acceptance criteria

- `/docs/skills` lists every skill folder under `kit/plugin/skills`, once each, under its group's
  title, groups in the order *Start a change*, *Build it*, *Set up a repository*, *Several
  repositories*, *Every day*, *Run by other skills*, each card linking to its page.
- `/docs/skills/<name>` exists for every skill and shows, in order, What it does, When to use it,
  How to use it (usage and example), Who runs it, Related skills (when any), and the link to its
  `SKILL.md`; no `{…}` is left on any page.
- `/docs/skills/dossier-push` says other skills run it and links `/omni:brainstorm` and `/omni:plan`.
- `/docs/skills/nope` is a 404.
- The docs sidebar shows the guide's eight pages, then *Skills* › *All skills*; on a skills page, every
  skill's link under it, the current one marked.
- Searching `wave` in the docs search box offers `/docs/skills/wave`.
- `omni help yolo` prints a `When` line and an `Example` with its result after the sentences, every
  line within 80 columns; `omni help board` is unchanged.
- A skill entry missing `group`, `when` or `example` fails `pnpm test`.
- The loop page links `/docs/skills` under *Which skill runs which*.
