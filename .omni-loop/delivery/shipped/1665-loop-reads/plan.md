# Plan: the kit reads the loop's state from the Omni page, not from gh

PRD #1665, spec beside this plan (`spec.md`). Two landings, each its own draft PR opening with
`Closes #1665`, stacked: `feat/loop-reads-1of2-server` into `main`, then `feat/loop-reads-2of2-kit`
into landing 1's branch. Each slice is a sub-PR from its slice branch into its landing's branch,
with `Part of #1665`.

## Slices

| id | slice | territory | blocked by | wave | landing |
| --- | --- | --- | --- | --- | --- |
| s1 | The Omni page answers a repository's changes: the contract, the GitHub adapter with ETags, `GET /api/loop/changes` and `GET /api/loop/changes/<n>` (without review), the workspace check and the 403 / 424 / 429 answers | `apps/galaxy/src/loop/` `apps/galaxy/app/api/loop/` | — | 1 | 1 |
| s2 | The Omni page answers a change's review (checks, mergeable, threads), comments and issues: the rest of the contract | `apps/galaxy/src/loop/` `apps/galaxy/app/api/loop/` | s1 | 2 | 1 |
| s3 | `omni board` reads through `LoopReads`: the port, its Omni adapter with a 15-second limit, the shared fake, the error lines, the stale-claim commit date | `kit/lib/loop-reads/` `kit/bin/commands/board.ts` `kit/bin/board.test.ts` | — | 1 | 2 |
| s4 | `omni next` and `omni care` read through `LoopReads`: the feature and phase-0 changes, review state in place of `CARE_QUERY`, comments, the linked issues; their writes unchanged | `kit/bin/commands/next.ts` `kit/bin/next.test.ts` `kit/bin/commands/care.ts` `kit/bin/care.test.ts` | s3 | 2 | 2 |
| s5 | The roadmap gate, the status line's refresh and `omni dossier`'s issue title read through `LoopReads`; the status line keeps its last value on any error | `kit/bin/commands/roadmap.ts` `kit/bin/roadmap.test.ts` `kit/lib/roadmap/push` `kit/lib/now/build-links` `kit/bin/commands/statusline` `kit/bin/statusline.test.ts` `kit/bin/commands/dossier.ts` `kit/bin/commands/dossier.test.ts` `kit/bin/dossier.test.ts` | s3 | 2 | 2 |
| s6 | `omni flow` reads through `LoopReads`; the read helpers leave `kit/bin/github.ts`; the guard test holds no `gh` read on the loop's path; the skills say these lines are held, not failed; the README says sign-in, not `gh`, and how to self-host | `kit/bin/commands/flow.ts` `kit/bin/flow.test.ts` `kit/bin/github` `kit/test/no-gh-reads.test.ts` `kit/README.md` `kit/plugin/skills/yolo/` `kit/plugin/skills/wave/` `kit/plugin/skills/pr-care/` `kit/plugin/skills/drive/` | s4, s5 | 3 | 2 |

**Shared ground.** `apps/galaxy/src/loop/` and `apps/galaxy/app/api/loop/` are s1's and s2's: s2
waits for s1 (waves 1 and 2). In landing 2, s4 and s5 share no path and run side by side in wave 2;
s6 waits for both, because the guard test reads every moved command. `kit/dist/` is generated
(`pnpm kit:build`) and listed by no slice.

## Landings

| landing | name | merge when |
| --- | --- | --- |
| 1 | server | — |
| 2 | kit | landing 1 is deployed: the galaxy serving `/api/loop` |

## Per slice: done when

**s1**
- `GET /api/loop/changes?repo=<o/r>&base=<b>&state=all` answers `{changes: [Change]}` in the
  contract's shape, at most 200, newest first, with `state` `open`, `draft`, `merged` or `closed`;
  `head` and `label` filter the same way.
- `GET /api/loop/changes/<n>?repo` answers one `Change` with `lastCommitAt` and `files`.
- No session answers 401; a repository `repo_workspace` refuses answers 403 before any GitHub call;
  an App that cannot read it answers 424 with the install link; a spent budget answers 429 with the
  time it refills; the installation token never appears in an answer or a log.
- A repeated read sends `If-None-Match` and serves the stored body on a 304 (`@omni/github`'s fake).
- Every file sits in its ADR-0095 role; `scripts/layering-guard.test.ts` and
  `scripts/import-guard.test.ts` pass with no new baseline line.

**s2**
- `GET /api/loop/changes/<n>?repo` also answers `review: {checks, mergeable, threads}`: check runs
  on the head commit mapped to `pending|success|failure|neutral|skipped`, review comments grouped
  into threads with `resolved`.
- `GET /api/loop/comments?repo&on=<n>`, `GET /api/loop/issues?repo&label&state` and
  `GET /api/loop/issues/<n>?repo` answer their shapes, with `closedBy` on an issue.
- The contract's fixtures are shared with the kit (the file the kit's adapter test reads).

**s3**
- `omni board <n> --json` builds the same board from a fake `LoopReads` as today's tests build from
  `gh` fixtures; every existing board test passes on the fake.
- The Omni adapter calls `/api/loop/changes` with the sign-in (or `OMNI_TOKEN`), 15 s limit, and
  maps each refusal to its spec line, exit 1: `no sign-in (omni signin)`, `unreachable`,
  `refused (403|424|429|404): …`.
- `board.ts` runs no `gh` command.
- `pnpm mutation:changed --base origin/<landing 2 branch>` leaves no survivor in `kit/lib/board.ts`
  when the slice changes it.

**s4**
- `omni next`'s verdicts and `omni care`'s state come out the same from a fake `LoopReads` as from
  today's fixtures; `CARE_QUERY` is gone.
- Their writes (`care reply`, comments) are unchanged, and neither runs a `gh` read.

**s5**
- The roadmap gate, `omni statusline --refresh` and `omni dossier` give today's results from a fake
  `LoopReads`, with no `gh` read.
- On any read error the status line draws its last value, never an error.

**s6**
- `omni flow`'s open-change and merge checks read through `LoopReads`.
- `kit/bin/github.ts` keeps only its write helpers (and `githubEnv` for them).
- `kit/test/no-gh-reads.test.ts` fails on any `gh pr list`, `gh pr view`, `gh pr diff`,
  `gh pr checks`, `gh issue view`, `gh issue list` or `gh api graphql` in the seven commands and
  their helpers, and passes on the branch.
- `/omni:yolo`, `/omni:wave`, `/omni:pr-care` and `/omni:drive` say the six lines are held, not
  failed.
- The kit README says these commands need a sign-in instead of `gh`, and how to point `ask.url` at a
  self-hosted Omni.
