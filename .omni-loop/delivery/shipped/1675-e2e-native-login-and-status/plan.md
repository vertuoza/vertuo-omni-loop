# Plan: validate-e2e follows the native login and accepts a test with no agent step

PRD #1675, the spec beside this plan. The feature branch `feat/e2e-native-login-and-status` goes into `main` with `Closes #1675`; each slice is a sub-PR from `feat/e2e-native-login-and-status--<slice>` into the feature branch with `Part of #1675`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni e2e status` tells a test with no `agent.` call (no recording expected) from one that lost its recording, with its tests and its help text | `kit/lib/e2e/status.ts` `kit/lib/e2e/status.test.ts` `kit/lib/e2e/recording.ts` `kit/bin/commands/e2e.ts` `kit/bin/commands/e2e.test.ts` `kit/lib/help/entries.ts` `kit/lib/help/entries.test.ts` | — | 1 |
| s2 | The skill's login step and the guide describe the native login and the skill generates a setup when none exists; the guard's message stops presenting `storage-state.json` as the normal path | `kit/plugin/skills/validate-e2e/` `docs/guide/validate-e2e.md` `kit/lib/e2e/guard.ts` `kit/lib/e2e/guard.test.ts` `kit/bin/commands/e2e-guard.test.ts` | — | 1 |

The two slices share no path: s1 owns the status code, its command wiring and the help entries; s2 owns the skill, the guide and the guard. Both rebuild generated files (`kit/dist/omni.mjs`) to test, and the wave rebuilds them once.

## Per slice: done when

- **s1**
  - `omni e2e status` exits 0 for a `prd-<n>` test whose file has no `agent.` call and no recording, and its JSON says no recording is expected for it.
  - It exits non-zero for a `prd-<n>` test whose file has an `agent.act` or `agent.assert` and no recording.
  - The JSON keeps `recording` as a boolean and adds `expected`.
  - `status.test.ts` covers a test with a recording, a test with an agent step and none, and a test with no agent step; the help text says what the command now reports.
- **s2**
  - The skill's login step names `credentials`, a `test.setup` and `session.save`, and says generated tests declare `{ session: '<name>' }`.
  - With no setup in `e2e.dir`, the skill writes one that reads the account from environment variables and puts no value in a file, then runs `omni e2e guard`, which stays green on it.
  - `e2e.setup` is described as the secondary path, marked not verified.
  - The guide's login section describes the native path first; the guard's message and its tests agree with it.
