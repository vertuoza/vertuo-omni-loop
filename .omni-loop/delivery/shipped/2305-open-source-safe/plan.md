# Plan: The code base is safe to be open source

PRD #2305, specified in `spec.md` beside this plan. The feature branch `feat/open-source-safe` merges
into `main` through the feature PR; each slice's sub-PR, from `feat/open-source-safe--<slice>`, merges
into the feature branch. `kit/dist/` and `apps/omni-app/api/` are generated: no slice commits them,
and the wave rebuilds them once after merging. The wave starts only once PR #2304 has merged into
`main` and the feature branch has met it.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The guard: `scripts/open-source.ts`, its test, the allowlist and one baseline file per area under `scripts/open-source.baseline/`, run by the pre-push hook and in CI; the `gitleaks` job of the `security` workflow with `.gitleaks.toml`; the offending files under `scripts/` cleaned | `scripts/` `.githooks/` `.github/workflows/` `.gitleaks.toml` | — | 1 | deep |
| s2 | The arcade's code and tests use the fictional names; its baseline file is deleted | `apps/galaxy/` `scripts/open-source.baseline/galaxy.json` | s1 | 2 | build |
| s3 | The GitHub App's code and tests use the fictional names; its baseline file is deleted | `apps/omni-app/` `scripts/open-source.baseline/omni-app.json` | s1 | 2 | build |
| s4 | The kit's code, tests, templates and porting notes use the fictional names; its baseline file is deleted | `kit/` `scripts/open-source.baseline/kit.json` | s1 | 2 | build |
| s5 | The shared packages and the game use the fictional names; their baseline file is deleted | `packages/` `game/` `scripts/open-source.baseline/packages.json` | s1 | 2 | build |
| s6 | A fresh install creates no maintainer workspace: the old migrations edited in place, the seed's own `demo-org` workspace, the checks with their own fixtures, `config.toml`; its baseline file is deleted | `supabase/` `scripts/open-source.baseline/supabase.json` | s1 | 2 | deep |
| s7 | The loop's history and the root use the fictional names: `.omni-loop/delivery`, `.omni-loop/knowledge`, `docs/`, `README.md`, `fallow/`, `.fallowrc.jsonc`, and the root package named `omni-loop`; its baseline file is deleted | `.omni-loop/delivery/` `.omni-loop/knowledge/` `docs/` `README.md` `fallow/` `.fallowrc.jsonc` `package.json` `scripts/open-source.baseline/history.json` | s1 | 2 | build |
| s8 | The baseline is gone: the guard holds with no exception, and its support for a baseline is removed | `scripts/open-source` | s2, s3, s4, s5, s6, s7 | 3 | light |

**Shared ground.** `scripts/` is s1's whole; each wave-2 slice owns one file of
`scripts/open-source.baseline/`, so no two wave-2 slices share ground, and s1 is done before any of
them starts. s8 owns `scripts/open-source*` after every cleanup merged. A test in one area that reads
a fixture of another (an arcade test reading `supabase/seed.sql`, a kit test reading an
`.omni-loop/` file) is renamed by the slice that owns the test, to whatever the owning slice of the
fixture writes; the wave's check (`pnpm test` on the merged feature branch) catches a mismatch.
`pnpm-lock.yaml` is never hand-edited: if renaming the root package changes it, s7 regenerates it
with `pnpm install`. `kit/dist/` and `apps/omni-app/api/` are generated and listed nowhere.

## Per slice: done when

### s1 (deep: the guard's rules, its ratchet and a CI secret scan)

- `node scripts/open-source.ts` flags, with `<file>:<line>: <rule> — <fix>` and exit 1: the
  maintainer's organisation followed by a repository other than this one; a name with the
  maintainer's `vertuo-` prefix other than this repository's and its Vercel host; an address on the
  maintainer's domain; GitHub tokens, `sk-…` keys, private-key blocks, `sb_secret_…`, AWS keys, JWTs
  other than the jwt.io sample, Postgres URLs whose password is not the local default. It never
  prints a secret's value.
- It skips `kit/dist/`, `apps/omni-app/api/` and the lockfile, honours
  `scripts/open-source.allow.json` (each entry a file, a pattern and its reason), and does not judge a
  file listed in `scripts/open-source.baseline/<area>.json`; a listed file that is now clean fails
  with `remove <file> from the baseline`.
- The baseline lists today's offending files, one JSON file per area: `galaxy`, `omni-app`, `kit`,
  `packages`, `supabase`, `history`. The offending files under `scripts/` are cleaned here, not
  listed.
- Its test proves each rule red and green on fixtures built at runtime, the allowlist's reason
  required, the shrink-only baseline, and this repository's own names passing; the test file itself
  passes the guard.
- The pre-push hook and the CI workflow run it; `.github/workflows/security.yml` gains a `gitleaks`
  job running a pinned gitleaks binary, SHA-256 checked, on the pull request's commits, with
  `.gitleaks.toml` allowing the visible fakes; it is green on the sub-PR.

### s2, s3, s4, s5

- Every offence in the slice's territory is renamed by the spec's rule (`demo-org/<new>`,
  `nimbus-<rest>` with PR #2304's choices winning, `<name>@example.com`), each fixture with the
  assertions that read it; the slice's baseline file is deleted.
- `node scripts/open-source.ts` passes with that file gone, and the full `pnpm test` is green.

### s6 (deep: migrations a fresh install runs, checks CI runs)

- The old migrations no longer insert the maintainer's workspace or give it repositories or
  sectors; their comments and messages name no maintainer domain; nothing else in them changes.
- `supabase/seed.sql` creates the `demo-org` workspace the demo galaxy lives in, and every
  `supabase/checks/` file that relied on the maintainer's workspace builds its own fixture.
- `supabase db reset` then every check passes locally and in the `supabase` workflow; the baseline
  file is deleted and the guard passes.

### s7

- The loop's history, `docs/`, `README.md`, `fallow/` and `.fallowrc.jsonc` use the fictional
  names; the root `package.json` is named `omni-loop` and every script or filter that named the old
  package follows; the baseline file is deleted, the guard and the full `pnpm test` pass.

### s8 (light: removing an emptied mechanism)

- `scripts/open-source.baseline/` is gone, the guard reads no baseline, its test no longer covers
  one, and `node scripts/open-source.ts` exits 0 on the feature branch.
