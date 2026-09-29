# Fallow baselines

Generated audit output. Do not hand-edit.

`.fallowrc.jsonc` points `audit.deadCodeBaseline`, `audit.dupesBaseline` and
`audit.healthBaseline` at these files. `pnpm fallow:audit` grades the files a change touches
against them, so it reports only the findings the change introduces, not the ones already on
`main`.

| File | Holds |
| --- | --- |
| `dead-code.json` | Unused exports and types, duplicate exports, dependency findings, import cycles |
| `dupes.json` | Copy-paste and structural duplication |
| `health.json` | Complexity and maintainability findings |

## Regenerate

From the repository root:

```sh
pnpm exec fallow dead-code --save-baseline ./fallow/dead-code.json
pnpm exec fallow dupes     --save-baseline ./fallow/dupes.json
pnpm exec fallow health    --save-baseline ./fallow/health.json
```

## When

Only after a pull request clears findings: deleting dead code, breaking a cycle, splitting a
function that was too complex. The regenerated baseline then records the smaller set, so the
cleared findings cannot come back unnoticed. Regenerate in the same pull request that clears them.

Never regenerate a baseline to turn a red audit green. A red audit names a finding the change
introduced: fix it. When the finding is false (fallow cannot see a caller, such as a file run by
path), add an `entry` or `ignore*` line to `.fallowrc.jsonc` with a comment saying why.

## Why `typeAware` is off

Do not pass `--type-aware` to the commands above, and leave `typeAware.enabled` false in
`.fallowrc.jsonc`. A type-aware baseline records an `analysis_identity.completeness` that
describes the run, not the config: the same commit reports `complete` on one machine and
`partial` on another, and `fallow audit` then fails with exit 2 whatever the baseline holds
(vertuoza/vnext hit this and runs syntactic baselines for the same reason). The optional
`fallow-type-aware` package is not installed here (`pnpm.ignoredOptionalDependencies` in the root
`package.json`).

## Measure with `--no-cache`

Fallow caches the module graph, and a run right after a refactor can read the old one. Pass
`--no-cache` when you check your own work:

```sh
pnpm exec fallow dead-code --no-cache
```
