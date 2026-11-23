# Bug 3167: the Inbox's Done tab shows its filters unstyled

## Triage

- **Domain:** ask (the Inbox's Done tab)
- **Risk:** low — every member reading their answered questions sees an unstyled, stacked filter form; filtering still works, through a redirect
- **Regression:** yes — PRD omni-loop-22 moved History under `/app/inbox/done` (#3157, merged in #3152), and the `/app` layout does not import `history.css` and `share.css`

## Reproduction

- **File:** `apps/galaxy/src/inbox/done-tab.test.ts`
- **Level:** unit
- **Red:** `AssertionError: history.css: expected 'import type { Metadata, Viewport } fr…' to match /import\s+['"][^'"]*ask\/page\/hi…/` and `AssertionError: expected '<div class="ask-col"><h1 class="ask-s…' to contain 'action="/app/inbox/done"'`

## Fix

The Done tab draws the Questions history's form (`WorkspaceHistory.tsx`), whose styles only the `/ask` layout imported. The form now imports `history.css` and `share.css` itself, and its form and Clear link point at `/app/inbox/done` instead of `/ask/history`.

## Guard

The reproduction: it reads the Done tab's import chain, from the `/app` layout to the form, and fails when the form's stylesheets are not loaded, or when the form leaves the Done tab.

## Mutation

not set here — `pnpm mutation:changed` mutates the delivery core only, and this fix touches none of it

## Still open

- The Done tab is still the old History page under the Inbox header (17 px cards, six labelled selects, a Filter button); a one-row filter bar and the Open tab's rows are the follow-up visual update.
