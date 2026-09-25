# `kit/bin/github.mjs`

Source: `scripts/outbox-comment.mjs` @ `vertuo-ai-domain@c4a210122` — its `ghClient` export (deleted
from `kit/lib/outbox/comment.mjs` by Task 11 because it shells out to `gh`). `scripts/outbox-replies.mjs`'s
CLI half builds no client of its own: it imports that same `ghClient` and calls it with `issue: pr`, so
there is no second client to port.

## Mapping applied

- `ghClient({ owner, repo, issue, exec })` — body unchanged (same three calls, same `gh api` argv, same
  `--input -` JSON-on-stdin for bodies). One addition: an optional `env`, passed as the `env` option of
  every `exec` call when given.
- New `githubEnv(ctx, { exec, env })`: when `ctx.config.github.user` is set, runs
  `gh auth token --user <user>` once and returns `{ ...env, GH_TOKEN: <token> }`; otherwise `undefined`
  (the ambient `gh` login, upstream's only behaviour). The token only ever travels in `env` — never in
  an argument or a shell string.
- New `githubClientFor(ctx, { repo, issue, exec, env })`: what the commands use. `repo` defaults to
  `ctx.config.repo.slug` (upstream: `DEFAULT_REPO = 'vertuoza/…'`, a literal the mapping removes); the
  token lookup is lazy, so a command that never talks to GitHub never runs `gh auth token`.

## Tests

Upstream had no test of `ghClient` (its callers' tests used fake clients). `kit/bin/github.test.mjs`
is new: a fake `exec` records every call and asserts the argv, the stdin JSON, the PATCH form, the
`env` passthrough, the single token lookup with `GH_TOKEN` in `env` (and never in argv), and the
`--repo` override. No test deleted; no assertion changed.
