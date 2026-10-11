---
id: s1-01-refused-reads-held
prd: 1612
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When the approval cannot be trusted for a reason other than a server outage, for example the approver has left the workspace, should the approval check on a pull request say held or failed?

## The decision, in plain words

It says held, like an outage: only a file that changed since approval turns the check red. The terminal still prints the exact reason.

## The intro, for fun

An approver walked out of the workspace and left their signature on the desk.

## The punchline, for fun

We put the signature in a drawer marked held, not in the bin.

## The options, in plain words

A. A. Held (neutral): only a drift fails, a server-side doubt never blocks a merge.
B. B. Failed: an approval whose approver left is not an approval, so the check is red until someone approves again.
C. C. Waiting (neutral), pointing at the PRD page to approve again.

## What I had to decide

Whether an approval whose approver left, or a reply the server refused, makes the check neutral (held) or failed.

## What I did meanwhile

The shared judge maps the refused state to held; the terminal command's lines and exit code are unchanged.

## What it costs to change later

One line in the verdict mapping and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names four states and lists only the server being unreachable as held; it does not say where a refused reading goes (author).
