---
id: s2-01-refusal-details
prd: 1628
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When the page turns a terminal token down, which details does it send back so the terminal can say why in one line: the expiry date, the person and the workspace?

## The decision, in plain words

The terminal reads the expiry date, the person's login and the workspace name from the refusal when the page sends them, and still prints a plain line without them. A token the page does not know gets its own line asking for a new token.

## The intro, for fun

A door that says no should at least say which key was wrong.

## The punchline, for fun

Ours says it in one line, and never reads the key out loud.

## The options, in plain words

A. Read the date, the login and the workspace from the refusal, the option built.
B. Read nothing beyond the reason, and print the lines without a date, a login or a workspace.
C. Have the server send the whole line ready to print, and the terminal print it as it comes.

## What I had to decide

The names of the extra fields a 401 refusal of the token exchange carries, which the server slice (s1) must answer with: expires_at for an expired token (seconds, milliseconds or a date), login and workspace (an object with a name, or a name) for an ex-member; and the line printed for the reason unknown, which the spec does not give.

## What I did meanwhile

The kit reads expires_at, login and workspace leniently, and prints 'OMNI_TOKEN is not known to <host>: make a new one with omni setup-token' for unknown; any field missing gives the line without it.

## What it costs to change later

Renaming a field is a one-line change on either side, before the feature merges.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the server slice s1 was not built when this was decided, so its field names are not yet confirmed (author)
