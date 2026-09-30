# Bug 782: the play dock never shows on a PRD page while its GitHub summary is pending

## Triage

- **Domain:** galaxy, the dossier page (`apps/galaxy/src/dossier/page/stream/DossierStream.tsx`) — where the change check and the play dock are mounted on a numbered PRD's streamed page
- **Risk:** medium — whoever opens a PRD's page while Claude works on it gets no play dock, and the page's own live poll (new versions, new questions) never starts, for as long as GitHub's summary is pending; workaround: the same session's tab on /ask shows the dock, and reloading the page picks up new work
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/dossier/page/stream/render.test.ts`
- **Red:** AssertionError: expected '<main><!--$?--><template id="B:0"></t…' to contain 'data-live'

## Fix

A numbered PRD's page streams, and the change check (LiveRefresh), which carries both the play dock and the page's live poll, was mounted only inside the complete page, the part that waits for the GitHub summary; a summary that never arrived meant no dock and no live poll. The change check now sits beside the streamed page in its own Suspense boundary, started from the database's read, and stays mounted when the complete page replaces the pending one; its watch already keeps only new work, so it needs no GitHub part.

## Guard

A render test of the streamed page with a GitHub summary that never answers: the page sent must carry the change check. It fails on the default branch's DossierStream and passes on the fix.

## Mutation

not set here
