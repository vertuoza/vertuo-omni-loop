---
screen: fleet-settings
status: draft
kind: page
mock: fleet-settings.html
implements: [apps/galaxy/app/app/settings/fleets/page.tsx, apps/galaxy/src/fleets/FleetsPage.tsx, apps/galaxy/src/fleets/FleetsScreen.tsx, apps/galaxy/src/fleets/FleetsView.tsx, apps/galaxy/src/fleets/FleetCard.tsx, apps/galaxy/src/fleets/fleets.css]
reads: [apps/galaxy/src/fleets/store.ts, apps/galaxy/src/fleets/model.ts, apps/galaxy/src/nav/AppShell.tsx]
routes: [/app/settings/fleets]
supersedes: null
---

## Purpose

The workspace's fleets: the owner raises, edits, retires and restores them, and gives each one,
if they like, the GitHub project board its pull requests go on (PRD 2530). Every member reads the
same cards, read-only. It sits inside the app shell, under the Settings tabs.

## Regions

- **The head card,** Fleets, one sentence on what fleets are (or, for a member, who may change
  them), and **New fleet** for the owner, the page's one primary action.
- **The form,** opened by New fleet or Edit: Label, Colour (swatches or a hex), Motto, Mascot, and
  **GitHub project**, an optional link to an organization project of the workspace's organization;
  a live preview card; **Save changes** (or **Create fleet**) and **Cancel**.
- **Active fleets,** `<n> of 12 active`, one card each: the mascot, the label, the motto, and, when
  the fleet has a board, `Board: <org> project <number>`, linked, with the App's last note under it
  in muted text; **Edit** and **Retire** for the owner.
- **Retired fleets,** under a fold, each with **Restore** for the owner.

## States

- **No board:** the card shows no `Board:` line and no note.
- **Board, no note yet:** the `Board:` line alone.
- **Added:** `Added #<n> · <owner>/<repo>`, with its time.
- **Refused:** `Not added: ask an org admin` or `Not added: no such project`, in the error colour,
  the full reason as its title.
- **Refused link:** the form shows the refusal next to GitHub project, the look already saved.
- **Member:** the same cards, no field, no buttons.

## Words

- `GitHub project`, `Board:`, `Added #<n> · <owner>/<repo>`, `Not added: ask an org admin`,
  `Not added: no such project`, `The loop’s PRs land here.`

## Refusals

- No board of another organization, no user's board.
- No Status or other field of the card is set from this page.

## Open questions

- Whether a member of the fleet, not only the owner, may set its board (V1: the owner only).
- Whether the note shows its time as a relative age or a date.

## Source

/omni:brainstorm, PRD 2530: .omni-loop/delivery/inbox/2530-fleet-project-board/before-after.html
