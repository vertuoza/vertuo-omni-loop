---
screen: ask-signin
status: draft
kind: page
mock: ask-signin.html
implements: [apps/galaxy/app/ask/(doorway)/signin/page.tsx, apps/galaxy/src/ask/cli-code-card.tsx]
reads: [apps/galaxy/src/doorway/Doorway.tsx, apps/galaxy/src/ask/cli-code.ts, apps/galaxy/src/ask/kit-token.ts, apps/galaxy/src/ask/page/GithubSignInCard.tsx, apps/galaxy/src/ask/page/Notice.tsx, apps/galaxy/src/ask/ask.css]
routes: [/ask/signin]
supersedes: null
---

## Purpose

The page `omni signin` opens in the browser when the terminal can be reached on its own computer
(PRD 71), and `omni setup-token` with `purpose=token` (PRD 1628). The person signs the terminal in
with GitHub; the terminal gets its own sign-in. Inside the doorway (PRD 1705).

## Regions

- **The doorway** around it (its own shared screen, `doorway`).
- **The card** (`CliSignInCard`): a title, one line, and **Sign in with GitHub** (the primary action).

## States

- **Sign in:** `Sign the terminal in` · `The terminal gets its own sign-in.` · **Sign in with GitHub**.
- **Token:** `Make a terminal token` · the token's name and lifetime · **Sign in with GitHub**.
- **Busy:** the button reads `Opening GitHub…`.
- **Refused:** the reason in `red`, the button reads `Try again with GitHub`.
- **Not open:** the `Notice` the page shows when ask mode is not open on this deployment.

## Words

Today's words, unchanged by PRD 1705.

## Refusals

- Never shows the one-time code or the token.

## Open questions

- The token state's sentence and the Not open notice are not drawn in the mockup yet, and not yet
  read by the word pass.

## Source

/omni:brainstorm, PRD 1705: .omni-loop/delivery/shipped/1705-doorway/before-after.html
