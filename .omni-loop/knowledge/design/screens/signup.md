---
screen: signup
status: draft
kind: page
mock: signup.html
implements: [apps/galaxy/app/signup/page.tsx, apps/galaxy/src/signup/SignupScreen.tsx, apps/galaxy/src/signup/signup.css]
reads: [apps/galaxy/src/doorway/Doorway.tsx, apps/galaxy/src/signup/github-app.ts, apps/galaxy/src/signup/installed.ts, apps/galaxy/src/ask/ask.css]
routes: [/signup]
supersedes: null
---

## Purpose

Where a visitor with no workspace installs Omni Loop on their GitHub org or their own account
(PRD 359), and where `/signup/installed` sends them to wait for an org's owner, or when a sign-up
stopped. Inside the doorway, with words cut to the word pass (PRD 1705).

## Regions

- **The doorway** around it (its own shared screen, `doorway`).
- **The card:** a title, one line, the primary action, and at most three short lines under it.

## States

- **Install:** `Install Omni Loop on your org` · `Pick the repositories it may read.` · **Install
  Omni Loop on GitHub** (primary) · `Not the owner? GitHub asks them.` · `Already in a workspace?`
  **Sign in again** · **How sign-up works** (to `/docs/install#install-the-github-app`).
- **Waiting:** `Waiting for <org>'s owner` · `Only an org owner can install it.` · `Once approved,
  sign in again.` · **Sign in again** (primary).
- **Error** (`link`, `github`, `unknown`, `not-yours`, `no-org`): the reason's title in `red`, its
  one line (PRD 1705's spec, the table in **`/signup`'s words**), the install button.
- **No GitHub App:** `Sign-up is not open here.`, no button.

## Words

Every sentence at rest within 7 words (the word pass). What the old paragraph explained (a workspace
named after the org, your own account works too) is in `/docs/install#install-the-github-app`.

## Refusals

- Never shows text as it came in the address: only a known reason or GitHub logins.

## Open questions

- The `link`, `unknown`, `not-yours` and `no-org` errors are written in the spec, not drawn in the
  mockup.

## Source

/omni:brainstorm, PRD 1705: .omni-loop/delivery/inbox/1705-doorway/before-after.html
