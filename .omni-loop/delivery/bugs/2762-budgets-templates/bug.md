# Bug 2762: the budgets check fails in production: the kit's form templates are not in the App's bundle

## Triage

- **Domain:** the Omni GitHub App's `omni / budgets` check (`apps/omni-app/src/budgets-check/`, bundled by `apps/omni-app/build.ts`)
- **Risk:** medium — every pull request of a repository with context budgets on gets no `omni / budgets` result, so a budget that grew goes unchecked; workaround: run `omni check context` in the checkout. (Jev, 0.54)
- **Regression:** new bug — no evidence this ever worked: the App's bundle never defined `__OMNI_TEMPLATES__`; the job ledger (PRD 2688, v0.0.605) made the failure visible, first seen 2026-11-10 17:21 UTC, 11 `pr-budgets` jobs failed with it by 2026-11-12 16:33 UTC

## Reproduction

- **File:** `apps/omni-app/src/vercel-functions.test.ts`
- **Level:** unit
- **Red:** `AssertionError: functions that read the templates from disk: expected [ 'github', 'server-event', …(1) ] to deeply equal []`

## Fix

The budgets check measures each playbook form, the briefing first, through the kit's template loader, which reads `kit/templates/playbook/<form>.md` from beside the bundle unless the build defined `__OMNI_TEMPLATES__`. `kit/build.ts` defines it; `apps/omni-app/build.ts` did not, so on Vercel the loader opened `/var/task/apps/templates/playbook/briefing.md`, which is not shipped. The App's build now defines `__OMNI_TEMPLATES__` from `readTemplates()`, as the kit's build does, and the committed bundles are rebuilt.

## Guard

A test on the committed bundles in `apps/omni-app/src/vercel-functions.test.ts`: no function leaves a kit build constant undefined (no `typeof __OMNI_<NAME>__` left in it), so any kit module that falls back to files beside the bundle (`__OMNI_TEMPLATES__` today, `__OMNI_SKILLS__` or `__OMNI_PITCH_ENGINE__` if the App ever bundles them) fails before it ships. It fails on `main`'s bundles (`typeof __OMNI_TEMPLATES__` in three functions) and passes on this branch.

## Mutation

mutation: no changed core file against origin/main (13e9767f): nothing to mutate
