---
name: status
description: Shows where the repository's PRDs stand, on one screen — how many have shipped, how many wait in the inbox, are being built in the outbox or wait for review, a bar of delivered against in progress, and the PRDs that are the person's own, each with where it stands. Runs omni status, read from git on this computer, adding --fetch only when the person asks for fresh data, and prints its output as is. Never runs the outbox gate of one PRD. Triggers on "where are my PRDs", "what is in the inbox", "what has shipped", "show the status", "omni status", "/omni:status", "/omni:status --fetch".
---

# Status: where the PRDs are

`omni` below is `node .omni-loop/bin/omni.mjs`. This skill only runs `omni status` with no PRD
number, the repository's overview, and prints what it printed. It changes nothing. It never runs the
outbox gate, which is `omni status` given one PRD's number: the skills that ship run that one.

The overview reads git only, on this computer: the default branch as it was last fetched, and the
feature and phase-0 branches fetched beside it. It never calls GitHub, and its header says when the
last fetch was.

## Input

- **Nothing:** run the overview as it stands.
- **Fresh data:** `--fetch`, or words asking for it ("fetch first", "fresh", "the latest", "as it
  is on the remote now"). The overview fetches the remote first.
- **A PRD number, or anything else:** this skill has no view of one PRD. Run the overview anyway
  (fetching first when they also asked for fresh data), then say one line under it:
  `/omni:status` shows the whole repository, never one PRD alone, and the PRDs that are theirs are
  listed in it, each with where it stands.

## Run

```bash
node .omni-loop/bin/omni.mjs status
```

or, only when the person asked for fresh data:

```bash
node .omni-loop/bin/omni.mjs status --fetch
```

Add nothing else to either line.

| exit | what you do |
|---|---|
| `0` | Print its output as is, in a text block (below). A first line `fetch failed: …; showing your last fetch` is part of it: the fetch did not work, and the overview is as old as its header says. Add nothing but the one line **Input** asks for. |
| `2` | It printed one line on stderr: print it as is and stop. One naming `--fetch` means this checkout has fetched no default branch and holds none of its own: say that `/omni:status --fetch` fetches it first, and never fetch for them. Any other line: the kit is not installed here, or its config does not read. |
| anything else | The command failed. Print its first line as is and stop. With no `.omni-loop/bin/omni.mjs` in this repository, the kit is not installed here. |

## The text block

The bar and the columns line up only in a fixed-width font, so the output goes in a fenced block
marked `text`, never as Markdown:

```text
<what omni status printed, every line and every blank line exactly as it came>
```

Never reword, shorten, translate or reorder it, never turn its rows into a table or a list, and
never add a line inside the block. A long output stays whole.

## Never

- Never give `omni status` a PRD number, or a flag other than `--fetch`: that is the outbox gate,
  which can exit 1 when a PRD's outbox is red, and it is not this skill's.
- Never fetch unless the person asked for fresh data: without `--fetch` the overview never touches
  the network.
- Never change a file, a branch or a remote to make the overview read differently.
