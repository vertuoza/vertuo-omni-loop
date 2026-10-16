---
screen: questions
status: draft
kind: page
mock: questions.html
implements: ["apps/galaxy/app/ask/(shell)/page.tsx", "apps/galaxy/app/ask/(shell)/for-me/page.tsx", "apps/galaxy/app/ask/(shell)/history/page.tsx"]
reads: [apps/galaxy/src/ask/page/AskRoute.tsx, apps/galaxy/src/outbox-items/outbox-items.repository.ts, apps/galaxy/src/nav/sidebar.ts]
routes: [/ask, /ask/for-me, /ask/history]
supersedes: null
---

## Purpose

Work › Questions: every question waiting on a person, across every product, in one place. The Inbox
tab holds the ask-mode questions put to the viewer; the Outbox tab holds every open outbox item of
the workspace, the decisions agents took alone (PRD 2011).

## Regions

- The title, then the tabs: Inbox with its count, Outbox with its count, History.
- On Outbox, the product filter (All products, each product, No product), as the Work lists have it.
- The rows: the item's question, a chip saying who it waits on (`waits on you` first), and a line with
  its product, its PRD id and its rank.
- The one primary action: Answer.

## States

- Outbox empty: no open decision in the workspace.
- Signed out: the sign-in card of the reading pages.

## Words

`Inbox`, `Outbox`, `History`, `waits on you`, `waits on <name>`, `Answer`.

## Refusals

- Answering needs a person's sign-in; a terminal token never marks an answer as given (BR-PRODUCT-94).
- An answer, once given, never changes (BR-PRODUCT-12).

## Open questions

- Whether Inbox keeps the route `/ask` and Outbox gets its own route, or both are `?tab=`.
- The words of the empty Outbox.

## Source

/omni:brainstorm, PRD 2011: .omni-loop/delivery/inbox/2011-product-records/before-after.html
