---
id: s3-01-proof-calls-outside-territory
prd: 798
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Sending a proof run needs the terminal's existing sign-in, and the help page must list the new command, but both live in files this slice was not given.

## The decision, in plain words

The new calls were added beside the existing calls to the Omni page, so they share the same sign-in, and the new command got its help line now so the help check stays green.

## The intro, for fun

The new command needed a key to the building and a name on the door.

## The punchline, for fun

It borrowed the master key and wrote its own name tag.

## The options, in plain words

A. A. Add the calls to the shared sign-in client, and the help line now (built)
B. B. Copy a small signed-in client into the proof code, and leave the help line to the later slice, with this one failing its checks until then
C. C. Open one general signed-in call on the shared client, and build the proof calls on it inside the proof code

## What I had to decide

Whether the upload, register and file-put calls live in the shared ask client (kit/lib/ask/client.mjs), and whether s3 or s5 writes the proof command's help entry (kit/lib/help/entries.mjs).

## What I did meanwhile

Added requestProofUploads, registerProof and upload to askClient with tests in client.test.mjs, and a `proof` command entry (who: skills) in the help entries, raising the command count in entries.test.mjs from 36 to 37.

## What it costs to change later

A constant: moving the calls into kit/lib/proof/ is a file move with no stored data; the help entry is one block s5 can reword.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives s3 kit/bin/commands/proof, kit/bin/commands/index.mjs, kit/lib/proof/ and kit/dist/ only; the help entries test fails for any new command without an entry, and the sign-in refresh lives only inside askClient.
