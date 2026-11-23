# Plan: A mission lives on the server: no docs PR, no retro commit

PRD #3194, spec beside this plan (`spec.md`). The feature branch `feat/mission-on-server` merges into
`main` with `Closes #3194`; each slice is a sub-PR from `feat/mission-on-server--<slice>` into the
feature branch with `Part of #3194`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The app serves a mission's brief and retros, and which missions name a PRD, to a member of its workspace only | `apps/galaxy/src/missions/missions.` `apps/galaxy/app/api/missions/brief/` `apps/galaxy/app/api/missions/of-prd/` | — | 1 | build |
| s2 | `omni mission get <n>` writes a mission's brief and retros as plain files, and `omni mission push <n> --from <dir>` sends a folder outside the repository; both hold with one line when the page cannot be read | `kit/bin/commands/mission.ts` `kit/bin/mission.test.ts` `kit/lib/mission/folder.ts` `kit/lib/mission/get.` `kit/lib/ask/client.ts` `kit/lib/help/entries.ts` | — | 1 | build |
| s3 | `omni ready` reads which missions name a PRD from the page, and holds when it cannot read it | `kit/lib/mission/membership.ts` `kit/bin/commands/ready.ts` `kit/bin/ready.test.ts` | s2 | 2 | build |
| s4 | `/omni:mission` opens no branch or docs PR, `/omni:mission-retro` commits nothing at any level, the mission's PM reads the page through `omni mission get`, and the help and guide say the page is the record | `kit/plugin/skills/mission/` `kit/plugin/skills/mission-retro/` `kit/plugin/skills/brainstorm/SKILL.md` `kit/plugin/skills/roadmap/SKILL.md` `kit/plugin/skills/mega-brainstorm/SKILL.md` `kit/plugin/skills/mega-roadmap/SKILL.md` `kit/lib/help/entries.ts` `docs/guide/missions.md` `kit/test/mission-skill-product.test.ts` `kit/test/mission-server.test.ts` | s2 | 2 | build |

**Shared ground.** `kit/lib/help/entries.ts` is declared by s2 (the `omni mission get` and `push
--from` usage) and s4 (the `/omni:mission` and `/omni:mission-retro` entries): s2 is in wave 1 and s4
in wave 2, so they never merge side by side. `kit/dist/` is built, never listed: each slice rebuilds it
only to test, and the wave rebuilds it once after merging. s2 and s3 both read the page through
`kit/lib/ask/client.ts`; only s2 changes it (both reads), and s3 calls it.

## Per slice: done when

### s1

- `GET /api/missions/brief?repo=<owner/name>&mission=<n>` answers a member the latest `mission-record`
  and `brief` versions as pushed, byte for byte, and each retro of the mission with its items.
- `GET /api/missions/of-prd?repo=<owner/name>&prd=<n>` answers the numbers of the missions whose brief
  names the PRD, and an empty list when none does.
- A caller of another workspace, and a mission that does not exist, get 404 on both (AC-6); no bearer
  token gets 401. Tests run through the controller and service on the fake store (ADR-0095 layering).

### s2

- `omni mission get 3189` against a fake app writes `mission.md`, `mission.html` and `retros/<k>-<milestone>.md`
  (and each item under `outbox/`) exactly as the page holds them, into the mission's folder or `--out`,
  and prints the folder (AC-3). Nothing is committed.
- `omni mission push <n> --from <dir>` reads a folder outside the repository with the same checks as
  today; with no `--from` it reads the repository folder, as before.
- Unreachable, refused or not signed in: `mission <n> not read: <why>`, exit 1; a mission the page does
  not hold: `no mission #<n> on the page`, exit 1.
- The help entry of `omni mission` names `get` and `--from`.

### s3

- `omni ready <prd>` takes mission membership from `GET /api/missions/of-prd`; the checkout's
  missions folder is no longer read for it.
- When the page cannot be read, it prints `mission membership not read: <why>` and exits 1, never
  `in no mission` (AC-4).

### s4 (light for the guide and help words; the skill steps are build)

- `/omni:mission` writes the brief to a scratch folder, pushes it with `--from`, and holds no worktree,
  branch, commit or pull-request step; its hand-off gives the mission's page and Start; a failed push
  keeps the folder and prints `omni mission push <n> --from <dir>` (AC-1, AC-2), checked by
  `kit/test/mission-server.test.ts` on the skill's text.
- `/omni:mission-retro` commits and pushes nothing at any level, and its record line carries
  `"file": null` (AC-5).
- The `--mission` sections of `/omni:brainstorm`, `/omni:roadmap`, `/omni:mega-brainstorm` and
  `/omni:mega-roadmap` run `omni mission get <m>` first and stop on its line when it fails.
- `kit/lib/help/entries.ts` and `docs/guide/missions.md` say the page is a mission's record and name
  `omni mission get`; no text says the skill opens a docs PR.
