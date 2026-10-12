---
id: s2-02-a-locked-law-needs-a-thesis
prd: 1726
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Once a person locks a first law, the knowledge check now fails until the one-page summary for newcomers exists and lists it; is that strict enough, or too strict?

## The decision, in plain words

Strict: a law nobody can read about on the newcomer page is a law a newcomer will break, so the page must exist as soon as one law does.

## The intro, for fun

A law was locked, and the welcome page had not been written yet.

## The punchline, for fun

Newcomers rarely break rules they were told about.

## The options, in plain words

A. Refuse a lock with no thesis or no laws section, and a law line with no 'If broken:' (built).
B. Grade the thesis only when it exists, and never its line shape.

## What I had to decide

Whether omni check knowledge refuses a repository that locks a law but has no thesis (or a thesis with no laws section), the spec only saying it refuses a laws section naming an unlocked id or missing a locked one.

## What I did meanwhile

With no law locked, nothing is asked of the thesis. With one locked, a missing thesis, a thesis with no '## The laws' section, a law line naming an unlocked id, a locked law left out, and a law line with no 'If broken:' are each refused with their own message. An imported copy is never asked. The briefing ends with the thesis's laws section, or with the locked laws read from the registers when the thesis has none.

## What it costs to change later

A constant: dropping the missing-thesis refusal is two early returns in thesis.ts. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Requiring 'If broken:' on each law line follows the spec's line shape; the spec does not say the check enforces it.
- (author) omni kb laws says who must approve a change from laws.owners, not from the CODEOWNERS file, which s4 writes from the same setting.
