# Plan: The knowledge tree on the Omni page

PRD #2419, spec beside this plan (`spec.md`). The feature branch `feat/knowledge-tree-page` goes
into `main` through the feature PR (`Closes #2419`); each slice is a sub-PR from
`feat/knowledge-tree-page--<slice>` into the feature branch (`Part of #2419`).

The tree's order (PRD #2416, `kit/lib/knowledge-tree/levels.ts`) and the Omni-settings level
(PRD #2417, `kit/lib/omni-settings/`, `apps/galaxy/src/omni-settings/`) are on `main`. The resolver
2416 shipped reads a checkout's files on disk; the Omni page holds a repository's files in memory,
in its newest knowledge pack (`apps/galaxy/src/knowledge-packs/`). So this plan adds one pure,
bundler-safe reader of the same order over files handed in, and draws the section from it.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The product's Knowledge page gains a Repositories section: for each repository of the product, its playbook pages and decision records read from its newest knowledge pack, each marked with its level (repository, plan repository, kit default) and its owner; a repository with no pack says so, with how to send one | `kit/lib/knowledge-tree/pages` `apps/galaxy/src/product-knowledge/repositories/` `apps/galaxy/app/app/products/[id]/knowledge/repositories/` `apps/galaxy/src/product-knowledge/knowledge-sections` `apps/galaxy/src/product-knowledge/product-knowledge.render.test.ts` `apps/galaxy/src/product-knowledge/knowledge.css` | — | 1 | deep |
| s2 | A page the repository and its plan repository leave unwritten reads the workspace's settings repository's page (PRD 2417's read, as the Omni app) and is marked Omni settings, its owner from that page's `owner:` line | `apps/galaxy/src/product-knowledge/repositories/repositories-load` `apps/galaxy/src/product-knowledge/repositories/settings-level` `apps/galaxy/src/omni-settings/omni-settings.service` | s1 | 2 | build |
| s3 | "Write it for this repository" on a page that reads a default opens that page's edit as a pull request in the repository | `apps/galaxy/src/product-knowledge/repositories/write-for-repository` `apps/galaxy/src/product-knowledge/repositories/RepositoriesPages` `apps/galaxy/src/product-knowledge/repositories/repositories-render` | s1 | 2 | build |

**Shared ground.**

- `apps/galaxy/src/product-knowledge/repositories/`: s1 creates the area and owns all of it in
  wave 1: `repositories-section.ts` (the pure model of a repository's pages and records),
  `repositories-load.ts` (the read, as the signed-in person), `RepositoriesPages.tsx` (the view) and
  its render test `repositories-render.test.tsx`. In wave 2, s2 changes only the files starting
  `repositories-load` and adds `settings-level*`; s3 changes only `RepositoriesPages` and
  `repositories-render`, and adds `write-for-repository*`. Their prefixes do not meet, so they share
  wave 2; both read s1's model unchanged.
- `apps/galaxy/src/product-knowledge/knowledge-sections.ts`, its test and
  `product-knowledge.render.test.ts` assert the sub-menu's sections in order: s1 alone adds the
  `repositories` key and updates them.
- `kit/lib/knowledge-tree/pages*`: s1 alone. It reads all four levels from the start (the Omni
  settings level handed in empty by s1's read), so s2 only feeds it.
- `apps/galaxy/src/omni-settings/omni-settings.service.ts`: s2 alone, to export PRD 2417's read of a
  workspace's settings playbook, unchanged in behaviour.
- Generated files are never committed by a slice; the wave rebuilds them.

## Per slice: done when

### s1 (deep: the order the page shows must be the one every agent reads, over files in memory) (`ui: yes`)

- `kit/lib/knowledge-tree/pages.ts`, importing nothing that reads the disk (an app bundler takes it),
  resolves a repository's playbook pages and decision records from the files of each level handed
  in (repository, plan repository, Omni settings) by PRD 2416's order: each page the lowest level
  that holds it filled, else `kit default`; each decision record with the level it comes from, the
  repository's own first. Each page carries its owner: its `owner:` line, else the repository's law
  owners (`laws.owners` of the config in its pack, spec Q3). Unit tests over fixture files prove
  each level's mark and the owner's default.
- The sub-menu of the product's Knowledge home shows **Repositories** at
  `/app/products/<id>/knowledge/repositories`; `knowledge-sections` tests and the render test list it.
- The section lists each repository of the product (AC 1), read as the signed-in person from its
  newest knowledge pack and the product's plan repository's pack, with each playbook page and
  decision record marked with its level and owner (AC 2).
- A repository with no pack says so, with how to send one (a merge touching its knowledge folder or
  flow config, as the App makes packs) (AC 3).
- Galaxy service and render tests over fixture packs: each level's mark, a repository with no pack;
  the demo draws the section.

### s2 (`ui: yes`)

- PRD 2417's read of a workspace's settings playbook is exported from the omni-settings service,
  its behaviour unchanged (its tests stay green).
- The section's read feeds the settings repository's pages as the Omni settings level: a page
  neither the repository nor its plan repository holds, and the settings repository does, is marked
  Omni settings, its owner its `owner:` line, else the settings repository's law owners (AC 2).
- No settings repository, or one the Omni app cannot read, leaves the level empty, never an error:
  the pages read the kit default as in s1. A service test over fixtures proves each case.

### s3 (`ui: yes`)

- A page whose level is not the repository's shows "Write it for this repository", a link that
  opens the edit of that page in the repository as a pull request, starting from the text it reads
  today (AC 4); a page the repository holds shows none.
- A render test proves the action's pull request link, and its absence on a repository page.
