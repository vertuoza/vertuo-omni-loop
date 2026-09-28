# Plan: App sidebar navigation

PRD #438, with the spec beside this plan (`spec.md`). The feature branch `feat/app-sidebar` merges
into `main` with `Closes #438`. Each slice is a sub-PR from `feat/app-sidebar--<slice>` into the
feature branch, with `Part of #438`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Every app page (`/app`, `/prd`, `/ask`, `/knowledge`) sits in one AppShell: the left sidebar (Work: Home, PRDs, Questions with For me and History, Knowledge; Omni: Docs ↗, Release notes ↗; the current item marked; the For me badge) and the top bar (the page's title, Omni/Light/Dark, Game mode). The old bars, the ask and prd bar links and /app's section cards are gone | `apps/galaxy/src/nav/sidebar` `apps/galaxy/src/nav/Sidebar` `apps/galaxy/src/nav/AppBar` `apps/galaxy/src/nav/app-bar` `apps/galaxy/src/nav/viewer` `apps/galaxy/src/nav/AppShell` `apps/galaxy/app/app/layout.tsx` `apps/galaxy/app/ask/layout.tsx` `apps/galaxy/app/prd/layout.tsx` `apps/galaxy/app/knowledge/layout.tsx` `apps/galaxy/src/ask/page/AskBar.tsx` `apps/galaxy/src/ask/page/ForMe.tsx` `apps/galaxy/src/ask/page/WorkspaceHistory.tsx` `apps/galaxy/src/ask/page/history-render.test.ts` `apps/galaxy/src/ask/page/share-render.test.ts` `apps/galaxy/src/ask/ask.css` `apps/galaxy/src/ask/page/history.css` `apps/galaxy/src/ask/page/share.css` `apps/galaxy/src/dossier/page/history.ts` `apps/galaxy/src/dossier/page/DossierHistory.tsx` `apps/galaxy/src/dossier/page/page.test.ts` `apps/galaxy/src/knowledge/KnowledgeScreen.tsx` `apps/galaxy/src/knowledge/render.test.ts` `apps/galaxy/src/knowledge/knowledge.css` `apps/galaxy/src/dashboard/` `apps/galaxy/src/switch/switch.ts` `apps/galaxy/src/switch/switch.test.ts` `apps/galaxy/src/switch/render.test.ts` `apps/galaxy/src/switch/headers.test.ts` | — | 1 |
| s2 | The top bar ends with you: signed in, the avatar opens the user menu (the name and login, then Sign out) following the menu-button pattern, and Sign out ends the session and lands on `/`. Signed out, **Sign in with GitHub** takes the avatar's place | `apps/galaxy/src/nav/UserMenu` `apps/galaxy/src/nav/user-menu` `apps/galaxy/src/nav/AppBar` `apps/galaxy/src/nav/app-bar` | s1 | 2 |
| s3 | Below 900px the sidebar hides, the top bar gains ☰ and wraps the theme switch and Game mode to a second row, and ☰ opens the sidebar as a drawer that closes on Escape, a tap outside or choosing an item, with no sideways scroll | `apps/galaxy/src/nav/drawer` `apps/galaxy/src/nav/AppShell` `apps/galaxy/src/nav/AppBar` `apps/galaxy/src/nav/app-bar` `apps/galaxy/src/nav/Sidebar` `apps/galaxy/src/nav/sidebar` | s1, s2 | 3 |
| s4 | The public bar on `/docs` and `/releases` gains **Open the app →** to `/app`, shown to everyone; its menu, theme switch and Game mode are unchanged | `apps/galaxy/src/nav/TopBar` `apps/galaxy/src/nav/menu.ts` `apps/galaxy/src/nav/nav.css` `apps/galaxy/src/switch/headers.test.ts` | s1 | 2 |

**Shared ground.**
- `src/nav/AppBar` and `src/nav/app-bar` (the top bar and its stylesheet) are declared by s1, s2
  and s3, one per wave (1, 2, 3). s1 creates the bar with the title, the theme switch and Game mode.
  s2 adds the avatar and sign-in. s3 adds ☰ and the phone rows.
- `src/nav/Sidebar`, `src/nav/sidebar` and `src/nav/AppShell` are s1's and s3's, in waves 1 and 3.
- `src/switch/headers.test.ts` checks every page's header. It is s1's and s4's, in waves 1 and 2.
- s2 and s4 share wave 2 and no prefix: s2 owns the app bar's end, and s4 the public bar.

## Per slice: done when

**s1: the sidebar, the top bar and the shell**
- `sidebar.test.ts` pins `SIDEBAR`:
  - Work: Home `/app`, PRDs `/prd`, Questions `/ask` with For me `/ask/for-me` and History
    `/ask/history`, Knowledge `/knowledge`.
  - Omni: Docs `/docs` and Release notes `/releases`, marked as leaving the app.
- `currentItem` and `pageTitle` give:

  | Path | `currentItem` | `pageTitle` |
  | --- | --- | --- |
  | `/app` | home | Home |
  | `/prd`, `/prd/<id>` | prds | PRDs |
  | `/ask`, `/ask/<session>`, `/ask/q/<round>` | questions | Questions |
  | `/ask/for-me` | for-me | Questions / For me |
  | `/ask/history` | history | Questions / History |
  | `/knowledge`, `/knowledge?domain=x` | knowledge | Knowledge |
  | an unknown path | `null` | `null` |

- `viewer.test.ts`, with a fake client, covers:
  - The full viewer.
  - No session gives a signed-out viewer.
  - A workspace read that throws gives no workspace name.
  - A For me count that throws gives `forMe: null`.
  - The viewer never throws.
- `Sidebar` render tests cover:
  - The workspace name when there is one, and none when there is not.
  - For me shows a badge at 3, and none at 0 or `null`.
  - Exactly one `aria-current="page"`.
  - Docs and Release notes each carry ↗ and "(leaves the app)".
- `AppBar` render test: the title, then Omni/Light/Dark (`ThemeSwitch`), then Game mode
  (`GameModeButton`, whose dialog's words are exactly `GAME_MODE`'s), in that order.
- The layouts:
  - The `app`, `ask`, `prd` and `knowledge` layouts render through `AppShell`, and no longer render
    `TopBar`.
  - `AskBar` is deleted.
- The pages:
  - `/ask` shows no History or For me bar links.
  - `/prd` shows no "All PRDs" link.
  - `/knowledge` draws no bar of its own, and shows its repository chip in its heading.
  - `/app` renders the You block and the notes with no section cards. `Cards.tsx` and `SECTIONS`
    are deleted.
- `pnpm test` is green.

**s2: you, at the end of the top bar**
- The `AppBar` render test covers:
  - Signed in: the avatar button, last, with `aria-haspopup="menu"` and `aria-expanded`.
  - Signed out: **Sign in with GitHub** in its place, which starts `startGithubSignIn` returning
    through `/app/callback`.
- The `UserMenu` render test: the menu reads the name and login, then Sign out.
- Sign out calls the browser client's `signOut({ scope: 'local' })`, then goes to `/`.
- Arrow keys move between items, Escape closes the menu, and focus returns to the avatar. A test of
  the pure key handler covers this, and so does the manual pass.
- `pnpm test` is green.

**s3: the phone drawer**
- Below 900px:
  - The sidebar is hidden.
  - The top bar's first row shows ☰ ("Menu"), the crest, the page's title and the avatar or Sign
    in.
  - The theme switch and Game mode wrap to a second row.
- ☰ opens the sidebar as a drawer, with focus inside it. Escape, a tap on the scrim, or choosing an
  item closes it and returns focus to ☰. A test of the pure drawer state covers this, and so does
  the manual pass.
- At 375px wide, no app page scrolls sideways. This is checked by hand on a local run, in the Omni,
  Light and Dark themes.
- `pnpm test` is green.

**s4: the public bar**
- `TopBar.test.ts`:
  - An **Open the app →** link to `/app`.
  - The menu (Release notes, Docs), the theme switch and Game mode are still there.
- `/docs` and `/releases` render no sidebar, and their layouts read no session.
- `headers.test.ts` matches: the public bar on `/docs` and `/releases`, and the sidebar and top bar
  on the app pages.
- `pnpm test` is green.
