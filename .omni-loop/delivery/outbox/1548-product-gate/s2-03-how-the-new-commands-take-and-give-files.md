---
id: s2-03-how-the-new-commands-take-and-give-files
prd: 1548
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The new commands move a product PRD's files to and from the server. Where do they read the files to send, where do they write the ones they fetch, and what do they print?

## The decision, in plain words

Sending reads the PRD's files from a folder the command is pointed at, and fetching writes the file into a fresh folder outside every project, printing where it is and its fingerprint. The read-only view prints the file under a line saying its version and when it was read.

## The intro, for fun

Files without a home folder still need a front door and a mailbox.

## The punchline, for fun

The door is any folder you name, the mailbox a fresh one every time.

## The options, in plain words

A. A. A folder named with --from, a fresh scratch folder, a path then a sha256 line (built)
B. B. Read the files to send from the current folder, with no flag
C. C. Print the fetched file's content to the screen instead of writing a file

## What I had to decide

Confirm the shapes the skills will call in s11 and s12: omni dossier push --product <key> --new [--from <dir>] [--title] prints the new id, the link and the versions added; omni dossier push <key>-<n> --from <dir> pushes edits; omni dossier get <id> <kind> prints the scratch path then `sha256 <hash>`; omni prd <id> --show <kind> prints `<kind> of PRD <id> · v<k> · as of <time>`, a blank line, then the file; the last-read copy lives in .omni-loop/local/prd-cache/<id>/<kind>.json of the main checkout.

## What I did meanwhile

The files of --from are read by name (spec.md, plan.md, before-after.html, voice.json), the title from --title, else the spec's front matter, else (for a PRD already made) the title its page has. get writes under the system's temporary folder, in a new omni-<id>-* folder, checks the kit's own sha256 against the server's, keeps the last-read copy, and holds (exit 1) while the server is down; only --show answers from the copy, marked `· last-read copy, server unreachable`.

## What it costs to change later

Each shape is a line in one command and its tests; nothing stored depends on it but the last-read copies, which are a cache any change can drop.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the verbs and that they print a path and a hash, not the flags or the exact lines; s11 and s12 are their first callers.
