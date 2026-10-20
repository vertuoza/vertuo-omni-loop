# Plan: A concept reads as shipped

PRD #2213, spec in `spec.md` beside this plan. The feature branch `feat/concept-shipped` goes into
`main` with `Closes #2213`; each slice is a sub-PR from `feat/concept-shipped--<slice>` into the
feature branch, with `Part of #2213`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A concept reads shipped by itself once every area's PRD is shipped or retro; the Areas tab shows each PRD's stage; the Concepts list card shows its shipped count | `apps/galaxy/src/concepts/` `apps/galaxy/app/concepts/` `apps/galaxy/src/dossier/page/dossier.css` | — | 1 | build |
| s2 | A merged concept's issue stays current: the sync re-reads it, and an `issues` event refreshes it at once | `apps/galaxy/src/fixes/facts/` `apps/galaxy/src/touched/` `apps/galaxy/src/dossier/github/fix.ts` `apps/galaxy/src/dossier/github/fix.test.ts` `apps/galaxy/src/stages/sync/` | — | 1 | build |
| s3 | A workspace member marks a concept done, or reopens it, on its page or on GitHub; a concept shipped by a person shows `not built` on its areas without a shipped PRD | `apps/galaxy/src/concepts/` `apps/galaxy/app/api/concepts/` `apps/galaxy/src/dossier/page/dossier.css` | s1 | 2 | build |

**Shared ground.** `apps/galaxy/src/concepts/` and `apps/galaxy/src/dossier/page/dossier.css` are
declared by s1 and s3: s3 is blocked by s1 and runs in wave 2, so they never merge side by side.
s2 owns the facts reading and refreshing alone; s3 reads the issue's state those facts already hold
(`issue.state`), so it needs nothing of s2's to be built and tested.

`apps/galaxy/src/concepts/state.test.ts` and `apps/galaxy/src/concepts/list.test.ts` prove
BR-PRODUCT-93 (not locked): s1 and s3 change them, keep that rule true, and raise the item a change
to a rule's proof asks for.

## Per slice: done when

### s1 (`ui: yes`)

- `conceptState` takes the concept's facts, its areas and its PRDs' stored stages, and reads
  `shipped` when the concept PR merged, every area names a PRD and each one's stage is `shipped` or
  `retro`; `in the inbox` otherwise once merged; `in review` and `state unknown` as today
  (BR-PRODUCT-93), each case a unit test.
- The stages come from `StageStore.currentStages`, one read for the workspace per page or list, never
  from GitHub.
- The chip reads `shipped` with a `.fix-state-shipped` class, in `--ask-green` with `--ask-on-plasma`
  text, on the concept page's header and on each Concepts list card.
- The Areas tab shows each named PRD's stage beside its link in `STAGE_LABELS`' words, `syncing`
  when none is stored; a shipped concept offers no brainstorm line.
- The list card's facts are short pieces: `<m> of <n> have a PRD` · `<k> of <n> shipped` · its date,
  and the render test reads them.
- The `concept-page` and `concept-list` draft screens' mockups match what is built.

### s2

- `isConceptFinal` no longer ends a merged concept's refresh: each sync run reads a merged concept's
  issue again (one read; its concept PR is not read again) and stores its state, its stored PR kept.
- A close and a reopen of a concept's issue are each stored by the next run (refresh tests with a
  fake reader).
- The touched route (`apps/galaxy/src/touched/touched.ts`), given an `issues` event for an issue that
  is a concept's, refreshes that concept's stored facts at once; for any other issue it does what it
  does today (tests with fakes).
- No GitHub call in any test.

### s3 (`ui: yes`)

- `conceptState` reads `shipped` for a merged concept whose stored issue is `closed`, whatever its
  areas; a concept in review never reads `shipped`, whatever its issue (unit tests).
- `POST /api/concepts/done` with `{ concept, done: true }` closes the concept's issue as completed
  through the Omni app's installation token, with the comment `Marked done on the Omni page by
  @<login>.`, then stores the concept's facts; `done: false` reopens it with `Reopened on the Omni
  page by @<login>.` Route tests against a fake GitHub check each call and its body.
- The caller is checked as themselves, never with a service key: signed out is 401, not a member of
  the concept's workspace is 403, and the issue is unchanged.
- A failed GitHub call answers an error, changes no stored state, and the page says so in one line.
- `MarkDoneButton` shows **Mark done** on a concept in the inbox that is not shipped, **Reopen** on a
  concept shipped by a person, and nothing on one shipped by itself or in review; after a press the
  page refreshes.
- On a concept shipped by a person, each area without a shipped PRD reads `not built`.
- The token never reaches the browser (N-PRODUCT-17).
