---
screen: api-keys
status: draft
kind: page
mock: api-keys.html
implements: [apps/galaxy/app/app/settings/api-keys/page.tsx, apps/galaxy/src/public-api/page/ApiKeysPage.tsx, apps/galaxy/src/public-api/page/api-keys.css, apps/galaxy/src/nav/section-tabs.ts]
reads: [apps/galaxy/src/public-api/public-api.contract.ts, apps/galaxy/src/public-api/public-api.service.ts, apps/galaxy/src/nav/AppShell.tsx]
routes: [/app/settings/api-keys]
supersedes: null
---

## Purpose

The workspace's API keys: a workspace owner makes a key for another tool, copies its secret once,
and revokes it; every member sees which keys exist, what they reach and when they were last used.
It sits inside the app shell, under the Settings tabs, after Products.

## Regions

- **The title,** API keys, with **New key** beside it for an owner, the page's one primary action.
- **The reference link,** API reference, opening `/docs/api`.
- **Keys:** one row per live key, with:
  - its name, and under it who made it and when;
  - `oma_…<last four>`;
  - its repositories: All repositories, or one chip each;
  - when it was last used, or Never;
  - Revoke, for an owner.
- **The key just made,** in place of the table's top, once: its name, the whole secret with
  **Copy** (the primary action of that state), "You will not see this key again." and a `curl`
  example.

## States

- **No key yet:** the table says "No key yet."; an owner sees New key.
- **A member:** the table with no New key and no Revoke, and the line "Only owners make or revoke
  keys."
- **The key just made:** the secret shown once; leaving or reloading the page hides it for good.

## Words

API keys · New key · API reference · Name · Key · Repositories · Last used · All repositories ·
Never · Revoke · No key yet. · Copy · You will not see this key again. · Only owners make or
revoke keys.

## Refusals

- The secret is never shown again after it is made, never stored, and never shown to a member.
- No key is edited: changing its repositories means revoking it and making another.

## Open questions

- How New key asks for the name and the repositories: a dialog, or a form inline above the table.
- Whether a revoked key stays listed, greyed, or leaves the table at once.

## Source

/omni:brainstorm, PRD 2022: .omni-loop/delivery/shipped/2022-api-keys-v1/before-after.html
