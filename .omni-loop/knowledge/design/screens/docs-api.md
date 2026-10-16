---
screen: docs-api
status: draft
kind: page
mock: docs-api.html
implements: [apps/galaxy/app/docs/api/page.tsx, apps/galaxy/src/docs/ApiReference.tsx, docs/guide/api.md, apps/galaxy/src/public-api/openapi.ts]
reads: [apps/galaxy/src/docs/docs.css, apps/galaxy/src/docs/GuideRoute.tsx, apps/galaxy/src/docs/DocsPage.tsx, apps/galaxy/app/docs/layout.tsx, apps/galaxy/app/api/v1/openapi.json/route.ts]
routes: [/docs/api]
supersedes: null
---

## Purpose

The API's page in the guide: the API guide (make a key, read the PRDs and bug fixes, start a bug
fix, page with the cursor, the errors), then, under it, the full reference Scalar renders from
`GET /api/v1/openapi.json`, every route with its parameters, responses and examples.

## Regions

- The docs sidebar and the table of contents, as every guide page shows them.
- The guide's body, from `docs/guide/api.md`.
- The reference, in a framed panel under the guide: Scalar's own route sidebar (search, Introduction,
  then one group per tag: PRDs, Bug fixes, Reference) beside its content (the version badges, the
  title, the download link, the description, the Server, Authentication and Client libraries
  cards, then each route with its request example, its responses and its parameters).

## States

- Loading: the reference renders its sections as the reader scrolls to them.
- Omni, Light and Dark themes: the reference takes the docs tokens (surface, sunk, ground, ink,
  muted, line, the yellow signal on its primary buttons, cyan links), so it follows the theme switch.
- Phone: the reference's sidebar folds away and its content runs one column.

## Words

The guide's words are `docs/guide/api.md`; the reference's are the OpenAPI document's (its
description and each route's summary, in `apps/galaxy/src/public-api/openapi.ts`). Scalar's own
controls keep Scalar's words ("Download OpenAPI Document", "Test Request", "Select Auth Type").

## Refusals

- The reference never renders on the browser's default styles: Scalar's stylesheet is always loaded.
- No colour of its own: every colour is a docs token.

## Open questions

- Scalar's extras, "Ask AI" and "Generate SDKs & MCP", show in the reference: keep them or hide them?
- The guide's "Next" link sits between the guide and the reference, not at the page's end.

## Source

/omni:visual-fix #2092, pick B by @pierrederval on 2026-10-16: .omni-loop/delivery/visual/2092-api-docs-styles/before-after.html
