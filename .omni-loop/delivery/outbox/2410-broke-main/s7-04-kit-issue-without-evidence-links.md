---
id: s7-04-kit-issue-without-evidence-links
prd: 2410
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 5
---

## The question, in plain words

The spec says an approved setup finding opens an issue on the kit's public repository holding exactly the card's text, but the card also shows links into the workspace's own repository. What should leave the workspace?

## The decision, in plain words

The issue holds the card's words (the check, where it started, what happened and the fix) but not its links, and a finding whose words name the workspace's repository is refused before it is approved, so a member can only reject it.

## The intro, for fun

The finding wanted to post its receipts in public, and the receipts had the company's address on them.

## The punchline, for fun

The story goes out, the receipts stay home.

## The options, in plain words

A. Send the card's words without its links, and refuse a finding that names the repository (built).
B. Send the card's text with its evidence links.
C. Let the member edit the text before the issue opens.

## What I had to decide

Pick A to keep the links at home and refuse a finding that names the repository, B to send the links too, or C to let the member edit the text before it leaves.

## What I did meanwhile

Approve on an Omni-setup finding opens one issue on the kit's repository as the Omni app, titled Rewind: and the first line of what happened, its body the check, Started in: The Omni setup, what happened and the fix with the agent's closing line. When what happened or the fix names the workspace's repository (owner/name) or links GitHub under its owner, the approve route answers 422 and nothing is decided; in the kit's own repository nothing is refused, since the issue opens at home.

## What it costs to change later

B is one line of the issue's body; C adds an edit box to the card and a check that the edited text still names no repository.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The check catches the repository's full name and its GitHub links only: a code name, a customer or a person named in plain words would still leave; the rewind skill is asked not to write them in a setup finding.
- (author) A refused finding can only be rejected, and the same finding is never proposed again, so the setup problem is then raised by hand or not at all.
