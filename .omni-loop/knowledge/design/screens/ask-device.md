---
screen: ask-device
status: draft
kind: page
mock: ask-device.html
implements: [apps/galaxy/app/ask/device/page.tsx, apps/galaxy/src/ask/device-card.tsx]
reads: [apps/galaxy/src/ask/device.ts, apps/galaxy/src/ask/cli-code-card.tsx, apps/galaxy/src/ask/page/Notice.tsx, apps/galaxy/src/ask/ask.css]
routes: [/ask/device]
supersedes: null
---

## Purpose

The page a device sign-in's link opens (PRD 1660): the person checks that the code matches what
their terminal shows, then signs the terminal in with GitHub, from any browser. It serves
`omni signin` and `omni setup-token` when the terminal runs where the browser cannot reach it.

## Regions

- **The wordmark** above the card, as on `/ask/signin`.
- **The card** (`ask-card`, one column): a title, one short line, and, while the request is
  pending, the code in large mono type on the sunk panel.
- **The actions:** **Yes, sign it in** (the primary action) and *No, it's not mine* (a quiet link
  button) beside it; or, with no code in the link, a code box and **Continue**.

## States

- **Confirm** (mostly seen): `Sign a terminal in` · `Does your terminal show this code?` · the code ·
  Yes / No.
- **Sign in:** after Yes, the existing sign-in card (`CliSignInCard`), with `setup-token`'s token
  name and lifetime when the request is for a token.
- **Enter the code:** no code in the link: `Enter the code your terminal shows.`, a box that takes
  the code with or without its dash and in any case, and **Continue**.
- **Done:** `Back to your terminal` · `Signed in. Close this tab.`
- **Denied:** `Nothing was signed in` · `Got this link from someone? Ignore it.`
- **Expired:** an expired, unknown or used code: `This link has expired` · `Run omni signin again.`

## Words

Every sentence at rest stays within 7 words (the word pass). The code is always shown as
`XXXX-XXXX`, in capitals.

## Refusals

- Never signs anything in without the person pressing Yes.
- Never shows the device code, the one-time code or a kit token: only the user code.

## Open questions

- The page under the Light and Dark themes is not drawn yet; it uses Ask's tokens, so it follows
  them.

## Source

/omni:brainstorm, PRD 1660: .omni-loop/delivery/inbox/1660-signin-device/before-after.html
