# Plan: Roomier questions list

PRD #533, spec in `spec.md` beside this plan. The feature branch `feat/roomier-questions` merges
into `main` with "Closes #533"; each slice's sub-PR, from `feat/roomier-questions--<slice>`, merges
into the feature branch with "Part of #533".

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The Questions tab breathes: roomier round lines and bodies, taller answer lines, 20px under the answered strip, phone view unchanged | `apps/galaxy/src/dossier/page/dossier.css` `apps/galaxy/src/dossier/page/questions-style.test.ts` | — | 1 |

No shared ground: one slice.

## Per slice: done when

**s1**

- `apps/galaxy/src/dossier/page/questions-style.test.ts` reads `dossier.css` as text and checks:
  - `.dossier-progress` has `margin-bottom: 4px`, so the strip sits 20px above the list.
  - `.dossier-round-line` has `padding: 16px 24px`.
  - `.dossier-round[data-state='open'] .dossier-round-line` has `padding-left: 46px`.
  - `.dossier-round-body` has `gap: 16px` and `padding: 4px 24px 22px 52px`.
  - `.dossier-q-line` has `line-height: 1.6`.
  - `.dossier-round-foot` has `padding-top: 4px`.
- Under `@media (max-width: 719.98px)`, the line keeps `padding: 10px 12px`, the body keeps
  `padding: 4px 12px 12px`, and the open round's line keeps `padding-left: 12px`.
- `render.test.ts` and `page.test.ts` pass unchanged, and `pnpm test` is green.
- A browser pass on a PRD's Questions tab, at desktop and phone widths: an open round's dot sits in
  the same column as the ✓ marks, and the answer text starts under the round's title.
