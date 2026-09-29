# Plan: Skills section in the docs

PRD #580, spec in `spec.md` beside this plan. Built on the feature branch `feat/skills-docs` into
`main` (`Closes #580`), through sub-PRs from `feat/skills-docs--<slice>` into the feature branch
(`Part of #580`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Every skill entry of the help table has a `group` from `SKILL_GROUPS`, a one-line `when` starting `Use it when` and an `example` (`type`, `result`), held by `entries.test.mjs`; `omni help <skill>` prints the When and Example lines after the sentences, within 80 columns; commands and the overview unchanged; `kit/dist/omni.mjs` rebuilt | `kit/lib/help/` `kit/dist/` | — | 1 |
| s2 | `/docs/skills` shows every skill grouped by what you want to do, one card each linking to `/docs/skills/<name>`, which shows What it does, When to use it, How to use it (usage and example), Who runs it, Related skills and the link to its `SKILL.md`, braces filled with generic words, an unknown name a 404; the docs sidebar gains *Skills* › *All skills*, and on a skills page every skill's link, the current one marked | `apps/galaxy/src/docs/skills` `apps/galaxy/app/docs/skills/` `apps/galaxy/src/docs/DocsPage.tsx` `apps/galaxy/src/docs/docs.css` `apps/galaxy/src/docs/docs.test.ts` `apps/galaxy/app/docs/[[...slug]]/` | s1 | 2 |
| s3 | The docs search box finds skill pages beside the guide's (searching `wave` offers `/docs/skills/wave`), and the loop page links `/docs/skills` under *Which skill runs which* with the guide guard green | `apps/galaxy/app/docs/search/` `apps/galaxy/src/docs/DocsSearch.tsx` `apps/galaxy/src/docs/search` `docs/guide/loop.md` | s2 | 3 |

**Shared ground.** No prefix is declared by two slices. `apps/galaxy/src/docs/skills` (s2) and
`apps/galaxy/src/docs/search` (s3) are distinct file prefixes. s2 waits for s1 because it reads the
new fields from `kit/lib/help/entries.mjs`; s3 waits for s2 because the search index is built from
s2's skill page model (`src/docs/skills.ts`), and the loop page's link points at s2's route.

## Per slice: done when

**s1**
- `entries.test.mjs` fails a fixture skill entry missing `group`, `when` or `example`, one with a
  `group` outside `SKILL_GROUPS`, a `when` not starting `Use it when`, an `example.type` not
  starting `/omni:<its name>`, and a command entry carrying any of the three; the live table passes.
- `SKILL_GROUPS` lists `start`, `build`, `setup`, `multi-repo`, `everyday`, `run-by-skills` in that
  order, with the spec's titles, and every group holds the skills the spec's table names.
- `renderEntry('yolo', …)` ends with a blank line, a `When` line and an `Example` block with `→` and
  the result, every line within 80 columns; `renderEntry('board', …)` and `renderOverview` print what
  they print on `main`.
- `kit/dist/omni.mjs` is rebuilt and `pnpm test` is green.

**s2**
- A pure `src/docs/skills.ts` builds the overview (groups in order, an empty group left out) and one
  page model per skill; its test covers the braces filled with generic words, *Who runs it* for
  `dossier-push` naming `/omni:brainstorm` and `/omni:plan`, *Related skills* in naming order
  without the skill itself, and a page for every folder under `kit/plugin/skills`.
- `/docs/skills` and `/docs/skills/<name>` are built statically (`generateStaticParams`,
  `dynamicParams = false`), drawn in `DocsPage`; `/docs/skills/nope` is a 404, and the guide's pages
  still resolve through `[[...slug]]`.
- A render test shows the sidebar with the guide's eight pages then *Skills* › *All skills*, and, on
  a skill page, every skill's link with the current one marked (`aria-current="page"`).
- Checked in a browser: `/docs/skills` and one skill page, light and dark, desktop and phone width.

**s3**
- The search index served at `/docs/search` holds `/docs/skills/<name>` for every skill beside the
  guide's pages, with its slash command, summary and sentences; a test on the index builder shows
  `wave` matching `/docs/skills/wave`.
- `docs/guide/loop.md` carries *Every skill, what it does and when to use it:
  [Skills](/docs/skills).* under the table in *Which skill runs which*; `guide.test.ts` stays green.
- `pnpm test` is green.
