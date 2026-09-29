---
prd: 523
title: Knowledge map repository menu — the knowledge of every repository Omni Loop touched in your workspaces
blocked-by: none
spec: file
---

# Knowledge map repository menu — the knowledge of every repository Omni Loop touched in your workspaces

**Date:** 2026-09-29 · **PRD:** #523 · **Follows:** PRD 149 (the knowledge map), PRD 359 (a workspace
per App installation), PRD 426 (galaxy reads a repository as the App) · **Touches:**
- the kit's one register parser: `kit/lib/knowledge/registers.mjs`, `kit/lib/knowledge/graph.mjs`, the
  bundle `kit/dist/omni.mjs` and `kit/porting/knowledge--registers.md`
- the galaxy app's knowledge page: `apps/galaxy/app/knowledge/{page,layout}.tsx`,
  `apps/galaxy/src/knowledge/*`, `apps/galaxy/src/data/workspace.ts`
- `apps/galaxy/README.md` (The knowledge map)

## Problem

`/knowledge` draws one knowledge base: the one in the checkout the app is deployed from,
`vertuoza/vertuo-omni-loop` (PRD 149, decision 6: no GitHub call). Every other repository a workspace
set up with Omni Loop has its own `.omni-loop/knowledge` (`/omni:invade` proposes one, every merged
feature harvests into it, PRD 82), and none of them can be seen on the page:

- **A team cannot read its own product's knowledge** without opening the Markdown file by file on
  GitHub, even though the App that harvested it is installed on the repository.
- **The page names a repository nobody picked.** A member of the Acme workspace opens `/knowledge` and
  sees Omni Loop's own principles, with no way to reach Acme's.
- PRD 149 named "each sector's repositories' knowledge" as later work; the seam it left,
  `omni kb graph --json` and the one parser behind it, reads only the disk.

## Solution

**A Repository menu on `/knowledge`.** When the viewer's workspaces have other repositories Omni Loop
touched, a menu labelled **Repository** takes the place of the repository's chip in the page's
heading:

- **The deployed checkout first,** labelled with its slug, and selected when the address names no
  repository. Its addresses stay exactly as they are today (`/knowledge?domain=&entry=`).
- **Then every repository Omni Loop touched in the viewer's workspaces,** by name, case-insensitive,
  each once. "Touched" means both: the workspace's omni-loop-invader App installation reaches it, and it
  carries `.omni-loop/config.yml` on its default branch (what `omni init` and `/omni:invade` leave).
  Archived repositories are left out.
- **Picking one** opens `/knowledge?repo=<owner/name>` on its first domain. Every tab, dot, index row
  and panel link on that page keeps `repo=`, so a link to one of its entries can be shared, and signing
  in from such a link comes back to it.
- **The menu is a GET form** with a **Show** button, so it works before any script runs; with a script,
  choosing an option opens it at once (the deployed checkout at plain `/knowledge`).
- **The star chart link** shows only while the deployed checkout is shown: the arcade charts that one
  alone.
- **With nothing else to offer** (no other touched repository, the App's credentials unset, or GitHub
  or the workspaces unreadable), no menu is drawn and the chip stays, as today.

**Reading another repository.** On the server, as the Omni Loop App, with the `GITHUB_APP_ID` and
`GITHUB_APP_PRIVATE_KEY` galaxy already holds (PRD 359, PRD 426):

1. **The viewer's workspaces** are read as the viewer (row-level security): each one's `github_org`
   and `github_installation_id`. A workspace that stored no installation (made before PRD 359) uses
   the App's installation on its GitHub org, else on that user account.
2. **An installation's repositories:** `GET /installation/repositories`, a hundred per page, at most
   ten pages; then GitHub's GraphQL API checks fifty repositories' `HEAD:.omni-loop/config.yml` per
   call. A config that does not parse leaves its repository out, with one log line. Kept five minutes
   per installation.
3. **A picked repository's knowledge:** one GraphQL call reads the `product/`, `domains/<name>/` and
   `cross-domain/` registers under the knowledge folder its own config names (`paths.knowledge`), at
   its default branch's tip. The kit builds the graph from those texts with the same parser that reads
   the disk (`graphOfTexts`), so the map is drawn exactly as the deployed checkout's. Kept one minute
   per repository. A register GitHub truncates makes the repository out of reach, never half-read.
4. The installation token stays in server memory until a minute before it expires, and never reaches a
   page.

**The kit.** `readKnowledge({ ctx, source })` reads through a source: `diskSource(root)`, the default
(`ctx.root`, so every existing caller is unchanged), or `memorySource(texts)`, the same `files`,
`dirs` and `read` over texts already fetched. `graphOfTexts({ texts, knowledgeRoot, repo })` in
`graph.mjs` builds a graph from them. Nothing outside `registers.mjs` parses the Markdown.

**What each state says.**

| The address asks for… | The page shows |
|---|---|
| nothing, or the deployed checkout's slug (any case) | the deployed checkout's map, the menu on it |
| a repository the menu offers (any case) | that repository's map, the menu on it, no star chart link |
| a repository the menu offers, GitHub unreadable | **The knowledge is out of reach**: "The knowledge of <repo> could not be read from GitHub; this deployment's log says why." The menu stays |
| a repository the menu does not offer | **This repository is not on the menu**: "<repo> is not a repository of your workspaces set up with Omni Loop, or the Omni Loop App cannot read it." Nothing is read |
| a touched repository with no entry yet | **No knowledge yet**, adding that running `/omni:invade` in it proposes some |

Who reaches the page is unchanged (PRD 149): signed out, the sign-in card; signed in in no workspace,
the crew-only notice; the demo in development shows the local checkout and no menu.

## Decisions

1. **"Touched by Omni" is the installation's reach plus the loop's config.** The person asked for "the
   ones Omni touched in the workspace": a repository the App is installed on but that never ran
   `omni init` or `/omni:invade` has no knowledge to show, and the App itself stays silent there.
2. **Every workspace the viewer belongs to,** not only the first one joined: a person in two
   workspaces sees the repositories of both, and never those of a workspace they are not in
   (P-PRODUCT-27).
3. **The deployed checkout stays the default** and keeps its addresses, so every link shared today
   still opens what it opened.
4. **Only a repository the menu offers is ever read.** `?repo=` is matched against the viewer's own
   list; GitHub is never asked about a name typed into the address.
5. **Read at request time, from GitHub, as the App** (amending PRD 149's decision 6 for repositories
   other than the deployed checkout): no Supabase table, no copy to keep fresh, and the same App reads
   repositories for the PRD page (PRD 426). The deployed checkout is still read off disk.
6. **GraphQL, batched,** so the menu costs about one call per fifty repositories every five minutes,
   and a picked repository one call a minute, whatever the installation's size.
7. **The kit keeps one parser.** The app hands the kit the texts it fetched; it never reads a
   register's Markdown itself (PRD 149, decision 5).
8. **A failure narrows the menu, never the page** (P-PRODUCT-28, P-PRODUCT-30): an installation that
   cannot be read leaves the other workspaces' repositories offered, and the deployed checkout is always
   there.
9. **An empty repository keeps the way forward** (P-PRODUCT-45): its notice names `/omni:invade`.
10. **The arcade's star chart is unchanged**; a star chart per repository is a follow-up PRD.
11. **A prototype exists:** `feat/knowledge-repo-picker` (commit `db21ce4`) implements this spec with
    its tests green. The slices may port from it; the branch is deleted once this PRD ships.

## User stories

1. As a member of the Acme workspace, I open `/knowledge`, pick `acme/widgets` in the Repository menu,
   and read its principles, rules and invariants on the same map.
2. As that member, I share `/knowledge?repo=acme/widgets&domain=quote&entry=BR-QUOTE-1` in a review,
   and my colleague lands on that rule.
3. As a member of two workspaces, I see the repositories of both in one menu.
4. As a person who set up a repository with `omni init` but never ran `/omni:invade`, I pick it and am
   told it holds no knowledge yet, and how to propose some.
5. As a member of Acme, I type `?repo=globex/secret` into the address and am told it is not on the
   menu; nothing of it is read.
6. As a Vertuoza colleague whose link to `/knowledge?domain=product&entry=P-PRODUCT-3` is in an old
   review, it still opens that principle.

## Scope

In:
- The kit's `diskSource`, `memorySource`, `readKnowledge({ ctx, source })` and `graphOfTexts`, their
  tests, the rebuilt bundle and the porting note.
- `memberGithub()` in `src/data/workspace.ts`: the viewer's workspaces with their org and installation.
- `src/knowledge/github.ts` (the reader as the App) and `github-server.ts` (its one instance);
  `src/knowledge/repos.ts` (the menu's repositories across workspaces).
- `knowledgeAccess()` taking the address's `repo`, and the `not-offered` view.
- The menu (`RepoPicker.tsx`), the heading, the notices, `repo=` in every entry address and in the
  sign-in return, the CSS (`share.css` imported for the select's look).
- `apps/galaxy/README.md`'s knowledge map section.

Out:
- The arcade's star chart for other repositories.
- Repositories without `.omni-loop/config.yml`, and a menu entry for a workspace's `sectors`.
- Paging past a thousand repositories per installation.
- The MCP server PRD 149 named as a follow-up.
- Any Supabase migration, and any change to who reaches the page.

## Test seams

Following `omni kb show testing`: tests sit beside the code, and no test calls GitHub or Supabase.

- **Kit** (`kit/lib/knowledge/registers.test.mjs`, `graph.test.mjs`): `memorySource` lists files and
  folders right under a folder, sorted, and nothing for an absent one, and refuses a file it does not
  hold; `readKnowledge` reads the same folder from memory as off disk; `graphOfTexts` equals
  `readGraph` on the same files, honours a moved knowledge folder, ignores files outside it, and is an
  empty graph for no files. `kit/test/dist.test.mjs` keeps the bundle fresh.
- **The reader** (`src/knowledge/github.test.ts`, against a stubbed `fetch`): listing by name without
  archived or config-less repositories; two pages and fifty configs per call; a broken config left out
  with its log line; the listing kept five minutes and the token reused; a refused listing throws; a
  picked repository's graph equals the kit's; a moved knowledge folder and any case of the name; an
  empty repository; an unlisted repository never read; a GraphQL failure and a truncated register each
  null with their log line; a graph kept one minute; the stored installation, the org's, the user's,
  none.
- **The menu's repositories** (`src/knowledge/repos.test.ts`): across workspaces, by name, each once;
  one failing installation leaves the others; none without credentials or when the workspaces cannot
  be read.
- **The workspaces** (`src/data/workspace-github.test.ts`, on the fake database): each of the person's
  workspaces with its org and installation, none of anyone else's.
- **Access** (`src/knowledge/access.test.ts`): every row of the state table above, plus the existing
  gate (sign-in, crew-only, closed, demo without a menu).
- **The page** (`page.test.ts`, `render.test.ts`, `view.test.ts`, `sign-in.test.ts`): the menu's markup
  and selected option, `repo=` on every tab, dot, row and panel link and none without it, the star
  chart link only on the deployed checkout, the three notices, the sign-in return keeping `repo`.
- **A manual browser path** for the visual risk: the menu at 1440×900 and 393×700, no sideways scroll.

## Risks

- **Publishes** (per `omni kb show releasing`): the kit's bundle changes with the next `v0.0.N` (an
  additive parameter: every existing call is unchanged); the galaxy app deploys on merge. No migration.
- **Knowledge reaches every member of a workspace** for every repository its installation reaches,
  including a private repository a member cannot open on GitHub. This is the model the PRD page already
  follows for PRDs and outboxes (PRD 426); a workspace that does not want it installs the App on fewer
  repositories.
- **GitHub API budget:** at most ten listing calls and one GraphQL call per fifty repositories per
  installation every five minutes, plus one call per picked repository a minute, under the App's
  installation limit.
- **The App's permissions:** reading contents is already granted for the outbox check and the PRD page;
  no new permission is asked.
- **Rollback:** revert the feature PR. Nothing is stored; the kit's new parameter disappears with its
  only caller.

## Acceptance criteria

1. With other touched repositories in the viewer's workspaces, `/knowledge` shows a **Repository** menu
   listing the deployed checkout first, then each touched repository by name, once.
2. A repository the App reaches without `.omni-loop/config.yml`, or archived, is not listed.
3. Picking a repository shows its map, drawn from its own knowledge folder at its default branch's tip,
   and every entry link on the page carries `repo=<owner/name>`.
4. `/knowledge` with no `repo`, or with the deployed checkout's slug, shows the deployed checkout as
   today, at its existing addresses, and with the star chart link; a picked repository shows none.
5. `?repo=` naming a repository the menu does not offer says it is not on the menu, and GitHub is never
   asked about it.
6. A touched repository with no entry says so and names `/omni:invade`; one GitHub cannot read says its
   knowledge is out of reach, with the menu still there.
7. Without the App's credentials, or when GitHub or the workspaces cannot be read, the page shows the
   deployed checkout's map with its chip, as today.
8. Signing in from a `/knowledge?repo=…` link comes back to the same repository, domain and entry.
9. The menu works with scripts off (the Show button), and the page never scrolls sideways on a
   393 px-wide phone.
10. The kit's existing knowledge commands (`omni kb graph`, `omni check knowledge`, `omni knowledge`)
    print what they printed before.
