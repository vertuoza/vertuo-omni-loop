# Plan: a tidier, collapsible main menu

PRD #733, specified in `spec.md` beside this plan. Built on the feature branch `feat/menu-rework`
into `main`, whose feature PR says `Closes #733`; each slice is a sub-PR from
`feat/menu-rework--<slice>` into the feature branch, saying `Part of #733`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The menu shows Dashboard and Work, Questions without nested lines, and one Settings entry with its gear sprite at the foot; settings and question pages fall under Settings and Questions in the menu and the trail; `/app/settings` redirects to Fleets | `apps/galaxy/src/nav/sidebar.ts` `apps/galaxy/src/nav/sidebar.test.ts` `apps/galaxy/src/nav/Sidebar.tsx` `apps/galaxy/src/nav/Sidebar.render.test.ts` `apps/galaxy/src/nav/AppBar.test.ts` `apps/galaxy/app/app/settings/page.tsx` `packages/design/` | — | 1 |
| s2 | One tab row component, `SectionTabs`, and the Fleets · Repositories tabs on both settings pages | `apps/galaxy/src/nav/SectionTabs` `apps/galaxy/src/nav/section-tabs` `apps/galaxy/src/fleets/` `apps/galaxy/src/repositories/` `apps/galaxy/app/app/settings/fleets/` `apps/galaxy/app/app/settings/repositories/` | — | 1 |
| s3 | The Open questions · Shared with me · History tabs, with their counts, on `/ask`, `/ask/for-me` and `/ask/history` | `apps/galaxy/src/ask/page/` `apps/galaxy/app/ask/` | s2 | 2 |
| s4 | « folds the menu to a sprite rail and » opens it; the choice kept in the `omni-menu` cookie and drawn before the first paint; the phone drawer unchanged | `apps/galaxy/src/nav/Sidebar.tsx` `apps/galaxy/src/nav/Sidebar.render.test.ts` `apps/galaxy/src/nav/sidebar.css` `apps/galaxy/src/nav/menu-rail` `apps/galaxy/src/nav/AppShell.tsx` | s1 | 2 |

**Shared ground.** `apps/galaxy/src/nav/Sidebar.tsx` and its render test `Sidebar.render.test.ts`
are declared by s1 (the foot's Settings entry, no nested lines) and s4 (the rail): s4 is blocked by
s1, so they sit in waves 1 and 2. `apps/galaxy/app/app/settings/page.tsx` (s1, the redirect) and the
two settings pages' folders (s2) are named file by file and folder by folder, so they never meet.
s3 and s4 share nothing and run together in wave 2.

## Per slice: done when

**s1**
- The menu's groups are Dashboard and Work; Questions has no children in the menu; no Settings
  group title, no Fleets or Repositories entry.
- One Settings entry at `/app/settings`, with sprite `menu-settings`, sits at the foot above Docs and
  Release notes.
- `menu-settings` is a 16×16 sprite of `@omni/design`, drawn and tested like the other menu sprites.
- `currentItem` puts `/app/settings`, `/app/settings/fleets` and `/app/settings/repositories` under
  Settings, and `/ask/for-me` and `/ask/history` under Questions.
- `pageTrail` gives "Settings › Fleets" on `/app/settings/fleets` and "Work › Questions › History" on
  `/ask/history`; `badgeOf` counts only Questions and PRDs.
- `/app/settings` redirects to `/app/settings/fleets`, tested by its target.
- `pnpm test` is green.

**s2**
- `SectionTabs` draws a row of links, the current one `aria-current="page"`, a count only above 0,
  in the ask pages' tokens; a render test covers the marked tab and the counts.
- `/app/settings/fleets` and `/app/settings/repositories` each start with the Fleets · Repositories
  row, the page's own tab marked; their existing states still render.
- `pnpm test` is green.

**s3**
- `/ask`, `/ask/for-me` and `/ask/history` each start with the Open questions · Shared with me ·
  History row (on `/ask`, above the terminal list), the page's own tab marked.
- Open questions carries `questions − shared` and Shared with me carries `shared` from the waiting
  counts, each only above 0; `/ask/q/<round>` has no row.
- `pnpm test` is green.

**s4**
- On 900 px and wider, « ("Collapse the menu", `aria-expanded`, `aria-controls="app-sidebar"`) turns
  the menu into a 56 px rail; » ("Expand the menu") opens it.
- The rail shows the crest, the Dashboard and Work sprites apart by a line, and the Settings gear;
  each entry a link named by its label (title and accessible name), the current one marked, a yellow
  dot where a count waits, its accessible name "<name>: <n> waiting".
- Collapsing writes `omni-menu=rail` (a year, path `/`, `SameSite=Lax`); expanding deletes it; a
  script before the first paint marks the shell `data-menu="rail"` from it, never throwing; a pure
  test covers the script and the cookie helper.
- Below 900 px the drawer is unchanged and shows no «.
- A browser pass at 1280 px and 390 px, light and dark: the rail, a reload in the rail, the tab rows.
- `pnpm test` is green.
