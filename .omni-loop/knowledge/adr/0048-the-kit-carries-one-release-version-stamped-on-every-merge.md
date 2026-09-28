# ADR-0048 — The kit carries one release version, stamped on every merge to `main`

**Status:** accepted · **Date:** 2026-09-28 · **PRD:** #347 · **Decided:** @pierrederval via PRD #347's
design, 2026-09-28

## Context

Until PRD 347 the kit had no version: no tag, no GitHub Release, no `version` in `package.json`, and a
`plugin.json` that said `0.1.0` forever. A merge to `main` was the release, and nothing could say which
kit a repository ran, whether it was behind, or bring it forward. Claude Code decides whether a plugin
has an update by its `version`, so the skills on a machine never updated either.

The knowledge forms already carry a version of their own: each form's `form-version`, read from the
kit's own template for that form, with no kit-wide number (ADR-0020).

## Decision

1. **One number, stamped everywhere.** `package.json`'s `version`, `kit/plugin/.claude-plugin/plugin.json`'s
   `version`, the bundle `kit/dist/omni.mjs`, the git tag and the GitHub Release all say the same
   `0.0.N`. The marketplace entry carries no version of its own.
2. **Every merge to `main` cuts one,** whatever it touched. After every push to `main`, the `release`
   workflow (`.github/workflows/release.yml`) runs `kit/release/release.mjs`, which takes the highest
   `v0.0.<n>` tag plus one (`v0.0.1` with none; a tag of any other shape is ignored), stamps it, runs
   the build, commits `chore(release): v0.0.N` signed with the Omni signature's trailer, tags it,
   pushes both and publishes the GitHub Release with the bundle attached and generated notes.
3. **Patch numbers only.** No major or minor bump is computed from commit titles.
4. **The release commit is the one push to `main` a person does not make.** The briefing's Never
   section says so. A push whose head is a release commit cuts nothing, and runs never overlap: one
   `release` concurrency group that never cancels a queued run. When `main` moves during a run, the
   script rebases onto it once and pushes again; a second failure leaves the run red with nothing
   tagged, and the next merge takes the next number.
5. **ADR-0020 stands.** Each knowledge form keeps its own `form-version`; the release version says
   which kit runs, not which shape a form has.

## Consequences

- `main` takes one more commit after every merge. Branches behind it take that commit when they
  update; a branch that also rebuilt the bundle can conflict on it, and `pnpm kit:build` after the
  merge settles it.
- The workflow pushes to `main` with the workflow's own token. It works while `main` has no branch
  protection; protection added later needs a bypass for this push (the Omni-man GitHub App's token is
  the candidate), or every release fails red on `main`.
- Rolling back is reverting PRD 347's merge: the workflow goes and the kit has no version again.
  Published tags and releases can stay; nothing depends on removing them.
