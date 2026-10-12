---
screen: profile
status: draft
kind: page
mock: profile.html
implements: ['apps/galaxy/app/app/people/[login]/page.tsx', apps/galaxy/src/profile/ProfileScreen.tsx, apps/galaxy/src/profile/AlertsSection.tsx, apps/galaxy/src/profile/AlertSwitches.tsx, apps/galaxy/src/profile/alerts.ts, apps/galaxy/src/profile/TerminalTokens.tsx, apps/galaxy/src/profile/TerminalTokensCard.tsx, apps/galaxy/src/profile/terminal-tokens.ts, apps/galaxy/src/profile/profile.css]
reads: [apps/galaxy/src/profile/load.ts, apps/galaxy/src/profile/profile.ts, apps/galaxy/src/profile/select.ts, apps/galaxy/src/agent-connect/tokens/store.ts, apps/galaxy/src/profile/terminal-tokens.client.ts, apps/galaxy/src/profile/terminal-tokens.service.ts, apps/galaxy/src/profile/terminal-tokens.repository.ts, apps/galaxy/src/dashboard/board/Board.tsx, apps/galaxy/app/app/layout.tsx, apps/galaxy/src/nav/AppShell.tsx]
routes: [/app/people/<login>]
supersedes: null
---

## Purpose

A member's page: who they are and what they did this period. On your own profile, it is also where
you set how the loop reaches you: your alerts, and the terminal tokens that sign the `omni` command
in where no browser opens.

## Regions

- **The header:** the person's name, `@login` to GitHub, their fleet, their season place.
- **Alerts** (your own profile only): its intro line, then **Phone alerts on this device** and
  **Email · <address>**, each a switch.
- **Terminal tokens** (your own profile only, PRD 1628): the line `Sign in where no browser opens.`;
  your live kit tokens, newest first, each with its name and `··<last four>`, then `Made <date>`,
  `Used <when>` (`just now`, `<n> min ago`, `<n> h ago`, then the day; or `Never used`) and
  `Expires <date>`, dates as day and month, and **Revoke**; under them, a name field, an
  **Expires in** choice of 30, 90 or 365 days (90 chosen), and **Make a token**, the screen's one
  primary action.
- **The token shown once,** right after **Make a token**'s sign-in comes back: the name, `shown once`
  and `Expires <date>`, the token in a copy field with **Copy** (`Copied` once pressed), and `Paste as
  OMNI_TOKEN= in your environment.`
- **In the demo,** the line `Demo: no token here signs anything in.` under the intro; Make a token draws
  a token in the page, with no round trip.
- **The work lists:** PRDs, fixes, pull requests and reviews of the period (PRD 698).

## States

- Someone else's profile: no Alerts, no Terminal tokens.
- No live token: the list is absent; the line and the form remain.
- Right after making one: the shown-once panel, until the page is reloaded or left.
- **Revoke** asks to confirm on a line of its own under the row (`Revoke ··<last four>?`, **Revoke**,
  **Keep**), then the row leaves the list.
- 20 live tokens (business links and kit tokens together): the form is disabled and says `You hold
  20 tokens already: revoke one to make another.`, the database's own words.
- Tokens that could not be read: the dashboard's "could not load" line in place of the list.

## Words

`Alerts`, `Terminal tokens`, `Sign in where no browser opens.`, `Made`, `Used`, `Never used`,
`Expires`, `Revoke`, `Keep`, `Name`, `Expires in`, `30 days`, `90 days`, `365 days`, `Make a token`,
`shown once`, `Copy`, `Copied`, `Paste as OMNI_TOKEN= in your environment.`, `You hold 20 tokens
already: revoke one to make another.`, `Demo: no token here signs anything in.`

## Refusals

- The token is never shown again after the shown-once panel, and never on anyone else's profile.
- No token value in the page's markup beyond its last four, outside the shown-once panel.

## Open questions

- The Alerts intro (`How you are told a PRD waits for your approval. Both are off until you turn
  them on.`) runs 18 words at rest, past the word pass's 7: today's copy from PRD 1322, not changed
  by PRD 1628.
- The limit's line (13 words) is the database's refusal, shown at rest while the limit holds: past
  the word pass's 7, chosen so the page and the round trip say the same (PRD 1628 s4).

## Source

/omni:brainstorm, PRD 1628: .omni-loop/delivery/shipped/1628-cloud-sign-in/before-after.html; brought
up to the built screen by PRD 1628 s4.
