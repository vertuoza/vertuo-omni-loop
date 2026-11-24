# Plan: Find a setting from anywhere in Settings

PRD #3222, the spec beside this plan (`spec.md`). The feature branch `feat/settings-find-a-setting` goes into `main` as one draft pull request that closes #3222; each slice below is a sub-PR from `feat/settings-find-a-setting--<id>` into the feature branch, closing nothing (`Part of #3222`).

Planned against the code as its blockers leave it: #3216 (`apps/galaxy/src/settings/map.ts`, the map's sections and pages), #3218 (the settings layout and its frame, `SettingsFrame`, `SettingsNav`, in `apps/galaxy/src/settings/`), #3217 (the kit, `apps/galaxy/src/settings-kit/`), #3220 and #3221 (every page's named sections with stable anchors). None is on `main` yet, so each slice reads the file as built before it starts and names any difference in its sub-PR.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The map carries a summary and keywords on every page, and the sections of each page (anchor, label, summary, keywords), the anchors being those the six pages already render; a test fails on a page or section without a summary or a keyword, and on an anchor the page does not render | `apps/galaxy/src/settings/map.ts` `apps/galaxy/src/settings/map.test.ts` | — | 1 | build |
| s2 | A pure search over the map: filters pages and sections by label, summary and keyword, ranks a label match first, lists nothing for an empty query, and gives each result its trail (*Workspace › Fleets › Retired fleets*) and its anchor | `apps/galaxy/src/settings/search.ts` `apps/galaxy/src/settings/search.test.ts` | s1 | 2 | build |
| s3 | The shell shows the trail `Settings › <section> › <page>` above the title, each part a link, and a "Jump to" list of the page's own sections when it has more than three | `apps/galaxy/src/settings/SettingsTrail*` `apps/galaxy/src/settings/SettingsJumpTo*` `apps/galaxy/src/settings/SettingsFrame*` | s1 | 2 | build |
| s4 | The shell's search: the field, the `/` shortcut that never steals typing, a button on a narrow screen, results with their trail, choosing one goes to the anchor and focuses the section's heading, and no network call while typing | `apps/galaxy/src/settings/SettingsSearch*` `apps/galaxy/src/settings/search.css` `apps/galaxy/src/settings/SettingsFrame*` `apps/galaxy/src/settings-kit/SettingsSection*` | s2, s3 | 3 | deep |

Shared ground: `apps/galaxy/src/settings/SettingsFrame*` is declared by s3 and s4, which s4's blocker on s3 keeps in different waves (2 and 3). `apps/galaxy/src/settings-kit/SettingsSection*` (the heading made focusable, its render test) is s4's alone; the pages' tests that import the kit (`FleetsScreen`, `JevScreen`, and the other screens' tests) read it, so s4 runs them and edits none. No slice edits a page, a layout or a library screen: the frame's tests (`SettingsNav.render.test.ts`, the frame's own) are read by s3 and s4 through `SettingsFrame*` only. `kit/dist/` and `apps/omni-app/api/` are generated and never listed. The map's `map.ts` is one file with s1 alone, after #3216.

## Per slice: done when

**s1** (`ui: yes`)
- Every page entry of `SETTINGS_MAP` has a one-line summary and at least one keyword, old names included (for example `webhook`, `retire`, `secrets key`), and each page lists its sections with an `id` (the anchor), a label, a summary and at least one keyword. The labels are those #3220 and #3221 fixed (AC-6).
- `map.test.ts` fails on a page or section with no summary, on a page or section with no keyword, and when a section's `id` is not rendered by its page (read from the page's source), so the index and the pages cannot drift.
- The sections and anchors come from the pages as built; where a page names one the spec of #3220 or #3221 does not, the map follows the page and the sub-PR says so.
- Product-level settings are not in the map (Q4).

**s2** (`ui: yes`)
- Typing `webhook` or another keyword returns the section that holds it, with its trail (AC-1).
- Each result carries section, page, and the anchor path (`/app/settings/fleets#retired-fleets`); a page-level result carries no anchor (AC-2 data).
- A label match ranks before a summary or keyword match; ties keep the map's order; an empty or blank query lists nothing; no match returns an empty list the field can say so for.
- The module imports no network, no `fetch`, no DOM: it reads the map only (AC-5, first half).

**s3** (`ui: yes`)
- The shell draws `Settings › <section> › <page>` above the page title, each part a link to the section's first page or to the page; the current page is not a link (spec 4).
- A page with more than three sections gets a "Jump to" list linking each section's anchor; a page with three or fewer gets none (AC-7).
- The trail and the list come from the map, not from the page. A frame test holds both and the no-list case.

**s4** (`ui: yes`, deep: a focus and keyboard path that a typed field must never lose)
- The field renders in the frame; a button opens it on a narrow screen. Typing shows results with their trail through `search.ts`, and an empty query shows no list (AC-2).
- Choosing a result links to its anchor, and the section's heading takes focus (AC-3).
- `/` focuses the field only when no input, textarea, select or editable element has focus; in any of them the character is typed (AC-4).
- A test with `fetch`, `XMLHttpRequest` and `sendBeacon` replaced by failing stubs types a query and chooses a result: none is called (AC-5).
- With no script the frame still navigates by its rail; the search is an enhancement. `pnpm design` shows no new breach.
