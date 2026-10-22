---
screen: api-keys
status: draft
kind: page
mock: api-keys.html
implements: [apps/galaxy/app/app/settings/api-keys/page.tsx, apps/galaxy/src/public-api/page/ApiKeysPage.tsx, apps/galaxy/src/public-api/page/ApiKeysView.tsx, apps/galaxy/src/public-api/page/ApiKeysPanel.tsx, apps/galaxy/src/public-api/page/api-keys.css, apps/galaxy/src/nav/section-tabs.ts]
reads: [apps/galaxy/src/public-api/public-api.contract.ts, apps/galaxy/src/public-api/public-api.service.ts, apps/galaxy/src/nav/AppShell.tsx]
routes: [/app/settings/api-keys]
supersedes: null
---

## Purpose

The workspace's API keys: a workspace owner makes a key for another tool, copies its secret once,
and revokes it; every member sees which keys exist, what they reach, which GitHub App each runs as
and when it was last used. An owner attaches a GitHub App to a key, so the jobs the key sends write
on GitHub as that app's bot, never as a person. It sits inside the app shell, under the Settings
tabs, after Products.

## Regions

- **The title,** API keys, with **New key** beside it for an owner, the page's one primary action.
- **The reference link,** API reference, opening `/docs/api`.
- **Keys:** one row per live key, with:
  - its name, and under it who made it and when;
  - `oma_…<last four>`;
  - its repositories: All repositories, or one chip each;
  - its **GitHub App**, for every member: `—`, or the app's slug. An owner also sees, under the
    slug, `last token <date>` (or `no token yet`), and the actions **Attach a GitHub App** on a key
    with none, **Replace** and **Remove** on a key with one. Remove is asked twice, as Revoke is:
    **Remove for good** and Cancel;
  - when it was last used, or Never;
  - Revoke, for an owner.
- **The attach form,** for an owner, opened from Attach a GitHub App or Replace: **App ID** and
  **Private key file** (a `.pem`), with **Attach** (the primary action of that state) and Cancel.
- **The key just made,** in place of the table's top, once: its name, the whole secret with
  **Copy** (the primary action of that state), "You will not see this key again." and a `curl`
  example.

## States

- **No key yet:** the table says "No key yet."; an owner sees New key.
- **A member:** the table with no New key and no Revoke, and the line "Only owners make or revoke
  keys."; the GitHub App column shows the slug or `—`, with no `last token` and no action.
- **The attach form open:** the form above the table, Attach the primary action, New key quiet.
- **A refused attach:** the refusal reads under the form, and nothing is stored.
- **The key just made:** the secret shown once; leaving or reloading the page hides it for good.

## Words

API keys · New key · API reference · Name · Key · Repositories · GitHub App · Last used · All
repositories · Never · Revoke · No key yet. · Copy · You will not see this key again. · Only owners
make or revoke keys. · Attach a GitHub App · Replace · Remove · Remove for good · last token <date> · no token yet ·
Attach a GitHub App to <key> · App ID · Private key file · Choose file · Attach · Cancel

## Refusals

- The secret is never shown again after it is made, never stored, and never shown to a member.
- No key is edited: changing its repositories means revoking it and making another.
- The app's private key is never shown again, to anyone, and a member never reads `last token`.
- Only an owner attaches, replaces or removes an app.
- A pair GitHub refuses reads "GitHub refused this App ID and private key." and nothing is stored.
- On a deployment with no master key, attaching reads "Attaching a GitHub App isn't available on
  this deployment."

## Open questions

- How New key asks for the name and the repositories: a dialog, or a form inline above the table.
- Whether a revoked key stays listed, greyed, or leaves the table at once.
- Where the GitHub App column sits: drawn after Repositories, with its actions in it.
- Whether the member's line, "Only owners make or revoke keys.", also names attaching.
- The label of the file control, drawn as Choose file.

## Source

/omni:brainstorm, PRD 2022: .omni-loop/delivery/shipped/2022-api-keys-v1/before-after.html
/omni:brainstorm, PRD 2433: .omni-loop/delivery/inbox/2433-api-key-github-app/before-after.html
