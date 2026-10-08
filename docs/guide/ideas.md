---
title: Ideas board
description: A public board of what a repository plans to build Now, Next and Later, that anyone reads and anyone signed in with GitHub votes on, and that the workspace's members fill from the page or the terminal.
---

Ideas for what to build next often live in one person's head. An **ideas board** gives them a place
before they become a PRD: one board per repository, with three lanes, **Now**, **Next** and
**Later**. Members of the workspace place each idea in a lane; votes sort the ideas inside a lane,
most votes first, then the oldest first. The lane is the team's call, never the vote count's.

## Make a board public

A board is off until a member turns it public. In the Omni app, open **Settings ›
Repositories** and switch **Public ideas** on beside the repository. Its board is then served to
anyone at `/ideas/<owner>/<repo>`, for this repository `/ideas/vertuoza/vertuo-omni-loop`. Switch it
off and only the workspace's members see it again.

A board that is off and a repository with no board answer the same "No public board here" page, so
the address never tells which repositories the workspace keeps to itself. Members still read their
own board while it is off, with a line saying only they see it.

Members reach their workspace's board from the sidebar, under **Work › Ideas**.

## Who does what

| who | reads | votes | adds, edits, moves, archives, links a PRD |
|---|---|---|---|
| anyone, signed out | ✓ | — (▲ asks for a sign-in) | — |
| anyone signed in with GitHub | ✓ | ✓ one vote per idea | — |
| a member of the workspace | ✓ | ✓ | ✓ |

## Vote

Each card shows its title, its pitch and its count beside a ▲. Press ▲ to vote; press it again to
take the vote back. Signed out, ▲ starts a GitHub sign-in that asks for no access to your
organizations, needs no workspace, and brings you back to the same board with the vote counted.
One account counts once per idea.

## Fill the board

Signed in, a member sees the board with its controls:

- **Add an idea** above the lanes: a title (at most 120 characters), a pitch (one paragraph, at
  most 600) and a lane, Later unless you pick another.
- **Edit** on a card: its title, its pitch, its lane, and the PRD that builds it. A card with a PRD
  number shows an "In PRD #n" badge linking to that PRD's issue, so voters see it is being built.
- **Archive** on a card: the idea leaves the board. Nothing deletes an idea.

Every card also shows its **Brainstorm this** line with a copy button. Paste it into Claude to turn
the idea into a PRD:

```text agent
/omni:brainstorm 'Call GitHub less: A better sync with GitHub, to call the GitHub API less.'
```

Once its PRD exists, edit the idea and set its PRD number.

## From the terminal

A member adds ideas and lists the board without leaving the terminal, signed in to the Omni app
with `omni signin`:

```bash terminal agent
node .omni-loop/bin/omni.mjs idea add 'Call GitHub less' --pitch 'Fewer API calls.' --lane next
node .omni-loop/bin/omni.mjs idea list
```

`omni idea add` puts the idea in Later when it names no lane, and prints the board's link.
`omni idea list` prints the ideas lane by lane with their votes; `--json` prints them as JSON.
Signed out, or with the app out of reach, each prints one line and changes nothing.

[Next → Landings](/docs/landings)
