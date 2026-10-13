# Plan: Runners — send work from the Omni app to a terminal

PRD #1830, spec beside this plan (`spec.md`). The feature branch `feat/runners` merges into `main`
through the feature PR (`Closes #1830`); each slice is a sub-PR from `feat/runners--<slice>` into
the feature branch (`Part of #1830`). One landing: the migration, the routes, the page and the kit
all ship on the same merge, and nothing reads the tables until a runner registers.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The server side of runners: the `runners` and `runner_jobs` tables, the line and target checks, the claim, a lost runner's jobs, and all six `/api/runners/*` routes | `supabase/migrations/20261207` `supabase/database.types.ts` `supabase/checks/` `apps/galaxy/src/runners/runners.` `apps/galaxy/src/runners/fixtures/` `apps/galaxy/app/api/runners/` | — | 1 |
| s2 | `omni runner`: register, wait on `next`, run each job in a worktree and tmux, send the log tail and the PR link, cancel, timeout, back-off; the sender line in `/omni:pr`; the kit README and its help entry | `kit/bin/commands/runner` `kit/bin/commands/index.ts` `kit/lib/runner/` `kit/lib/help/` `kit/plugin/skills/pr/` `kit/README.md` | — | 1 |
| s3 | The Runners page at `/app/runners` and its sidebar entry: runners with their state and fleet (an owner changes it), jobs with their log tail, PR link, Cancel and Send again | `apps/galaxy/src/runners/page/` `apps/galaxy/app/app/runners/` `apps/galaxy/src/nav/sidebar` `apps/galaxy/src/nav/Sidebar` | s1 | 2 |
| s4 | Send to terminal beside every button that copies a listed `/omni:` line, with its target picker and `Queued for <target>` | `apps/galaxy/src/runners/send/` `apps/galaxy/src/dossier/page/` `apps/galaxy/src/concepts/ConceptPage` | s1 | 2 |

**Shared ground.** No prefix is declared by two slices. `apps/galaxy/src/runners/` is split by
prefix: s1 owns the area's role files (`runners.*`) and its fixtures, s3 the `page/` folder, s4 the
`send/` folder, so s3 and s4 share wave 2 without meeting. s3 and s4 call s1's routes through
`runners.client.ts`, which s1 writes; a change either needs in it waits for a later wave. The
sidebar's tests (`apps/galaxy/src/nav/sidebar.test.ts`, `Sidebar.render.test.ts`) sit under s3's
prefixes alone. The dossier page's render tests (`apps/galaxy/src/dossier/page/render.test.ts`) sit
under s4's alone. `kit/dist/` is built: s2 rebuilds it only to test and commits none, and the wave
rebuilds it once after merging.

## Per slice: done when

**s1** (`ui: yes`)
- One migration, dated after the newest on `main`, creates `runners` and `runner_jobs` as the spec's
  **Data** says. Workspace members read them under row-level security, and only the service role
  writes them. `supabase/database.types.ts` carries both.
- `runners.contract.ts` holds the zod shapes of every route, and the line check: a listed skill and
  arguments of letters, digits, spaces and `._/:#-`, at most 200 characters. Contract tests cover
  each listed skill, an unlisted one, `/omni:brainstorm`, `/omni:drive`, shell characters and 201
  characters.
- The claim takes the oldest queued job a runner may run in one `for update skip locked` statement.
  Repository tests show two claims on one job and exactly one winner. Service tests cover: to a
  runner, to a fleet, to any; a fleet runner skipping "any"; a repository the runner does not hold.
- A runner silent for over 90 s leaves its claimed and running jobs `failed`, reason `runner lost`,
  on the next `next`, job update or page read. A fixed-clock test checks 89 s and 91 s.
- `register`, `next` (held up to 50 s, then 204, and counted as a check-in) and `jobs/<id>`
  (status, log tail cut to 200 lines and 16 KB, PR link, `{cancel: true}` when one waits) take the
  kit's sign-in.
- `POST /api/runners/jobs`, `jobs/<id>/cancel` and `PATCH /api/runners/<id>` take the session.
- Controller tests cover:
  - a bad or missing token;
  - a sender outside the fleet;
  - a non-owner setting a fleet;
  - a repository outside the workspace;
  - status updates in order, out of order, after cancel and after `runner lost`.
- `scripts/layering-guard.test.ts` and `scripts/import-guard.test.ts` pass with no new baseline
  line.

**s2**
- `omni runner --name <n> --repos <dir> [--slots 4] [--timeout 3h]` reads the kit token as every
  kit command does. It lists the checkouts under `--repos` by `origin`, checks `claude` is installed
  and signed in, registers, and keeps one `next` open per free slot.
- `main()` tests on a fixture repository, with a fake app (injected `fetch`) and a fake `claude`,
  show that:
  - a claimed job runs in `~/wt/<repo>-job-<id>` on `agent/job-<id>`, in tmux `job-<id>`, logged to
    `~/logs/job-<id>.log`;
  - the line reaches `claude` from a file, never a shell;
  - the log tail is sent every 5 s;
  - the last PR URL of the job's repository is read from the log;
  - the worktree is removed and the branch kept.
- The runner checks the line itself and refuses an unlisted skill even when the app sends one.
- Tests cover each failure the spec names:
  - a timeout kills the job and reports `failed`, reason `timeout`;
  - a cancel kills the job and reports `cancelled`;
  - an unreachable app is retried from 5 s doubling to 60 s while jobs keep running;
  - a refused token stops with `no sign-in (omni setup-token)`;
  - a missing or signed-out `claude` refuses to register;
  - Ctrl-C waits for running jobs.
- With `OMNI_SENT_BY` and `OMNI_RUNNER` set, `/omni:pr` writes
  `Sent from the Omni app by @<login> on runner <name>` in the body of the pull requests it opens.
  Without them it writes nothing new.
- `omni help runner` describes it, and the kit README has a runner section: start one, what it
  needs, and which lines it runs.

**s3** (`ui: yes`)
- `/app/runners` sits under the sidebar's Dashboard group, after Loop, with its sprite.
- It shows the runners as the `runners` draft screen draws them:
  - Online, Busy, or Offline with when it was last seen;
  - the fleet as a picker for a workspace owner and as text for everyone else;
  - slots used out of slots, the repositories and the kit version.
- It shows the jobs, queued and running first, then the last 50 that ended:
  - opening one shows its log tail;
  - a done job links its pull request;
  - Cancel shows on queued and running jobs, and Send again on failed and cancelled ones.
- With no runner, the page shows `omni runner --name <name> --repos <dir>` to copy.
- The rows are read again every 5 s while the page is open.
- Component tests cover:
  - each runner state and each job status;
  - the owner and non-owner fleet cell;
  - Cancel and Send again only where they apply;
  - the empty page.
- The sidebar's tests name the new entry.
- The page passes `omni design words` on its marked screen, and `page-width.test.ts`.

**s4** (`ui: yes`)
- Send to terminal sits beside every button that copies an `/omni:` line whose skill is on the list:
  - **Build it** on a PRD's page;
  - the copy buttons of the PR care, User voice and Pitch panes, and of a concept's page.
- It shows only when the workspace has a runner the viewer may send to.
- Its picker lists Any runner, then each fleet with a runner, then each runner by name with its
  state, each only when the viewer may send there. Send is its one primary action.
- Once sent, it shows `Queued for <target>` with a link to the job on `/app/runners`. A refusal from
  the route shows its reason in the same place.
- Component tests cover:
  - the button hidden with no runner and for an unlisted skill;
  - the picker listing only allowed targets;
  - the queued and refused states.
- The dossier page's render tests still pass.
- By hand, once, on `vertuo-agents`, after the wave merges: `/omni:yolo` for a small PRD sent from
  its page runs on the runner, shows on `/app/runners` with its log tail, and ends Done with its pull
  request's link.
