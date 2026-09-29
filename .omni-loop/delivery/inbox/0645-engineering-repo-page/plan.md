# Plan: Engineering board — top people with avatars and a page per repository

PRD #645, spec in `spec.md` beside this plan. It is built on `feat/engineering-repo-page`, which
merges into `main` with `Closes #645`. Each slice is a sub-PR from `feat/engineering-repo-page--<slice>`
into the feature branch, with `Part of #645`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Most opened, Most merged and Most reviews are ranked rows (rank, avatar, login, right-aligned count, bar scaled to the leader in the list's colour). The avatar is the player's game hero when the login is a player in the workspace, the GitHub picture otherwise. A failed faces read falls back to GitHub pictures | `apps/galaxy/src/engineering/` | — | 1 |
| s2 | Each repository name in the table links to `/app/engineering/<owner>/<repo>` with the period. That page shows the back link, the repository heading, the period switch, the tiles, the Omni Loop panel, Merged per day and the three lists for that repository alone, with no Repositories table. An untracked repository gets a 404, and the sidebar keeps Engineering current | `apps/galaxy/src/engineering/` `apps/galaxy/app/app/engineering/` `apps/galaxy/src/nav/sidebar.test.ts` | s1 | 2 |

**Shared ground:** `apps/galaxy/src/engineering/` is declared by both slices. Both change
`EngineeringBoard.tsx`, `load.ts`, `demo.ts`, `engineering.css` and the tests beside them
(`render.test.ts`, `load.test.ts`, `page.test.ts`, `tally.test.ts`). s2 is blocked by s1 and runs in
wave 2, so it starts from s1's merged board, and the repository page shows the new lists.

## Per slice: done when

**s1 · Top people with bars and avatars**

- `render.test.ts`: each of the three lists renders up to five rows, each with a rank, an avatar, the
  login, a right-aligned count and a bar whose width is count ÷ the first count (the first row is at
  100 %). The bar's colour class differs per list (opened, merged, reviews).
- A pure `faceOf(login, players)` in `src/engineering/`, tested. It returns a hero for a player
  whose `github_login` matches whatever the case and whose hero is valid, tinted with the fleet's
  colour only when that colour is a hex. It returns the GitHub picture
  `https://github.com/<login>.png?size=56`, with the login encoded, for no player or an invalid hero.
- A hero renders as an inline pixel SVG (`heroLook` + `spritePixels`, as `YouBlock` does), and a
  GitHub picture as an `<img>` with `alt=""`, width and height 28.
- `EngineeringReads` gains a faces read: `players` rows whose `github_login` is one of the logins
  shown, with their hero and their fleet's colour. `load.test.ts` proves it on the fake client
  (logins lower-cased, one query), and proves that a failing faces read still returns the board with
  every face on the GitHub picture.
- The demo board shows at least one hero and one GitHub picture.
- At 393 px, `engineering.css` keeps the count in its column and lets a long login wrap. A manual
  browser pass at 1280 px and 393 px, in light and Omni, is noted on the sub-PR.
- `pnpm test` is green.

**s2 · A page per repository**

- `tally.test.ts`: `engineeringOf` fed one tracked repository, with rows from several repositories,
  counts only that repository's pull requests and reviews in the tiles, the people, the Omni panel
  and perDay.
- `load.ts` gains a one-repository load. It returns "not tracked" when the repository (matched
  case-insensitively) is not in the workspace's tracked list. Otherwise it reads the pull requests
  and reviews of that repository alone. `load.test.ts` asserts the narrowed filter on the fake
  client.
- The new route `app/app/engineering/[owner]/[repo]/page.tsx` decides demo, closed, signed out,
  no workspace, a tracked repository (the board), and an untracked one (`notFound()`), with the
  period defaulting to 7d. `page.test.ts` covers each.
- `render.test.ts`: in the Repositories table, each name is a link to its page carrying `?period=`.
  The repository page renders `← All repositories` (keeping the period), the tracked spelling as the
  one `<h1>`, period links that stay on the page, and no Repositories table.
- `demoEngineeringBoard` takes a repository, and the demo's repository page renders.
- `src/nav/sidebar.test.ts`: `/app/engineering/vertuoza/pdf-builder` marks Engineering current.
- `pnpm test` is green.
