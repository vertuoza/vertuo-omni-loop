---
name: dossier-open
description: Opens a draft dossier for an idea on the Omni page, linked to this Claude session, so the people the idea is for can follow it before the first question is asked. Runs omni dossier open with one line of the idea and prints the draft's link as "follow along at …". Never stops the skill that runs it — /omni:brainstorm follows it at step 0 and carries on whatever it prints. Triggers on "open a dossier", "open a draft dossier", "/omni:dossier-open".
---

# Dossier open: a draft for an idea

`omni` below is `node .omni-loop/bin/omni.mjs`. This skill only runs `omni dossier open` and reports
what it printed. It changes nothing in the repository, and it never stops the skill that runs it:
whatever the command prints, that skill carries on.

A **dossier** keeps a PRD's spec, plan and before/after page on the Omni page, every version of
each, with the questions that shaped it, for everyone in the workspace to read. A **draft** is a
dossier with no PRD number yet: `/omni:dossier-push` numbers it once the PRD exists. The command
sends the Claude session id this terminal runs in, when Claude Code gives one, so the questions this
session asks while ask mode is on show on the draft as they are answered.

## Input

One line of the idea: what it makes true, in plain words, at most 200 characters. It becomes the
draft's title, which everyone in the workspace reads, so write it as a title: never paste the
conversation or anything the person has not said about the idea. With no idea given, say that this
skill takes one line of the idea, and go back to the skill that ran it.

## Open

Run it with the line in single quotes, each `'` inside it written `'\''`:

```bash
node .omni-loop/bin/omni.mjs dossier open '<one line of the idea>'
```

It never blocks: its call to the page has a 5-second limit and one token refresh. It records the
draft on this computer, where a later push from any worktree of this checkout finds it.

| exit | what you do |
|---|---|
| `0` | Its output is the draft's link, one line. Print `follow along at <link>`: the person can send it to whoever the idea is for. |
| `1` | Nothing was opened. Print its line as is: `off` (this repository's dossier switch is off, or it has no page address), `no sign-in (omni signin)` (this computer has not signed in to the Omni page, or the sign-in expired: the person runs that command themselves, once, whenever they like; never sign in for them), `unreachable` (the page did not answer in time), or `refused (<status>)` (the page answered with an error; `refused (404)` is a page that does not keep dossiers yet). |
| `2` | The kit is not installed here, or its config does not read. Print its line as is. |

Print anything else it printed, on either stream, as is. Then go back to the skill that ran this
one, and carry on from where it left: a draft that did not open stops nothing, and the first
`/omni:dossier-push` finds or creates the PRD's dossier by its number.

## Never

- Never run it a second time to get past a skip, and never wait for the page.
- Never write, edit or delete anything under `.omni-loop/local/`, nor read or print the sign-in kept
  in the person's home folder: the command owns them.
