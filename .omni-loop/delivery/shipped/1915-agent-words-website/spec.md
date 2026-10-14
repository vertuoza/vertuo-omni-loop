---
prd: 1915
title: Coding agents on every screen — the app speaks of the agent, HOME says who it works with
blocked-by: none
spec: file
phase0: server
---

## Problem

The kit runs from any coding agent since the agent-agnostic series (#1831 hook-free commands, #1858
neutral skill wording, #1890 install for any agent), and PR #1907 rewords the `/docs` guide to
match. The website's own screens still say Claude: `/ask` shows "Claude is working", "Send to
Claude" and the tab title "Claude asks"; the play dock says "▶ Play while Claude works", "⏸ CLAUDE
ASKED · ANSWER" and "CLAUDE IS DONE"; the PRD page says "Claude is watching"; HOME's order form says
"Omni Loop runs on Claude Code". A team on Codex, Cursor or Gemini CLI reads, on every screen, that
the product is not for them, and HOME never says which agents it works with.

## Solution

1. **HOME's poster** gains one line under its three ★ promises, in the promises' type and white:
   one row of short items split by yellow dots, `WORKS WITH · CLAUDE CODE · CODEX · CURSOR ·
   GEMINI CLI · ANY CODING AGENT`, wrapping on a narrow screen. Its last item, ANY CODING AGENT, is a
   link to `/docs/any-agent`, the guide page that shows how each agent runs a skill. The order
   form's fine print "Omni Loop runs on Claude Code. Free while in beta: sign up with GitHub." becomes
   two lines, "Runs on your coding agent." and "Free while in beta." (the sign-up call already sits
   above its buttons). The strategy guide's "You talk an idea through with Claude." becomes "You
   talk an idea through with your agent." and its mover line "a person decides, with Claude for the
   idea" becomes "a person decides, with the agent for the idea".
2. **Every other screen** says "the agent" or "your agent" where its words mean whoever runs the
   loop. The full list of strings, today and after:

   | Where | Today | After |
   |---|---|---|
   | `/ask` working card | Claude is working | The agent is working |
   | `/ask` working card | The next question shows here as soon as Claude asks. Keep this tab open. · No questions yet. The first one shows here as soon as Claude asks. | The next question shows here. · Keep this tab open. (two lines) · No questions yet. · The first one shows here. (two lines) |
   | `/ask` moved card | … so Claude asks this in the terminal instead … | … so the agent asks this in the terminal instead … |
   | `/ask` send button | Send to Claude | Send to the agent |
   | `/ask` round's label | Claude asks | The agent asks |
   | `/ask` lead block | Claude wrote before asking | The agent wrote before asking |
   | `/ask` sign-in card | Sign in to answer Claude · This page shows Claude's questions … | Sign in to answer your agent · This page shows your agent's questions … |
   | `/ask` tab title | Claude asks · OMNI LOOP | Your agent asks · OMNI LOOP |
   | `/ask` empty states | … in a Claude Code terminal · Each tab is one Claude Code terminal · … while Claude waits for it · Every question Claude asks your workspace … · … cannot show Claude's questions | … in your coding agent's terminal · Each tab is one agent's terminal · … while the agent waits for it · Every question an agent asks your workspace … · … cannot show the agent's questions |
   | `/ask` layout description | Claude's questions, on a page made for reading. | Your agent's questions, on a page made for reading. |
   | `/ask` question fallback | … so Claude asks it in the terminal instead. | … so the agent asks it in the terminal instead. |
   | play dock | ▶ Play while Claude works · ⏸ CLAUDE ASKED · ANSWER · CLAUDE IS DONE · Play a game while Claude works | ▶ Play while the agent works · ⏸ AGENT ASKED · ANSWER · AGENT IS DONE · Play a game while the agent works |
   | PRD page, Care tab | Claude is watching · last round N min ago | The agent is watching · last round N min ago |
   | PRD page, Pitch | Run it in Claude Code, in this repository. … | Run it in your coding agent, in this repository. … |
   | PRD page, Questions | The questions Claude asks with ask mode on … | The questions the agent asks with ask mode on … |
   | Concepts, empty | Start one in Claude Code: | Start one in your coding agent: |
   | browser alert | Claude is asking: <question> | Your agent is asking: <question> |
   | docs skill pages | You type it in Claude Code. · Its full instructions, written for Claude: | You type it in your coding agent. · Its full instructions, written for the agent: |
   | release notes (`releases/words.ts`) | … Claude Code plugin … | … plugin for Claude Code, skills for any coding agent … |
   | guide diagrams `loop.svg`, `roadmap.svg` | with Claude · YOU + CLAUDE · Claude builds | with the agent · YOU + AGENT · the agent builds |
   | demo data shown on `/ask` and the PRD page (`ask/page/demo.ts`, `dossier/page/demo.ts`, `releases/demo.ts`) | Claude's questions, Claude Code session | the agent's questions, coding-agent session |

   The exact words of each row are the after column; a string the table does not list but that a
   slice finds saying Claude in the same sense is changed the same way and recorded as an outbox
   item.
3. **What keeps a product name,** because there it is a fact, not the product's voice: the Connect
   agent card's Claude Code row and its hint (`claude mcp add …` is Claude Code's own command; the
   card already names Cursor and any MCP client beside it), model ids in a round's cost line and the
   price table (`claude-sonnet-4-6`), HOME's new line, and every code identifier, comment, API field
   and database column (`claude_session_id`, `claudeSessionId`). No migration, no endpoint change.
4. **A guard test,** `apps/galaxy/src/agent-words.test.ts`: it parses every non-test `.ts`/`.tsx`
   file under `apps/galaxy/src` and `apps/galaxy/app` with the TypeScript compiler API and fails on
   "Claude" (any case) inside JSX text, a JSX attribute string, a string literal or a template
   literal's text, outside a named allowlist of files and literals, each with its reason: the
   agent-connect setup (`agent-connect/tokens/model.ts`, `ConnectAgentCard.tsx`), the price table
   (`ask/prices.ts`), demo model ids, and HOME's works-with line (`home/poster/Poster.tsx`). The two guide diagrams are read as
   text, and "claude" is refused in them too. Each screen's existing render tests change their
   expected strings to the after column.
5. **The screen library:** the drafts `home` (its mockup too) and `prd-dossier` get the new words in
   their **Words** section and this PRD in their **Source**; none is locked.

## Decisions

- **Placement** (asked): the works-with line sits in HOME's poster, above the fold, under the
  promises; the order form's fine print becomes neutral rather than repeating the line.
- **Cursor** (asked): named in the line, since `omni init --agent cursor` installs for it (PRD 1890):
  the line names every agent the `agents` key accepts, then "any coding agent".
- **The word** (asked): "the agent" or "your agent", the short form, so the dock's pill and the
  buttons keep their width; HOME's poster keeps "coding agents" as today.
- **The `/docs` guide's prose is #1907's,** not this PRD's: this PRD touches only the two diagrams
  #1907 leaves, so the two pull requests never edit the same file.
- **The word pass** (design words) holds every "after" screen under its limits: the works-with
  line is short items with one short link rather than an 11-word link, and the fine print and the
  `/ask` hint are split into short sentences. The pitch above the promises keeps today's finding
  (31 words at rest): it is not changed here.
- **The link** goes to `/docs/any-agent`, which exists on `main`; #1907 adds its per-agent table.
  Should #1907 not merge first, the page still explains how any agent runs the loop.
- **Voice objection** (persona:B-E DEv): "A row of agent names on the home page is exactly the
  fluff I expect; if it doesn't show me how Codex actually runs a skill, I'll assume only Claude
  works." Settled `accepted`: the line's last item links to the page that shows each agent's form.
- **Names that stay** are facts (a command only Claude Code runs, a model id), never the voice of
  the product; the guard's allowlist names each one with its reason.

## User stories

- As a developer whose team runs Codex, I open HOME and read, above the fold, that the loop works
  with my agent, and one click shows me how it runs a skill.
- As a person answering on `/ask` while Gemini CLI works, the page says "The agent is working" and
  "Send to the agent", never a product I do not use.
- As a player in the dock while Cursor builds, the pill says "▶ Play while the agent works" and the
  pause says "⏸ AGENT ASKED · ANSWER".
- As a maintainer, I add a string that says "Claude" to a screen, and a test names the file and
  line before it ships.

## Scope

In: the user-visible strings of `apps/galaxy` (its `src/` and `app/` screens, metadata, alerts,
demo data), the two guide diagrams `docs/guide/diagrams/loop.svg` and `roadmap.svg`, HOME's new
line and its link, the guard test, the render tests whose expected strings change, and the two
draft screens.

Out: the `/docs` guide's Markdown (PR #1907), the repository's README files, the kit and its skills
(#1858), `apps/omni-app` (the GitHub App's comments), every code identifier, comment, API field and
database column, and the agent-connect setup rows.

## Test seams

- **The guard** (`apps/galaxy/src/agent-words.test.ts`): a unit test over the source tree through
  the TypeScript compiler API, red on main today (it lists the strings above), green after; a
  fixture string in the test itself proves it catches JSX text, an attribute, a literal and a
  template, and that the allowlist lets its named entries through.
- **HOME** (`home/home.test.ts`): renders the poster and finds the line's items, once, in order,
  after the promises and before the quote, its last item the one link to `/docs/any-agent`;
  `OrderForm.test.ts` and `StrategyGuide.test.ts` find the new fine print and lines. The poster's
  contrast test covers the line's colours on `ad-purple`.
- **Each screen's render tests** (`ask/page/render.test.ts`, `dock.render.test.ts`, `tabs.test.ts`,
  `dossier/page/view.test.ts`, `ConceptList.render.test.ts`, `waiting/alerts` tests,
  `docs/docs.test.ts`): their expected strings move to the after column.
- No test calls GitHub or Supabase (testing › Never).

## Risks

Merging publishes the arcade: a merge to `main` deploys `apps/galaxy` to production on Vercel
through the release commit (releasing). Rollback is reverting the merge commit: the change is words,
two SVG files, tests and two draft screens, with no state, no migration and no API change.

- **A string missed.** The guard fails on any "Claude" left in a user-visible literal, so a missed
  one is red, not shipped; text built at runtime from data (a round's model id, a release title
  stored in the database) is not a literal and stays as the data says.
- **A wider label.** "AGENT IS DONE" and "▶ Play while the agent works" are a few characters longer
  or shorter than today; the dock's render test and a look at the pill at its narrowest width
  confirm it still fits on one line.
- **Overlap with #1907.** This PRD edits no Markdown under `docs/guide/`; only the diagrams, which
  #1907 does not touch.

The locked laws: the files this PRD changes show, store or guard none of them; it changes words
around the screens and none of their meaning. Changing any of them needs @pierrederval to approve
the pull request on GitHub.

- BR-PRODUCT-3: an agent could wave its own work through the gate with no person answering.
- BR-PRODUCT-5: a person could merge work whose open decisions nobody answered.
- BR-PRODUCT-6: a risky change nobody explained reaches the main branch unseen.
- BR-PRODUCT-12: the terminal acts on words the person no longer stands behind.
- BR-PRODUCT-28: a stranger could tie themselves to a team and see what it sees.
- BR-PRODUCT-29: a stranger could read a team's questions and answers.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner lose it.
- BR-PRODUCT-59: a member could copy the paid AI key and run up the bill.
- BR-PRODUCT-63: an agent could read another team's private work.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent.
- BR-PRODUCT-94: an agent could answer a question in a person's name.
- N-PRODUCT-3: a badly ranked question slips past the person who answers it.
- N-PRODUCT-4: a change could switch its own gate off behind a green check.
- N-PRODUCT-7: a person is locked out of their own terminal by a broken hook.
- N-PRODUCT-8: questions and answers could go to a server the person never chose.
- N-PRODUCT-13: the install could overwrite a person's own settings.
- N-PRODUCT-14: a rule quietly loses its test until the server refuses the PR.
- N-PRODUCT-15: unreviewed work reaches every user with nobody choosing to ship it.
- N-PRODUCT-16: scores and history could change after the fact.
- N-PRODUCT-17: anyone opening the arcade could read a key that controls the database.

## Acceptance criteria

- HOME's poster shows the row `WORKS WITH · CLAUDE CODE · CODEX · CURSOR · GEMINI CLI · ANY CODING
  AGENT` once, under the three promises and above the quote, its last item a link to
  `/docs/any-agent`, its text at 4.5:1 or better on `ad-purple`.
- HOME's order form reads "Runs on your coding agent." and "Free while in beta." and no longer
  names Claude Code.
- Every string in Solution's table reads as its after column on its screen.
- `apps/galaxy/src/agent-words.test.ts` passes, and fails when a "Claude" is added to any
  user-visible literal outside its allowlist; every allowlist entry names its reason.
- `docs/guide/diagrams/loop.svg` and `roadmap.svg` contain no "Claude".
- No code identifier, API field, database column or migration changes; `pnpm test`, `pnpm lint` and
  `pnpm typecheck` are green.
- The drafts `home` and `prd-dossier` carry the new words and this PRD in their Source.
