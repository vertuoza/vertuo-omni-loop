# Plan: The PRD page is easier to use

PRD #384, spec beside this plan (`spec.md`). The feature branch `feat/prd-page-usability` merges
into `main` with `Closes #384`; each slice is a sub-PR from `feat/prd-page-usability--<slice>` into
the feature branch, with `Part of #384`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The tabs read Questions · Before/after · Spec · Plan, and the page opens on Questions, or on Before/after when there is no question | `apps/galaxy/src/dossier/page/view.ts` `apps/galaxy/src/dossier/page/view.test.ts` `apps/galaxy/src/dossier/page/render.test.ts` | — | 1 |
| s5 | The page refreshes itself: a small change check every 2 s while visible, and an in-place re-render only when something changed | `apps/galaxy/src/dossier/page/DossierPage.tsx` `apps/galaxy/src/dossier/page/live` `apps/galaxy/src/dossier/page/source.ts` `apps/galaxy/src/dossier/page/source.test.ts` `apps/galaxy/src/dossier/store.ts` `apps/galaxy/src/dossier/store.test.ts` `apps/galaxy/src/dossier/store.fake.ts` `apps/galaxy/app/prd/[id]/page.tsx` `apps/galaxy/src/dossier/page/page.test.ts` | — | 1 |
| s2 | An answered question shows only its chosen option or options, or the text given; a moved question shows no option | `apps/galaxy/src/dossier/page/view.ts` `apps/galaxy/src/dossier/page/view.test.ts` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/QuestionsPane.tsx` `apps/galaxy/src/dossier/page/dossier.css` | s1 | 2 |
| s3 | Answering on the question page brings you back where you came from: the PRD's Questions tab at the next open round, or the session's ask page | `apps/galaxy/src/dossier/page/view.ts` `apps/galaxy/src/dossier/page/view.test.ts` `apps/galaxy/src/ask/page/AskQuestion.tsx` `apps/galaxy/src/ask/page/back` `apps/galaxy/app/ask/q/` | s2 | 3 |
| s4 | A quick open round is answered with one click on the list, by whoever may answer it, decided on the server | `apps/galaxy/src/dossier/page/view.ts` `apps/galaxy/src/dossier/page/view.test.ts` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/QuestionsPane.tsx` `apps/galaxy/src/dossier/page/QuickAnswer` `apps/galaxy/src/dossier/page/dossier.css` `apps/galaxy/src/dossier/page/source.ts` `apps/galaxy/src/dossier/page/source.test.ts` `apps/galaxy/src/dossier/store.ts` `apps/galaxy/src/dossier/store.test.ts` `apps/galaxy/src/dossier/store.fake.ts` `apps/galaxy/app/prd/[id]/page.tsx` `apps/galaxy/src/dossier/page/page.test.ts` | s3, s5 | 4 |

**Shared ground.** `view.ts`, `view.test.ts` and `render.test.ts` are declared by s1, s2, s3 and s4,
one per wave (1, 2, 3, 4). `QuestionsPane.tsx` and `dossier.css` are declared by s2 (wave 2) and s4
(wave 4). `source.ts`, `source.test.ts`, `store.ts`, `store.test.ts`, `store.fake.ts`,
`app/prd/[id]/page.tsx` and `page.test.ts` are declared by s5 (wave 1) and s4 (wave 4). The new
files each slice creates start with a prefix only that slice names: `live` (s5), `back` under
`src/ask/page/` (s3), `QuickAnswer` (s4).

## Per slice: done when

**s1: tab order**
- The tab bar renders Questions, Before/after, Spec, Plan, in that order, with their badges.
- With at least one round and no `?tab=`, the Questions tab is current and its link has no `tab`
  parameter; with no round, Before/after is current and its link has none.
- `?tab=before-after`, `?tab=spec`, `?tab=plan` and `?tab=questions` each select the tab they name;
  an unknown value falls back to the default.

**s5: auto-refresh**
- A pure `signature` of the dossier (round count, answered count, latest version of each artifact)
  differs when a round is added, a round is answered or a version is added, and is equal otherwise.
- The store reads that signature in one small call, from the browser, under the same access rule as
  the page; tested against the fake Supabase.
- A client component on `/prd/<id>` checks it every 2 s through `poll.ts` while the tab is visible,
  and calls `router.refresh()` only when it changed; it does not run in demo mode.
- Three failed reads in a row show "Cannot reach the server. Trying again every few seconds." until
  one works; a single failure shows nothing.
- A `?v=` picked by hand survives the refresh (the URL is untouched).

**s2: answered shows the answer**
- An answered round's markup holds its chosen option label and description, and none of the
  unchosen option labels.
- A multi-select answer shows each chosen option; an answer matching no option shows as its text.
- An open round shows every option; an abandoned round shows the question and "moved to the terminal,
  no answer recorded", with no option list.

**s3: back to where you came from**
- The Questions tab links each round to `/ask/q/<round>?from=<dossier id>`.
- A pure function gives the way back: `/prd/<dossier id>?tab=questions#<next open round>` when
  `from` is a dossier id and a round is still open, `?tab=questions` alone when none is, and
  `/ask/<session id>` when `from` is missing or not a dossier id.
- After a send that the next read says is answered by this person, `AskQuestion` navigates to that
  target; "Already answered by …" does not navigate.

**s4: answer on the list**
- A pure `isQuick(round)` is true only for an open round with one question, single choice, no option
  preview, and time left before it moves to the terminal.
- The page's server read decides, per round, whether the signed-in person may answer (the session's
  owner or a member it is shared with), from the session and its shares; tested with the fake.
- For such a person, a quick round renders one button per option; for anyone else it renders
  "Waiting for <owner>"; a round that is not quick renders only its Open link.
- Clicking a button sends that option through `sendAnswers` with `answered_via: 'page'`; the round
  then renders as answered (s2) without a reload and the page scrolls to the next open round.
- "Already answered by …" shows when someone came first; a failed send shows "Your answer did not go
  through" and keeps the buttons.
- With no script, a quick round shows its Open link.
