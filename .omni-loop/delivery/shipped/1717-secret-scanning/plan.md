# Plan: secret scanning and push protection, switched on and kept on

PRD #1717. The spec is `spec.md` beside this plan. The feature branch `feat/secret-scanning` merges
into `main` through one feature PR (`Closes #1717`); each slice is a sub-PR from
`feat/secret-scanning--<slice>` into the feature branch (`Part of #1717`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Fake secrets are built at runtime, and a guard refuses any literal credential shape in a tracked file | `scripts/secret-shapes-guard.test.ts` `apps/galaxy/src/jev/client.test.ts` `apps/galaxy/src/jev/mask.test.ts` `apps/galaxy/src/loop/github.test.ts` `apps/galaxy/src/outbox/send.fake.ts` `apps/omni-app/src/env.test.ts` `apps/omni-app/src/retro/narrate.test.ts` `kit/lib/openrouter.test.ts` | — | 1 |
| s2 | `node scripts/security-settings.ts` reads both settings and the open alerts, naming each fix; `--apply` switches both on | `scripts/security-settings*` | — | 1 |
| s3 | The daily `security` workflow runs the script with `SECURITY_READ_TOKEN`, opens or updates one `omni:security` issue on red, and closes it on green | `.github/workflows/security.yml` `scripts/security-workflow.test.ts` | s2 | 2 |
| s4 | Both settings are switched on, every alert GitHub raises is triaged, and the briefing says never to bypass push protection | `.omni-loop/knowledge/playbook/briefing.md` | s1, s3 | 3 |

Shared ground: none. Each slice owns its own files. `kit/dist/` and `apps/omni-app/api/` are built
from s1's sources but are generated, so no slice lists them; the wave rebuilds them once. s4 changes
the repository's settings on GitHub, which no other slice touches, and runs only once s1 (the
fixtures and the guard) and s3 (the watch) are merged into the feature branch, as the spec's
**Fixtures first, settings last** decision requires.

## Per slice: done when

**s1** (`ui: yes`)
- `scripts/secret-shapes-guard.test.ts` reads every file `git ls-files` lists, except
  `pnpm-lock.yaml`, `kit/dist/` and `apps/omni-app/api/`, and fails naming the file, the line and
  the shape for a literal GitHub token (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`),
  Anthropic key, AWS access key id, Supabase secret key, Slack token, `whsec_` secret or PEM private
  key block.
- Its own cases: each shape with its body is caught; a bare prefix, a regular expression (as in
  `apps/galaxy/src/jev/mask.ts`) and a shape assembled with `+` are not.
- It fails on `origin/main` (the seven files hold literals) and passes on the slice.
- The seven files build every fake at runtime; each test asserts the same values as before, and
  passes.
- The guard's matcher is proven: removing one shape from it lets a planted literal of that shape
  through, turning its case red.

**s2**
- `scripts/security-settings.ts` with no flag, against a fake `gh` on `PATH`, exits 0 when both
  settings are `enabled` and no alert is open.
- It exits 1 and prints `→ node scripts/security-settings.ts --apply` for each setting not
  `enabled`, and each open alert's number, secret type and link.
- When the alerts call answers 404 because scanning is disabled, it exits 1 naming the setting, and
  does not crash.
- `--apply` sends exactly one `PATCH` of `security_and_analysis` with both settings `enabled`, then
  reads back and exits as above.
- The repository is `repo.slug` from `.omni-loop/config.yml`, or `--repo <owner/name>`.
- The tests never call GitHub.

**s3**
- `.github/workflows/security.yml` runs on a daily `schedule` and on `workflow_dispatch`, and its
  job runs only when `SECURITY_READ_TOKEN` is set.
- It runs `node scripts/security-settings.ts` with `GH_TOKEN` from `SECURITY_READ_TOKEN`; its
  permissions are `contents: read` and `issues: write`, nothing else.
- On red it opens one issue labelled `omni:security`, titled `Security settings: <what is wrong>`,
  with the script's output, or comments on the open one; on green it closes the open one with a
  comment.
- Its header comment names the token's two scopes, where to create it, and that the admin creates
  the `omni:security` label.
- `scripts/security-workflow.test.ts` reads the YAML and checks each point above, as
  `scripts/checks-workflow.test.ts` does.

**s4**
- `node scripts/security-settings.ts --apply` has run with an admin's `gh`, and reading back prints
  `secret_scanning: enabled` and `secret_scanning_push_protection: enabled` for
  `vertuoza/vertuo-omni-loop`.
- Every alert GitHub raised is closed: real ones rotated first, then closed `revoked`; fakes closed
  `used_in_tests`. The sub-PR lists each alert, its type, its file and how it was closed.
- The label `omni:security` exists.
- `.omni-loop/knowledge/playbook/briefing.md`'s `Never [repo]` section holds: *Never bypass push
  protection. A blocked push names a secret: rotate it if it is real, build it at runtime if it is
  a fixture.* `omni kb show briefing` prints it.
- Once a person sets `SECURITY_READ_TOKEN`, a `workflow_dispatch` run of `security` is green; until
  then the sub-PR says the secret is not set yet and the run was not proven.
