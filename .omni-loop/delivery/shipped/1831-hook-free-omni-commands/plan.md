# Plan: hook-free omni commands

PRD #1831, specified in `spec.md` beside this plan. The feature branch `feat/hook-free-omni-commands`
merges into `main` with `Closes #1831`; each slice is a sub-PR from `feat/hook-free-omni-commands--<slice>`
into the feature branch, with `Part of #1831`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The ask round runs from one core both entries share: Claude's hook keeps its behaviour and its tests unedited, and `kit/plugin/hooks/hooks.json` is pinned unchanged | `kit/lib/ask/hook` `kit/lib/ask/round` `kit/lib/ask/schema` `kit/bin/ask-hook.test.ts` `kit/test/hooks-json.test.ts` | — | 1 |
| s4 | Any `omni` command run in a session sends the heartbeat, at most once a minute, detached; `OMNI_HEARTBEAT=off` turns it off; `omni heartbeat` reads the session resolver when stdin carries none | `kit/bin/omni.ts` `kit/bin/heartbeat` `kit/bin/commands/heartbeat.ts` `kit/lib/ask/heartbeat` `kit/lib/env/read` `README.md` | — | 1 |
| s2 | `omni ask question`, `omni ask wait` and `omni ask answer` ask the person on the page from any agent, with exit codes 0, 2, 3 and 4, a 110 s default wait, and `OMNI_ASK` switching ask mode with no file — the cloud seam included | `kit/bin/commands/ask.ts` `kit/bin/ask.test.ts` `kit/bin/ask-question` `kit/lib/ask/mode` `kit/lib/ask/question` `kit/lib/env/read` `README.md` | s1 | 2 |
| s3 | `omni session start` prints the constituents, the briefing and the session id, storing a generated id when none resolves; `omni session end` closes the ask session and sends the heartbeat's end | `kit/bin/commands/session` `kit/bin/session` `kit/bin/commands/index.ts` `kit/lib/dossier/session` `kit/lib/help/entries` | s1, s4 | 2 |
| s5 | The guide says how any agent, on a laptop or in the cloud, runs the session and asks the person, and `omni help` describes the ask verbs and `OMNI_HEARTBEAT` | `docs/guide/any-agent.md` `docs/guide/cloud.md` `docs/guide/meta.json` `kit/lib/help/entries` | s2, s3 | 3 |

**Shared ground.** `kit/lib/env/read` and `README.md` are declared by s4 (`OMNI_HEARTBEAT`) and s2
(`OMNI_ASK`): s4 is in wave 1, s2 in wave 2. `kit/lib/help/entries` is declared by s3 (the `session`
command, which the help test needs the day the command exists) and s5 (the ask verbs and the switch):
waves 2 and 3. `scripts/env-docs.test.ts` reads the README for both variables, unchanged by either.
`kit/dist/` and `apps/omni-app/api/` are generated: no slice commits them; the wave rebuilds them.

## Per slice: done when

**s1**
- `kit/lib/ask/round.ts` opens the session, posts the round, waits in calls of at most 50 s up to a
  given total, abandons, and downloads screenshots; `kit/lib/ask/hook.ts`'s `pre`, `post` and `end`
  call it.
- The question shape (`AskUserQuestion`'s input plus optional `lead` and `context`) has one schema in
  `kit/lib/ask/schema.ts`, refusing unknown fields with the field named.
- `kit/bin/ask-hook.test.ts` and `kit/lib/ask/hook.test.ts` pass with no edit to their cases.
- `kit/test/hooks-json.test.ts` asserts `kit/plugin/hooks/hooks.json` holds exactly today's hooks
  and commands.

**s4**
- Two `omni` commands run within a minute with a session id spawn one detached heartbeat child;
  the command's exit code and output are the same with and without it.
- No child under `OMNI_HEARTBEAT=off`, under vitest, without a session id, or from `heartbeat`,
  `ask hook`, `session end` and `statusline`.
- `omni heartbeat` with empty stdin sends under the resolved session id (`OMNI_SESSION_ID`,
  `CLAUDE_CODE_SESSION_ID`, the stored id).
- The README lists `OMNI_HEARTBEAT`; `scripts/env-docs.test.ts` passes.

**s2**
- `omni ask question --file q.json` exits 0 with `{ round, answers, shots }` once answered; 3 with
  empty stdout and one stderr line when the mode is off, no sign-in, unreachable, refused or the
  round abandoned; 4 with `round <id>` when `--wait` runs out; 2 naming the field of a bad file.
- `--wait` defaults to 110 and takes 10 to 540.
- `omni ask wait <round>` resumes to 0, 3 and 4; `omni ask answer <round> --file a.json` posts
  `via: "terminal"` and exits 0 even when the post fails.
- `OMNI_ASK=on` turns the mode on with no `ask.json`; `OMNI_ASK=off` turns it off with one.
- The cloud seam: a temporary checkout with no home folder, no TTY, `OMNI_TOKEN` and `OMNI_ASK=on`
  asks, gets 4, resumes with `ask wait` and gets 0.
- The README lists `OMNI_ASK`; `scripts/env-docs.test.ts` passes.

**s3**
- `omni session start` prints the constituents, then the briefing, then `session: <id>`, for each of
  the four id sources, and stores a generated id only when none of the first three gives one.
- With the Omni page unreachable it still prints the briefing and exits 0.
- `omni session end` closes the session's ask session and sends `ended: true`, and exits 0 when
  both fail.
- `session` is in the commands table and has its `omni help` entry; the help test passes.

**s5**
- `docs/guide/any-agent.md` is listed in `docs/guide/meta.json` and served under `/docs`, with a
  copyable example for `session start`, `ask question`, `ask wait`, `ask answer` and `session end`,
  and what to do on exit 3 and 4.
- `docs/guide/cloud.md` names `OMNI_ASK=on` beside `OMNI_TOKEN`, and allowing the Omni page's host.
- `omni help ask` describes `question`, `wait` and `answer`; the help test passes.
- The full `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.
