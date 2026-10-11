---
id: s6-01-the-store-holds-the-outbox-not-every-file
prd: 1548
slice: s6
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Every outbox command now reads and writes the outbox through one door. Must the files a command is handed or told to write, which are not the outbox, go through that door too?

## The decision, in plain words

Only the outbox itself goes through the door: the open questions, the ledger of answers and the accounts. A file a person hands a command, a result it is told to write, and the summary it leaves for the automated checks stay with the command, as before.

## The intro, for fun

One door now leads into the outbox, and every command was asked to use it.

## The punchline, for fun

The doormat and the post slot stayed where they were.

## The options, in plain words

A. A. Only the outbox goes through the door; a command's own input and output files stay with it (built).
B. B. Every file a command touches goes through the door, the outbox and the rest alike.
C. C. Leave the reading commands outside the door, and send only the writing ones through it.

## What I had to decide

Confirm the reading of the done-when line 'no outbox verb reads or writes the filesystem except through the store': the store owns outbox state (open items, settled.md, accounts, the --out scratch folder and the relay's source folder), while a verb's own arguments stay outside it — the --file JSON of item new, settle's --answer-file and answers' --answers (read through readUserFile), comment's --result, --pr-comment and --slack-note files, and status's GITHUB_OUTPUT and step summary.

## What I did meanwhile

kit/lib/outbox/store.ts defines OutboxStore; kit/lib/outbox/git-store.ts holds every outbox read and write the commands made (adopt's read and rmSync of the item, item new's spent ids and item file, the relay's folder check). kit/lib/outbox/git-store.test.ts guards it: item, adopt, settle, answers and replies import nothing from node:fs, status only appendFileSync (the Actions output) and comment only writeFileSync (--result), and none imports a library function the store wraps.

## What it costs to change later

Moving a verb's own files behind the store is a method or two on OutboxStore and a line in the guard per file; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the plan say every outbox verb is on the seam but not whether a verb's input and output files count as the outbox.
- (author) A server store has no use for a person's input file or the Actions output, which is why they stayed with the command.
