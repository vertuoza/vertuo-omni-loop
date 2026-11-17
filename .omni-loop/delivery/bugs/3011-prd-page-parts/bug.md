# Bug 3011: the PRD page rebuilt in omni-loop-10 lost client tabs, clips the facts strip, and left old buttons

## Triage

- **Domain:** the PRD page (`/prd/<id>`, `apps/galaxy/src/dossier/page/`) and its parts in `@omni/ui` (`packages/ui/`)
- **Risk:** medium — everyone reading a PRD page: tabs reload the whole page, the facts strip cuts its first labels, GitHub replaces the page; every action still works, so each has a workaround (Jev, 0.88)
- **Regression:** yes — #2987 (f3407cf2e): the tabs left `next/link` for `@omni/ui` Tabs, `dossier.css` reads five `--dossier-*` properties nothing declares, the stage link lost `target="_blank"`, the PR care chip and Build it lost their titles, and Pitch, Send to terminal and the Ready panel kept `ask-button`

## Reproduction

- **File:** `apps/galaxy/src/dossier/page/prd-page-parts.test.ts`
- **Level:** unit
- **Red:** `Tests  5 failed (5)` — `expected '<a class="omni-tab" href="/prd/000000…' to contain 'data-next-link'`; `expected [ '--dossier-top-pull', …(4) ] to deeply equal []`; `expected '<a class="omni-button omni-button--pr…' to contain 'target="_blank"'`; `expected '<div class="dossier"><header class="d…' to match /<span class="omni-badge[^"]*" title="PR care">CI ✓/`; `expected '<span class="pitch-action"><button ty…' not to contain 'ask-button'`

## Fix

`@omni/ui` Tabs takes the link it draws each tab with, and the PRD page hands it `next/link`, so a tab switches in the app again. `dossier.css` declares the five `--dossier-*` properties it reads on `.dossier`, the facts strip pulled left by exactly what its clip cuts. Button gains `external`, `title` and `expanded` and marks a primary with `data-primary`; Badge gains `title`. With them the stage link opens GitHub in a new window, the PR care chip and every copy button keep their titles, and Pitch, its Copy, Send to terminal, Send and the Ready panel's action are `@omni/ui` Buttons. `ask.css`'s link colour now leaves an `@omni/ui` Button drawn as a link alone, so a primary link (Answer the outbox, Review & merge, Review PR) is no longer cyan on its accent, the job `.ask a.ask-button` did for the old buttons.

## Guard

The reproduction's link-colour case fails whenever a colour rule of `.ask a` reaches an `@omni/ui` Button. The reproduction's stylesheet case fails whenever `dossier.css` reads a `--dossier-*` property it does not declare, and PRD 2401's source check in `history-render.test.ts`, which #2987 loosened to let plain tab links through, again requires `next/link` for the PRD tabs.

## Mutation

mutation: no changed core file against origin/main (8a049c59): nothing to mutate
