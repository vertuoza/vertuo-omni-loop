---
id: s7-01-brainstorm-cannot-read-the-flag
prd: 1299
slice: s7
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

The brainstorm should check whether a repository approves its PRDs on the page, but the kit has no way to ask the page that yet. What should the brainstorm do until it can?

## The decision, in plain words

Until the kit can ask, every brainstorm treats the repository as approving by pull request and says so in one line. Nothing is born on the page yet, even where an owner switched the repository over.

## The intro, for fun

The switch is on the page, and the brainstorm cannot see the page yet.

## The punchline, for fun

So it plays it safe and does things the old way, out loud.

## The options, in plain words

A. A. Keep falling back to a pull request until a kit command reads the switch, saying why in one line (built)
B. B. Add a kit command now that reads the switch, in a follow-up slice of this PRD, and name it in the brainstorm's step 0
C. C. Let the person tell the brainstorm the repository is on the page, and take their word for it

## What I had to decide

Whether to add a small kit command that reads the repository's switch, so the brainstorm can start a PRD on the page when the switch says so.

## What I did meanwhile

Every new PRD gets a phase-0 pull request, exactly as today, with one line saying the switch could not be read. The rest of this PRD (approval, gates, parking) works for any PRD whose spec says phase0: server.

## What it costs to change later

Low: adding the command later is one small slice in the kit plus one line in the brainstorm's step 0; nothing already written has to change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice brief says s4 merged a kit client for GET /api/repositories/phase0, but no kit code or omni command calls that route on this branch; only the galaxy route exists.
- (author) The plugin test refuses a SKILL.md that names an omni command that does not exist, so the skill cannot name a future command.
