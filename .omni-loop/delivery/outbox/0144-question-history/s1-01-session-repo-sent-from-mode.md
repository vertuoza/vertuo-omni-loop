---
id: s1-01-session-repo-sent-from-mode
prd: 144
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

Switching ask mode on must now tell the server which repository the session is for, but the file that opens the session was not in this slice's list of files. Should the slice change it?

## The decision, in plain words

Yes: the step that switches ask mode on now sends the repository name along with the session title, a one-line change. Nothing else in that file changed.

## The intro, for fun

The repository name needed a lift to the server, and the car was parked one street over.

## The punchline, for fun

We borrowed it for one line and put the keys back.

## The options, in plain words

A. Change the one line so switching ask mode on sends the repository name with the session
B. Leave that step alone, and have the server take the repository name from the session's first question instead

## What I had to decide

Keep the one-line change outside the listed files, or move the sending of the repository elsewhere.

## What I did meanwhile

Sessions opened from now on carry their repository; the next slice uses it to pick the session's workspace.

## What it costs to change later

Undoing it is removing one argument; the server treats the field as optional.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 names the client and the hook but not kit/lib/ask/mode.mjs, where `omni ask on` opens the session (author)
