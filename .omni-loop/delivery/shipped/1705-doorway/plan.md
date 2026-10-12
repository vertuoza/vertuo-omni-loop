# Plan: The doorway, a focused arcade frame for the sign-in pages

PRD #1705, spec beside this plan (`spec.md`). The feature branch `feat/doorway` merges into `main`
through the feature PR (`Closes #1705`); each slice is a sub-PR from `feat/doorway--<slice>` into
`feat/doorway` (`Part of #1705`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The doorway frame, and the two terminal sign-ins inside it: `/ask/device` and `/ask/signin` leave the app shell, the device code in the pixel face | `apps/galaxy/src/doorway/` `apps/galaxy/app/ask/` `apps/galaxy/src/ask/device-card*` `apps/galaxy/src/ask/theme-color.test.ts` `apps/galaxy/src/ask/page/questions-pages.test.ts` `apps/galaxy/src/ask/page/share-render.test.ts` `apps/galaxy/src/switch/headers.test.ts` | — | 1 |
| s2 | `/signup` inside the doorway, with its words cut to the word pass and the How sign-up works link | `apps/galaxy/app/signup/` `apps/galaxy/src/signup/SignupScreen*` `apps/galaxy/src/signup/signup.css` `apps/galaxy/src/signup/layout.test.ts` | s1 | 2 |

**Shared ground:** none. s2 renders the `Doorway` component s1 creates, so it waits for s1's merge
(wave 2), and reads `apps/galaxy/src/doorway/` without changing it. The screen library drafts
(`doorway`, `ask-device`, `ask-signin`, `signup`, `app-shell`) were written with the spec and are
not in either territory: a slice that finds its screen drawn differently from what it builds says
so in its sub-PR, and the draft is brought up to it by the wave.

## Per slice: done when

**s1** (`ui: yes`)
- `apps/galaxy/src/doorway/Doorway.tsx` and `doorway.css` exist; `Doorway` renders the `.ask` root,
  the theme tokens and the theme script as its first child, the starfield (`starfieldSvg()`,
  `aria-hidden`, hidden under Light), the crest's full form at 3× (2× below 900 px) named
  `OMNI LOOP` and linked to `/`, the children in `<main>`, and a `Docs` link; it reads no session.
- `apps/galaxy/app/ask/layout.tsx` renders no `AppShell`; `app/ask/(shell)/layout.tsx` renders it and
  holds `page.tsx`, `for-me/`, `history/`, `q/` and `[session]/`; `app/ask/(doorway)/layout.tsx`
  renders `Doorway` and holds `signin/` and `device/`; `callback/` is where it was. No URL changes.
- On the device card's confirm state the code renders in the pixel face (24 px, 16 px below
  900 px); the Enter the code box keeps the mono face. No word on `/ask/device` or `/ask/signin`
  changes.
- `Doorway.render.test.ts`, `routes.test.ts` (in `src/doorway/`) and `device-card.test.ts` hold the
  spec's Test seams for them; `questions-pages.test.ts`, `share-render.test.ts`, `headers.test.ts`
  and `theme-color.test.ts` point at the moved files and still pass.
- `design-system.test.ts`, `page-width.test.ts` and `theme-tokens.test.ts` pass; the full
  `pnpm test`, `pnpm lint` and `pnpm typecheck` pass.
- By eye, `pnpm galaxy:shots`: `/ask/device` (each state) and `/ask/signin` at 393×700, 852×393 and
  1440×900, in Omni, Light and Dark, match the `doorway` and `ask-device` drafts; nothing scrolls
  sideways at 393 px.

**s2** (`ui: yes`)
- `apps/galaxy/app/signup/layout.tsx` renders `Doorway` in place of its bare `<main>`, with the same
  metadata and viewport; `signup/layout.test.ts` holds it.
- `SignupScreen.tsx` says the words of the spec's table in **`/signup`'s words**, screen by screen
  (install, waiting, each of the five errors, no GitHub App), and the install card links **How
  sign-up works** to `/docs/install#install-the-github-app`; `SignupScreen.test.ts` holds each new
  sentence and no sentence of the old ones.
- `node .omni-loop/bin/omni.mjs design words .omni-loop/knowledge/design/screens/signup.html` finds
  nothing.
- The full `pnpm test`, `pnpm lint` and `pnpm typecheck` pass.
- By eye, `pnpm galaxy:shots`: `/signup` (install, waiting, an error) at the three widths and in the
  three themes matches the `signup` draft.
