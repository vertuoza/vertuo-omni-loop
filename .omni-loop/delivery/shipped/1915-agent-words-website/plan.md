# Plan: Coding agents on every screen

PRD #1915, the spec beside this plan (`spec.md`). The feature branch `feat/agent-words-website`
goes into `main` with `Closes #1915`; each slice is a sub-PR from `feat/agent-words-website--<slice>`
into the feature branch with `Part of #1915`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | HOME says who it works with: the works-with row under the poster's promises, the order form's fine print and the strategy guide in agent words | `apps/galaxy/src/home/` | — | 1 |
| s2 | `/ask` and the play dock speak of the agent: the working card, the round, the sign-in card, the tab title, the empty states, the layout description, the browser alerts and the dock's pill, pause and done lines | `apps/galaxy/src/ask/` `apps/galaxy/app/ask/` `apps/galaxy/src/play-dock/` `apps/galaxy/src/waiting/` | — | 1 |
| s3 | The PRD page, concepts, ideas, the docs' skill pages, the release notes and the guide's two diagrams speak of the agent | `apps/galaxy/src/dossier/` `apps/galaxy/src/concepts/` `apps/galaxy/src/ideas/` `apps/galaxy/src/docs/` `apps/galaxy/src/releases/` `docs/guide/diagrams/` | — | 1 |
| s4 | The guard: `agent-words.test.ts` refuses "Claude" in any user-visible literal of the app outside its named allowlist, and the strings it still finds are changed the same way | `apps/galaxy/src/` `apps/galaxy/app/` | s1, s2, s3 | 2 |

**Shared ground.** s4 declares `apps/galaxy/src/` and `apps/galaxy/app/`, which hold every
territory of s1, s2 and s3: it runs alone in wave 2, after all three merged, so it can change a
string none of them reached (a refusal text in `working/`, `jev/`, `dashboard/`) and the tests that
read it. The play dock's words are tested from `apps/galaxy/src/ask/page/dock.render.test.ts`, so the
dock sits in s2 with `/ask`. The guide's diagrams are tested from `apps/galaxy/src/docs/`
(`diagrams.test.ts`, `guide.test.ts`), so they sit in s3 with the docs pages. Wave 1's three
territories share no prefix.

## Per slice: done when

**s1** (`ui: yes`)
- HOME's poster renders `WORKS WITH · CLAUDE CODE · CODEX · CURSOR · GEMINI CLI · ANY CODING AGENT`
  once, as one row of items after the three promises and before the quote, its last item the one
  link to `/docs/any-agent`; `home/home.test.ts` proves the order, the count and the link.
- The poster's contrast test lists the line's colours and each reads at 4.5:1 or better on
  `ad-purple`.
- The order form shows "Runs on your coding agent." and "Free while in beta." as two lines, and no
  "Claude" (`OrderForm.test.ts`); the strategy guide reads "You talk an idea through with your
  agent." and "a person decides, with the agent for the idea" (`StrategyGuide.test.ts`).
- `home/lingo.test.ts` stays green: HOME's prose says none of its avoided words.

**s2** (`ui: yes`)
- Every `/ask` row of the spec's table renders its after words: "The agent is working", the two-line
  hint "The next question shows here." / "Keep this tab open.", "Send to the agent", "The agent
  asks", "The agent wrote before asking", "Sign in to answer your agent", the empty states, and the
  tab title "Your agent asks · OMNI LOOP" (`render.test.ts`, `tabs.test.ts`, `lead.test.ts`).
- The `/ask` layout's description reads "Your agent's questions, on a page made for reading."
- A browser alert reads "Your agent is asking: <question>" (`waiting/alerts.test.ts`).
- The dock shows "▶ Play while the agent works", "⏸ AGENT ASKED · ANSWER", "AGENT IS DONE" and the
  label "Play a game while the agent works" (`PlayDock.test.ts`, `dock.test.ts`,
  `dock.render.test.ts`), and the pill stays on one line at 600 px.
- A round's cost line still shows the model id as sent (`claude-sonnet-4-6`): data, not words.
- No API field, column or identifier changes (`claude_session_id`, `claudeSessionId` stay).

**s3** (`ui: yes`)
- The PRD page's watcher line reads "The agent is watching · last round N min ago"
  (`view.test.ts`, `care-render.test.ts`), the pitch hint "Run it in your coding agent, in this
  repository. …", and the Questions pane's empty state "The questions the agent asks with ask mode
  on …".
- Concepts' empty state reads "Start one in your coding agent:"; an ideas card's copy line names no
  agent.
- The docs skill pages read "You type it in your coding agent." and "Its full instructions,
  written for the agent:" (`docs.test.ts`).
- The release notes words and demo data speak of the agent ("plugin for Claude Code, skills for any
  coding agent" where the product is listed) (`releases/words.test.ts`).
- `docs/guide/diagrams/loop.svg` and `roadmap.svg` read "with the agent", "YOU + AGENT" and "the
  agent builds", and contain no "Claude" (`diagrams.test.ts`).
- No Markdown under `docs/guide/` changes (that is PR #1907's).

**s4**
- `apps/galaxy/src/agent-words.test.ts` parses every non-test `.ts`/`.tsx` file under
  `apps/galaxy/src` and `apps/galaxy/app` and fails on "Claude" (any case) in JSX text, a JSX
  attribute string, a string literal or a template's text, outside its allowlist; it also reads the
  two guide diagrams.
- Its own fixture proves it catches each of the four kinds and lets each allowlist entry through.
- Every allowlist entry names a file (and, where needed, the literal) and its reason: the
  agent-connect setup (`agent-connect/tokens/model.ts`, `ConnectAgentCard.tsx`), the price table
  (`ask/prices.ts`), demo model ids, HOME's works-with line (`home/poster/Poster.tsx`).
- It passes on the feature branch; a string it found that s1–s3 did not change is changed the same
  way, and each is recorded as an outbox item.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green on the feature branch.
