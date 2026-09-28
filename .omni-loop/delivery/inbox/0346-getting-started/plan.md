# Plan: Getting Started docs and a shared top bar with Release notes

PRD #346, spec beside this plan (`spec.md`). The feature branch `feat/getting-started` merges into
`main` through the feature PR, whose body says `Closes #346`. Each slice is a sub-PR from
`feat/getting-started--<slice>` into the feature branch, whose body says `Part of #346`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | One shared top bar with Release notes on every page of the normal app. Covers: the `TopBar` component (mark to `/app`, sub-title, the Release notes item, theme switch, game button, an optional extras slot, `aria-current="page"` on the current item); `/app`, `/releases`, `/prd`, `/ask` and `/knowledge` rendering it in place of their copied `ask-bar` headers, "All PRDs" and "Open the star chart →" kept as extras; Release notes out of `SECTIONS`, four cards on `/app`; the header and render tests | `apps/galaxy/src/nav/` `apps/galaxy/app/app/` `apps/galaxy/app/releases/` `apps/galaxy/app/prd/` `apps/galaxy/app/ask/` `apps/galaxy/src/ask/page/AskBar` `apps/galaxy/src/knowledge/KnowledgeScreen` `apps/galaxy/src/switch/` | — | 1 |
| s2 | HOME's "Join the loop!" block has a GETTING STARTED button to `/docs`. Covers: the third call to action in `OrderForm`, in the button style of PRESS START, its test, and `lingo.test.ts` still green | `apps/galaxy/src/home/spreads/OrderForm` | — | 1 |
| s3 | `/docs` renders the guide with Fumadocs headless, in the app's own look, reached from the top bar. Covers: `fumadocs-core` and `fumadocs-mdx` added to galaxy and wired into its Next config; the `/docs` and `/docs/<page>` routes, built statically and public; our layout and CSS in `src/docs/` from `@omni/design` tokens, both themes, with the sidebar in the page order, each page's table of contents and search; `TopBar` gaining the Docs item, current on `/docs`; `docs/guide/` with the Getting started page written in full and the other four pages as titled stubs with their Next links, and the order file; the docs guard test (skills and commands named exist, titles, Next links resolve, the five pages in order); the design-system guard covering the docs' CSS. When Fumadocs does not build on Next 16, the fallback the spec names: the same files rendered with `markdown-it` and our own sidebar | `docs/guide/` `apps/galaxy/app/docs/` `apps/galaxy/src/docs/` `apps/galaxy/src/nav/` `apps/galaxy/src/design-system` `apps/galaxy/package.json` `apps/galaxy/next.config.mjs` `apps/galaxy/source.config` `apps/galaxy/tsconfig.json` `pnpm-lock.yaml` | s1 | 2 |
| s4 | The Install and Invade pages, written in full. Covers: Node 22+, `gh auth login`, Claude Code; `npx github:vertuoza/vertuo-omni-loop init` and merging `.omni-loop/`; the plugin marketplace and `/plugin install omni@omni-loop`; the GitHub App `omni-loop-invader`; `omni signin`; checking with `omni config`, `omni help`, `omni status`; `/omni:invade`, what it asks and writes, and merging its PR | `docs/guide/install.md` `docs/guide/invade.md` | s3 | 3 |
| s5 | The Your first PRD and When something goes wrong pages, written in full. Covers: `/omni:brainstorm`, the phase-0 PR and its merge, `/clear` then `/omni:yolo <n>`, the outbox on the feature PR and `/omni:yolo-fix <n>`, merging the feature PR, the release note; the errors (`omni config` failing, a missing `omni:` label, `no sign-in (omni signin)`, "Deployment was blocked" on Vercel) and their fixes | `docs/guide/first-prd.md` `docs/guide/troubleshooting.md` | s3 | 3 |

**Shared ground.** Two prefixes are declared by more than one slice, and the waves keep them apart:

- `apps/galaxy/src/nav/`: s1 (wave 1) creates `TopBar` with the Release notes item; s3 (wave 2)
  adds the Docs item to it and its test.
- `docs/guide/`: s3 (wave 2) owns the whole folder, creating every page (four as stubs) and the
  order file; s4 and s5 (wave 3) each own two page files by name, and never touch the order file,
  so they do not meet each other.

The ordering has reasons behind it:

- s2 has no blocker: its link to `/docs` is a plain `href`, tested as such, and the feature branch
  has the page by the time it ships.
- s3 follows s1: the docs render inside `TopBar` and add its Docs item.
- s4 and s5 follow s3: they fill the stubs s3 creates, and the docs guard s3 writes checks them.

## Per slice: done when

**s1**
- `/app`, `/releases`, `/prd`, `/ask` and `/knowledge` each render `TopBar`, with a Release notes
  link to `/releases`; no `ask-bar` header is copied in a layout any more.
- On `/releases` the Release notes item carries `aria-current="page"`; on the others it does not.
- `/prd` still shows "All PRDs", and `/knowledge` still shows "Open the star chart →".
- `SECTIONS` has no Release notes entry, and `/app` renders four cards: Questions, For me, History,
  Knowledge map.
- `pnpm test` is green.

**s2**
- The "Join the loop!" block renders a GETTING STARTED link with `href="/docs"`, beside PRESS
  START.
- The poster at the top of HOME is unchanged, and `lingo.test.ts` passes.

**s3**
- `/docs` renders Getting started, and `/docs/install`, `/docs/invade`, `/docs/first-prd` and
  `/docs/troubleshooting` render their titles; all five are built statically and need no sign-in.
- The sidebar lists Getting started, Install, Invade, Your first PRD and When something goes wrong,
  in that order; each page's Next → points to the following page, the last one back to Getting
  started.
- `TopBar` shows Docs on every page that shows it, marked current on `/docs`.
- The docs guard fails on a `/omni:<name>` with no `kit/plugin/skills/<name>/`, on an `omni
  <command>` with no `kit/bin/commands/<command>.mjs`, on a page with no title, and on a Next link
  that resolves to no page; it passes on `docs/guide/`.
- The docs' CSS uses `@omni/design` tokens only, and `src/design-system.test.ts` covers it.
- `pnpm test` is green, and `next build` of galaxy builds the docs pages.

**s4**
- Install lists every step the spec names, each command in a code block, and ends with how to
  check it worked.
- Invade says what `/omni:invade` asks, what it writes, the PR it opens, and that a person merges
  it.
- The docs guard passes.

**s5**
- Your first PRD walks from `/omni:brainstorm` to the release note, naming what the person sees
  and does at each step.
- When something goes wrong has the four errors the spec names, each with its fix.
- The docs guard passes.
