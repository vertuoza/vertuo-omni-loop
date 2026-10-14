---
id: s4-02-names-that-stay-beyond-the-list
prd: 1915
slice: s4
rank: medium
bears-on: none
raised: 2026-10-14
wave: 2
---

## The question, in plain words

Beyond the places the spec named, the check found four more that say Claude where rewording would rewrite a record or a stored message: the demo's first release, copied from the notes that shipped; the release notes' product line the spec itself wrote; two database refusal messages the test doubles repeat; and the model names the app calls. Should they stay?

## The decision, in plain words

They stay, each listed in the check with its reason. The first release keeps the words it shipped with, and the database messages wait for a change of their own.

## The intro, for fun

Some sentences are history, and history does not take edits kindly.

## The punchline, for fun

The check now knows which old words are on purpose.

## The options, in plain words

A. A. Keep them, each named in the check with its reason (built).
B. B. Reword the demo's first release and the shipped notes together, so the demo stays word for word.
C. C. Also add a migration that rewords the two database messages, and the test doubles with them.

## What I had to decide

Whether the shipped release notes and the database's refusal messages keep their words, or get rewritten to speak of the agent.

## What I did meanwhile

The check lets through exactly these words, in exactly these files; any new mention of Claude elsewhere fails it.

## What it costs to change later

Removing an entry from the check's list, then rewording: the release notes in their shipped folders and the demo together, or a small migration for the two database messages.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Rewording the shipped release notes rewrites a past record outside this slice's ground (author).
- The database messages are raised by migrations; the spec rules out any migration (author).
- The check reads the word Claude alone: names like claude_session_id stay code, as the spec says (author).
