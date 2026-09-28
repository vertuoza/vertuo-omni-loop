---
prd: 346
title: Getting Started docs and a shared top bar with Release notes
blocked-by: none
spec: file
---

# Getting Started docs and a shared top bar with Release notes

**Date:** 2026-09-28 · **PRD:** #346 · **Touches:** a new `docs/guide/` folder of markdown pages,
a `/docs` section in the galaxy app (`apps/galaxy`) rendered with Fumadocs, one shared top bar
replacing the five copied `ask-bar` headers, the `/app` section cards (`SECTIONS`), and HOME's
"Join the loop!" footer.

## Problem

Omni Loop is about to be tried for the first time on a real repository, by a colleague on a blank
laptop. Nothing tells that person how to start:

- **No docs.** How to install the kit is spread across `README.md`, `kit/README.md` and the lines
  `omni init` prints. Invading a repository and taking a first PRD through the loop are written
  nowhere in one place. The galaxy app has no docs page at all.
- **Release notes sit in the wrong place.** In the normal app they are one of the five cards on
  `/app`, beside the person's own sections (Questions, For me, History, Knowledge map). They are
  meant to become the release notes *of the repository being invaded*, which is something every
  page of the app should reach, like a menu, not one section among the person's work.
- **No shared top bar.** Each layout copies its own `<header className="ask-bar">`
  (`app/app/layout.tsx`, `app/releases/layout.tsx`, `app/prd/layout.tsx`,
  `src/ask/page/AskBar.tsx`, `src/knowledge/KnowledgeScreen.tsx`), so a menu item added to one
  bar is missing from the others.

## Solution

### The docs

- The words live as markdown files in `docs/guide/` at the repository root, one file per page, in
  this order:
  1. **Getting started** (`index`): what you will have at the end (a repository run by the loop,
     your first PRD shipped), and what you need first: a GitHub repository you administer, Claude
     Code, and an Omni Loop invite (the app is invite-only while in beta).
  2. **Install:** on the laptop, Node 22 or later, the `gh` CLI signed in (`gh auth login`), and
     Claude Code. In the repository, `npx github:vertuoza/vertuo-omni-loop init`, then committing
     `.omni-loop/` and merging it. In Claude Code, `/plugin marketplace add
     vertuoza/vertuo-omni-loop` then `/plugin install omni@omni-loop`. The GitHub App
     `omni-loop-invader` (https://github.com/apps/omni-loop-invader/installations/new). `omni
     signin`, once per computer. How to check it worked: `omni config`, `omni help`, `omni status`.
  3. **Invade:** `/omni:invade`. What it asks, what it writes under `.omni-loop/knowledge`, the
     pull request it opens, and that a person merges it.
  4. **Your first PRD, end to end:** `/omni:brainstorm` with an idea; review and merge the phase-0
     PR; `/clear`, then `/omni:yolo <n>`; read the outbox on the feature PR and answer it, then
     `/omni:yolo-fix <n>` when an answer disagrees; merge the feature PR; see the PRD's release
     note under Release notes. Each step names what the person sees (the PR, the label, the
     dossier link) and what they do next.
  5. **When something goes wrong:** the errors a first run meets and their fix, at least: `omni
     config` failing (the kit is not installed), a missing `omni:` label, `no sign-in (omni
     signin)`, and "Deployment was blocked" on Vercel (commits authored by an email Vercel does not
     know).
- Every page ends with a **Next →** link to the following page; the last one links back to
  Getting started.
- The galaxy app renders them at **`/docs`** (Getting started) and **`/docs/<page>`**, public, no
  sign-in, built statically. `fumadocs-mdx` compiles the files and `fumadocs-core` gives the page
  tree (the sidebar, in the order above), each page's table of contents, and search. The layout
  and its CSS are ours, in `apps/galaxy/src/docs/`, drawn with `@omni/design` tokens, so the docs
  look like the rest of the app, in both themes. Fumadocs' ready-made UI is not used: it brings
  Tailwind, which the app does not use.

### One shared top bar

- A new `TopBar` component (`apps/galaxy/src/nav/`) is the only header of the normal app. It holds,
  from left to right: the OMNI LOOP mark linking to `/app`, the page's sub-title, the menu items
  **Release notes** (`/releases`) and **Docs** (`/docs`), the theme switch and the game button.
- The item of the page being shown is marked as current (`aria-current="page"`).
- A page that needs an extra link in its bar ("All PRDs" on `/prd`, "Open the star chart →" on
  `/knowledge`) passes it to `TopBar`; nothing else differs between bars.
- It replaces the headers of `/app`, `/releases`, `/prd`, `/ask` and `/knowledge`, and it is the
  header of `/docs`.

### The `/app` cards

- Release notes leaves `SECTIONS` (`src/switch/switch.ts`). `/app` shows four cards: Questions,
  For me, History, Knowledge map. `/releases` itself does not change.

### HOME

- The "Join the loop!" block at the bottom of HOME (`src/home/spreads/OrderForm.tsx`) gets a third
  call to action, **GETTING STARTED**, a link to `/docs`, beside PRESS START and in the same button
  style. The poster at the top of HOME does not change.

## Decisions

- **Markdown files, rendered by a docs framework inside galaxy.** The person asked for markdown
  rendered by a real docs tool. Fumadocs, mounted in the existing Next.js app, keeps one deploy
  and one domain and lets the top bar link to it directly; VitePress or Starlight would have been a
  second site and a second Vercel project.
- **Fumadocs headless, not its UI, and not Nextra.** The app is plain CSS with `@omni/design`
  tokens and a design-system guard; Fumadocs UI needs Tailwind, and Nextra's theme looks like
  Nextra.
- **`docs/guide/`, not `docs/`.** `docs/` already holds `assets/` and `superpowers/` design notes,
  which are not user docs.
- **Only Release notes and Docs in the bar.** The person's own sections stay as cards on `/app`.
- **Release notes stay the loop's own for now.** Showing the invaded repository's release notes
  is a later PRD; the menu item keeps its place and label, and only its data source will change.

## User stories

- As a developer on a blank laptop, I open the Omni Loop home page, press GETTING STARTED, and
  follow the pages in order until my first PRD's phase-0 PR is open, without asking anyone.
- As that developer, when a command fails, I find its error and its fix on "When something goes
  wrong".
- As someone using the app, I reach Release notes and Docs from the top bar of every page.

## Scope

In: the five markdown pages; `/docs` rendered with Fumadocs headless and our own layout and CSS;
the `TopBar` component and its use in every app layout; Release notes out of `SECTIONS`; the
GETTING STARTED button in HOME's "Join the loop!" block; the tests below.

Out: the invaded repository's release notes; sign-up with GitHub; screenshots or videos in the
docs; docs for the game layer, the arcade or `/play`; changing `/releases` itself; changing the
kit's READMEs (they may link to the docs in a later PRD).

## Test seams

Vitest, with `renderToStaticMarkup` for pages and layouts, as galaxy's tests already do
(`src/switch/render.test.ts`); tests beside the code under `apps/galaxy/src/`.

- **Top bar:** every layout of `/app`, `/releases`, `/prd`, `/ask`, `/knowledge` and `/docs`
  renders `TopBar`, with a Release notes link to `/releases` and a Docs link to `/docs`; the item
  of the current section carries `aria-current="page"`; the "All PRDs" and star-chart extras
  still render where they did. `src/switch/headers.test.ts` is updated, not deleted.
- **`/app`:** `SECTIONS` has no Release notes entry, and `/app` renders four cards.
- **HOME:** the "Join the loop!" block has a GETTING STARTED link to `/docs`; `lingo.test.ts`
  still passes.
- **Docs guard** (a test over `docs/guide/*.md`):
  - every `/omni:<name>` written in the pages exists as `kit/plugin/skills/<name>/`;
  - every `omni <command>` written in the pages exists as `kit/bin/commands/<command>.mjs`;
  - every page has a title, and its Next link resolves to another page of `docs/guide/`;
  - the five pages exist, in the order above.
- **Docs pages:** `/docs` and each `/docs/<page>` render their title and body, and the sidebar
  lists the five pages in order.
- **Design system:** `src/design-system.test.ts` covers the docs' CSS (tokens only, no raw
  colours).

A test never reaches the network, GitHub or Supabase.

## Risks

- **A new dependency on a new Next.js.** Fumadocs on Next 16 and React 19 may not build. The
  fallback keeps the same markdown files and renders them with the `markdown-it` the dossier pages
  already use, with our own sidebar built from the folder; only the renderer changes.
- **What merging publishes.** The galaxy app is deployed from this repository: merging publishes
  the public `/docs` pages (the kit's install steps, which are already public in the repository),
  the new top bar on every app page, and the HOME button. No database change, no migration, no
  change to the kit or the plugin.
- **Rollback:** revert the feature PR. Nothing is stored, so nothing needs cleaning.

## Acceptance criteria

- `/docs` shows Getting started, and the sidebar lists Getting started, Install, Invade, Your first
  PRD and When something goes wrong, in that order; each page's Next → opens the following page.
- On HOME, the "Join the loop!" block shows a GETTING STARTED button that opens `/docs`.
- Every page of the normal app (`/app`, `/releases`, `/prd`, `/ask`, `/knowledge`, `/docs`) shows
  the same top bar, with Release notes and Docs; the current one is marked.
- `/app` shows four cards, and none of them is Release notes.
- Every `/omni:` skill and `omni` command the docs name exists in the kit (the docs guard is
  green).
- The docs render in the app's own look, in the light and the dark theme.
- Manual proof, after merge: a colleague on a blank laptop, following `/docs` alone, gets a real
  repository installed, invaded, and their first PRD's phase-0 PR open. Every place they get stuck
  becomes a fix to the docs.
