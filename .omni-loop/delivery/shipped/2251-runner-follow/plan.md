# Plan: The terminal sends a PRD to a runner and follows it

PRD #2251, spec in `spec.md` beside this plan. The feature branch `feat/runner-follow` goes into
`main` with `Closes #2251`; each slice is a sub-PR from `feat/runner-follow--<slice>` into the
feature branch, with `Part of #2251`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The terminal's sign-in reads the workspace's runners, a PRD's jobs and a job's lines, a member of the workspace only | `apps/galaxy/src/runners/runners.` `apps/galaxy/app/api/runners/` | — | 1 | deep |
| s2 | A Runners page job whose line names a PRD of its repository shows `PRD <n>`, linking its page, and its title | `apps/galaxy/src/runners/page/` `apps/galaxy/app/app/runners/` | — | 1 | build |
| s3 | `omni runner send` queues a line, and `omni runner follow <n>` prints the PRD's job milestones until it ends | `kit/lib/runner/follow` `kit/lib/runner/api` `kit/bin/commands/runner` | s1 | 2 | build |
| s4 | `/omni:yolo-runner <n>` follows the PRD's job or sends one, then hands off on its ending; brainstorm and yolo-fix name it | `kit/plugin/skills/yolo-runner/` `kit/plugin/skills/brainstorm/SKILL.md` `kit/plugin/skills/yolo-fix/SKILL.md` `kit/plugin/.claude-plugin/` `kit/test/plugin.test.ts` `kit/porting/plugin--yolo-runner.md` `kit/porting/plugin--brainstorm.md` `kit/porting/plugin--yolo-fix.md` | s3 | 3 | build |
| s5 | The HUD band shows the runners' free slots while one is online for this repository, and the followed job's last milestone | `kit/lib/now/` `kit/bin/commands/now` `kit/plugin-hud/` | s3 | 3 | build |

**Shared ground.** None between slices of one wave. s1 owns the runner routes, the service, the
repository and the contract (`apps/galaxy/src/runners/runners.*`); s2 reads the contract and changes
only the page. s3 owns the kit's runner client; s4 and s5 only call `omni runner` commands and read
what s3's follow leaves for this session. `kit/dist/` is rebuilt by the wave, never listed.

## Per slice: done when

### s1 (deep: three reads opened to the kit's sign-in, each must stay inside its workspace)

- `GET /api/runners` answers the caller's workspace runners (name, fleet, state, slots used, slots,
  repositories) to the kit's sign-in; a caller outside the workspace reads none.
- `GET /api/runners/jobs?repo=<owner/repo>&prd=<n>` answers that PRD's jobs in that repository, newest
  first (status, runner, PR link, outcome, times); a job whose line names another PRD is left out.
- `GET /api/runners/jobs/<id>/lines?after=<seq>` takes the kit's sign-in as well as the session, with
  the same 404 for anyone outside the job's workspace.
- Tests in `runners.controller.test.ts`, `runners.service.test.ts`, `runners.contract.test.ts`.

### s2 (`ui: yes`)

- A job whose line is `/omni:<skill> <n>` and whose repository has PRD n's dossier shows, under its
  line, `PRD <n>` linking the PRD's page, then its title; any other line shows as today
  (`model.test.ts`, `render.test.ts`, the demo updated).

### s3

- `kit/lib/runner/follow.ts` `milestones(previous, job, lines, merged)` returns the new milestone
  lines, each once: queued, claimed by `<runner>`, waiting for approval, each `PR: <link>`,
  `<k>/<total> slices merged` going up only, and the ending (`Waiting on answers`, `Held`, `Ready`,
  `Done`, `Failed: <reason>`, `Cancelled`, `Runner lost`) with the PRD page link
  (`follow.test.ts`).
- `omni runner send '<line>' [--to <runner|fleet>]` queues the line and prints the job id; a line no
  runner runs is refused before any call.
- `omni runner follow <n>` finds the newest job of PRD n in this repository, reads it and its lines
  every 5 seconds, prints the milestones, writes the last one for this session, and exits `0` on done,
  `1` on failed, cancelled or runner lost; no job yet keeps waiting for one; an unreadable page ends
  held, not failed (`runner.test.ts` against a fake page).
- `omni help runner` names both.

### s4

- `kit/plugin/skills/yolo-runner/SKILL.md`: follows a queued or running job of PRD n, else sends
  `/omni:yolo <n>` (asking where when more than one runner is online, none under `OMNI_UNATTENDED`),
  then runs `omni runner follow <n>` and hands off on its ending as the spec says.
- `/omni:brainstorm`'s and `/omni:yolo-fix`'s **What is next?** add "To build it on a runner instead:
  `/omni:yolo-runner <n>`." above their last line.
- `kit/test/plugin.test.ts` pins the skill's front matter and both hand-off lines; porting notes added.

### s5

- `omni now --json` carries `runners: { free, slots }` only while a runner of the workspace is online
  for this repository (cached 30 seconds, `null` when the read fails), and `runner: { line }` while
  `omni runner follow` runs in this session (`now.test.ts`).
- The band draws `runners <free>/<slots> slots free` and the runner row from them, and hides each when
  absent (`hud.test.tsx`).
