---
id: s1-01-now-runs-without-a-kit
prd: 1208
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

Should the everyday omni command answer 'on nothing' when it is run in a folder where the loop is not installed, instead of refusing?

## The decision, in plain words

Yes: asking what a session is on outside a repository with the loop now answers that it is on nothing and succeeds, as the spec asks, instead of the usual refusal.

## The intro, for fun

Ask a stranger what they are working on, and they should not slam the door.

## The punchline, for fun

Now they just shrug and say: nothing, thanks for asking.

## The options, in plain words

A. A. Let now run without a kit: it answers the session is on nothing, exit 0 (built).
B. B. Keep the refusal: outside a kit the global omni prints one line on stderr and exits 2; inside one, nothing changes.

## What I had to decide

Whether the person-installed omni lets the now command run in a folder with no loop, or refuses it like other commands.

## What I did meanwhile

The launcher lets now run anywhere; it reads nothing and answers that the session is on nothing.

## What it costs to change later

One word in the launcher's list of commands that need no kit; removing it brings the refusal back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The slice's territory did not include the launcher (kit/lib/launch); the spec's acceptance criteria ask for exit 0 where the loop is not installed, which only this change gives through the global omni. (author)
