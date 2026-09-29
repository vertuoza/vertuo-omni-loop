# Plan: Several repositories — a guide page with three drawings

PRD #603, spec in `spec.md` beside this plan. Built on the feature branch
`feat/several-repositories-guide` into `main` (`Closes #603`), through sub-PRs from
`feat/several-repositories-guide--<slice>` into the feature branch (`Part of #603`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The guide has a "Several repositories" page after First PRD, telling the multi-repository mode in the seven parts of spec point 1 with its three drawings (the map, the pull requests over time as swim lanes, which skill runs which), and the Invade page's plan-repository section is a pointer to it | `docs/guide/` `apps/galaxy/src/docs/guide.test.ts` | — | 1 |

**Shared ground.** One slice: the page, its three drawings, `meta.json`, the First PRD and Invade
pages and the guide's test move together, because the guard refuses a page whose diagram has no
file and a Next link to a page that does not exist.

## Per slice: done when

**s1: the page and its drawings**

- `docs/guide/several-repositories.md` has the title "Several repositories" and the seven parts of
  spec point 1, in order, naming only skills the plugin has and commands the CLI has.
- `docs/guide/diagrams/repositories.svg`, `pull-requests-repositories.svg` and
  `skills-repositories.svg` exist, each with a `<title>`, a `<desc>`, the light and dark `<style>`
  of `pull-requests.svg`, and only existing `dg-*` classes; each is shown alone on its line with alt
  text. The pull-requests drawing shows the one phase-0, a feature PR with sub-PRs per target,
  dashed decision arrows into the one outbox, and the merge order with the plan PR last.
- `docs/guide/meta.json` lists `several-repositories` after `first-prd`; First PRD's Next link
  points to it, and its Next link points to Use cases.
- `docs/guide/invade.md`'s "A plan repository" section is two sentences and a link to the new page.
- `apps/galaxy/src/docs/guide.test.ts` expects nine pages in order with the new title, the new Next
  links, and the three drawings on the new page; `apps/galaxy/src/docs/diagrams.test.ts` passes.
- `pnpm test` is green.
