# Plan: Knowledge map repository menu — the knowledge of every repository Omni Loop touched in your workspaces

PRD #523, with the spec beside this plan (`spec.md`). The feature branch `feat/knowledge-repo-menu`
merges into `main` with `Closes #523`. Each slice is a sub-PR from `feat/knowledge-repo-menu--<slice>`
into the feature branch, with `Part of #523`. The prototype on `feat/knowledge-repo-picker` (commit
`db21ce4`) implements the whole spec with its tests green: each slice may port its part from there,
test first, and keeps to its own territory.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The kit builds a knowledge graph from texts held in memory: `readKnowledge({ ctx, source })` reads through `diskSource(root)` (the default, so every existing caller is unchanged) or `memorySource(texts)`, and `graphOfTexts({ texts, knowledgeRoot, repo })` builds the same graph `readGraph` builds off disk; the bundle is rebuilt and the porting note says why | `kit/lib/knowledge/registers` `kit/lib/knowledge/graph` `kit/porting/knowledge--registers.md` `kit/dist/` | — | 1 |
| s2 | The knowledge map's addresses keep a repository: `entryHref(selection, repo)` puts `repo=` first when a repository is named, and every tab, dot, index row and panel link of `KnowledgeMap` carries it; without one every address is exactly today's; signing in from a `/knowledge?repo=…` link comes back to the same repository, domain and entry | `apps/galaxy/src/knowledge/view` `apps/galaxy/src/knowledge/KnowledgeMap` `apps/galaxy/src/knowledge/EntryIndex` `apps/galaxy/src/knowledge/EntryPanel` `apps/galaxy/src/knowledge/OrreryDiagram` `apps/galaxy/src/knowledge/sign-in` `apps/galaxy/src/knowledge/render.test.ts` | — | 1 |
| s3 | The Repository menu on `/knowledge`: the viewer's workspaces with their org and installation (`memberGithub`), the App's reader listing each installation's touched repositories (config checked fifty per GraphQL call, kept five minutes) and reading a picked one's registers into a graph through `graphOfTexts` (kept one minute), the menu's repositories across workspaces, `knowledgeAccess` taking `?repo=` with the not-offered state, the menu in the page's heading (a GET form with Show), the star chart link on the deployed checkout only, the three notices, and the README's knowledge map section | `apps/galaxy/src/data/workspace` `apps/galaxy/src/knowledge/github` `apps/galaxy/src/knowledge/repos` `apps/galaxy/src/knowledge/access` `apps/galaxy/src/knowledge/RepoPicker` `apps/galaxy/src/knowledge/KnowledgeScreen` `apps/galaxy/src/knowledge/page.test.ts` `apps/galaxy/src/knowledge/render.test.ts` `apps/galaxy/src/knowledge/knowledge.css` `apps/galaxy/app/knowledge/` `apps/galaxy/README.md` | s1, s2 | 2 |

**Shared ground.**
- `apps/galaxy/src/knowledge/render.test.ts` is declared by s2 (the `repo=` on every link rendered
  through `KnowledgeMap`) and s3 (the menu, the notices and the star chart link rendered through
  `KnowledgeScreen`): waves 1 and 2.
- s1 and s2 share wave 1 and no prefix: s1 is the kit only, s2 the map's links only.
- s3 needs s1's `graphOfTexts` to build a picked repository's graph and s2's `repo` prop on
  `KnowledgeMap` to draw it; it is blocked by both, and alone in wave 2.

## Per slice: done when

**s1: the kit reads a knowledge folder held in memory**
- `memorySource(texts)` names the files and the folders right under a folder, sorted, `[]` for an
  absent one, reads a file it holds and refuses one it does not (an inherited name such as
  `toString` included); `diskSource(root)` lists the disk the same way.
- `readKnowledge({ ctx, source: memorySource(files) })` equals `readKnowledge({ ctx })` on the same
  files written to disk, domains, glossary term and cross-domain pair included.
- `graphOfTexts` equals `readGraph` on the same files, reads a knowledge folder moved by the config
  (`docs/kb`), ignores every file outside it, and is the empty graph for no files.
- `omni kb graph`, `omni check knowledge` and every existing kit test print and pass as before;
  `kit/test/dist.test.mjs` passes on the rebuilt bundle; nothing but `registers.mjs` parses a
  register.

**s2: every address keeps the repository**
- `entryHref({ domain: 'quote', entry: 'BR-QUOTE-1' }, 'acme/anvils')` is
  `/knowledge?repo=acme%2Fanvils&domain=quote&entry=BR-QUOTE-1`; with `null`, today's address.
- `KnowledgeMap` rendered with `repo="acme/Anvils"`: every tab, dot, index row and panel link carries
  `repo=acme%2FAnvils`, and no `/knowledge?domain=` link lacks it; the address a choice pushes
  carries it too. Rendered without `repo`, the markup is today's.
- `knowledgeCallbackPath({ repo, domain })` and `knowledgeSignInReturn` keep `repo`, and still carry
  nothing but the repository, the domain and the entry.

**s3: the Repository menu**
- `memberGithub` gives each of the person's workspaces (fake database), by slug, with its org and
  installation, none of anyone else's, and throws naming the failure.
- The reader, against a stubbed `fetch`: lists touched repositories by name without archived or
  config-less ones; reads two pages and checks fifty configs per GraphQL call; leaves out a broken
  config with its log line; keeps the listing five minutes and reuses the token; throws on a refused
  listing; builds a picked repository's graph equal to `graphOfTexts` on the same files, under the
  knowledge folder its config names and for any case of its name; returns the empty graph for a
  repository with no entry; never reads a repository its installation does not list; returns null
  with a log line when GraphQL fails or a register is truncated; keeps a graph one minute; finds the
  stored installation, else the org's, else the user's, else none.
- The menu's repositories span every workspace, by name, each once; one failing installation leaves
  the others; none without the App's credentials or when the workspaces cannot be read.
- `knowledgeAccess` answers every row of the spec's state table, never calls `loadRepo` for a
  repository the menu does not offer, and keeps the existing gate (sign-in, crew-only, closed, the
  demo without a menu).
- The page: the menu is a GET form to `/knowledge` with `name="repo"`, the deployed checkout first
  and selected by default, and a Show button; the chip shows when there is no menu; the star chart
  link shows only on the deployed checkout; the out-of-reach, not-on-the-menu and no-knowledge
  (naming `/omni:invade`) notices read as the spec says; `share.css` is imported for the select.
- A manual browser path at 1440×900 and 393×700: picking from the menu opens the repository, an
  entry click keeps `repo=`, and nothing scrolls sideways.
- `apps/galaxy/README.md`'s knowledge map section describes the menu and where its data comes from;
  `pnpm test` is green and `tsc --noEmit` adds no error.
