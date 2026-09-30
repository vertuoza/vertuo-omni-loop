# Settled outbox items — PRD 798

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-proof-url-shape -->

## s1-01-proof-url-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-proof-url-shape
prd: 798
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The design says proof videos are filmed either on the pull request's preview or on a fixed address, but not which fixed addresses are allowed.

## The decision, in plain words

The setting takes the preview keyword, or any full web address starting with http or https, so a local server on this computer also works. The setting for the preview password only takes the name of a variable, never the password itself.

## The intro, for fun

Where does the camera crew set up?

## The punchline, for fun

Anywhere with a web address, apparently, even the back garden.

## The options, in plain words

A. github-deployment, or any absolute http or https URL (built)
B. github-deployment, or https anywhere and plain http only on the loopback address, as ask.url does
C. github-deployment, or https only

## What I had to decide

Whether a fixed proof address may be plain http on any host, or must be https like the ask page's address.

## What I did meanwhile

Plain http is accepted on any host; the preview keyword and https work as the design says.

## What it costs to change later

A constant: tightening the rule later is one line in the config schema, and no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names github-deployment or a fixed URL, and says nothing about http, localhost or the shape of bypassEnv (author).

```

<!-- /omni-outbox-settled: s1-01-proof-url-shape -->

<!-- omni-outbox-settled: s2-01-upload-mints-run -->

## s2-01-upload-mints-run — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-upload-mints-run
prd: 798
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Which step names a new proof run, and how does the page know a run has a moving preview?

## The decision, in plain words

Asking for upload links starts a new run and hands back its number, and a run has a moving preview when a file called preview.gif was uploaded with it.

## The intro, for fun

Every proof run needs a name tag before it walks into the party.

## The punchline, for fun

The door hands out the tags, and the GIF brings its own.

## The options, in plain words

A. The upload call mints the run and a file named preview.gif is the GIF, the option built.
B. The kit mints the run id itself and sends it on both calls, with the GIF named in the register call.

## What I had to decide

The spec's upload call carries no run id, yet files land under <dossier>/<run>/ and the register call sends `run`. Who mints the id, and how a run's GIF is recognised.

## What I did meanwhile

POST /api/proofs/uploads mints a random UUID and answers {run, files: [{name, path, url}]}; POST /api/proofs records `preview.gif` as the GIF when the run's folder holds it; the register call answers the link <origin>/prd/<dossier id>?tab=proof. Scripts upload as text/plain named .ts or .txt; a name whose extension is not its type's is refused 400.

## What it costs to change later

A change of response shape in two routes and s3's client; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s4 reads the Proof tab from ?tab=proof or wants a run named in the link (author)

```

<!-- /omni-outbox-settled: s2-01-upload-mints-run -->

<!-- omni-outbox-settled: s3-01-proof-calls-outside-territory -->

## s3-01-proof-calls-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s3-01-proof-calls-outside-territory -->

<!-- omni-outbox-settled: s3-02-run-json-shape -->

## s3-02-run-json-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-run-json-shape
prd: 798
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

The design says the proof command reads a run file the recording skill writes, but not what that file holds, nor what happens to a run where nothing could be filmed.

## The decision, in plain words

The run file holds the commit, the address filmed and one line per criterion with the names of its clip and script; the moving preview is found by its file name. A run with nothing filmed gets its own number from the terminal, since there is nothing to upload.

## The intro, for fun

Every film crew needs a call sheet before the clapperboard snaps.

## The punchline, for fun

This one fits on an index card, and blank takes still get a slate number.

## The options, in plain words

A. A. The run file holds the commit, the address and the criteria, the preview is found by its name, and a run with nothing filmed is numbered by the terminal (built)
B. B. The run file also names the preview, and the Omni page always numbers the run, even with nothing to upload
C. C. Refuse to push a run with nothing filmed, printing a line instead

## What I had to decide

The shape of run.json that /omni:prove (s5) must write, how the GIF is found, and how an all-unfilmable run gets its id when the app's upload call refuses an empty file list.

## What I did meanwhile

run.json is {commit, url, criteria: [{text, verdict, note?, video?, script?}]}; preview.gif in the folder is uploaded when present; a run with no file skips the upload call and mints a random UUID for the register call. Local refusals print `refused (<status>): <reason>`, a 404 prints `none`, and a folder without run.json is exit 2.

## What it costs to change later

A constant: the file is written and read only by the kit, never stored; s5's skill text follows whatever shape is settled.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names run.json's contents only as the criteria, verdicts, notes and file names; commit and url are needed by the register call, and whether the app accepts a run id it did not mint rests on s2's register route, which only checks the id's form.

```

<!-- /omni-outbox-settled: s3-02-run-json-shape -->

<!-- omni-outbox-settled: s4-01-proof-link-lifetime -->

## s4-01-proof-link-lifetime — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-proof-link-lifetime
prd: 798
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

How long should a clip on the Proof tab stay playable before the page needs a reload?

## The decision, in plain words

Each clip and script link lasts one hour; after that, reloading the page gives fresh ones. The script's text is read by the server and shown in the fold, so nobody has to download it.

## The intro, for fun

Every video ticket on the Proof tab has an expiry time printed on it.

## The punchline, for fun

One hour felt long enough for popcorn, short enough to stay private.

## The options, in plain words

A. One hour, reload for fresh links: what was built: long enough to watch every clip, short enough that a copied link soon stops working.
B. Five minutes, like the GIF link: tighter, but a reviewer who pauses to read the spec comes back to dead players.
C. A day: never breaks during a review, but a copied clip link keeps working far longer.

## What I had to decide

Whether one hour is the right lifetime for the signed links the Proof tab hands to a viewer.

## What I did meanwhile

Links are signed for one hour, for the shown run only, and only on the Proof tab; script text is fetched server-side (3 s timeout, 64 KiB cap) and falls back to an Open it link.

## What it costs to change later

A constant in the page's proof read; changing it is one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the links are signed for the viewer but names no lifetime (author).

```

<!-- /omni-outbox-settled: s4-01-proof-link-lifetime -->

<!-- omni-outbox-settled: s4-02-proof-tab-place -->

## s4-02-proof-tab-place — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-proof-tab-place
prd: 798
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Where does the Proof tab sit among the PRD page's tabs, and what does its label count?

## The decision, in plain words

The Proof tab sits after Outbox and before Retro, the order things happen in, and its label counts the runs recorded.

## The intro, for fun

The tabs line up in the order a PRD lives its life.

## The punchline, for fun

Proof comes after the questions and before the goodbye party.

## The options, in plain words

A. After Outbox, badged with the runs: what was built: the order of the delivery, and how many times it was proved.
B. After Outbox, badged with the newest run's counts: shows the verdict at a glance, like 3 pass 1 fail, but crowds the bar on a phone.
C. Last, after Retro: keeps the existing tabs where they are, out of the order things happen in.

## What I had to decide

The Proof tab's place in the tab bar and what its badge reads.

## What I did meanwhile

Proof sits between Outbox and Retro, shown only once a run exists, badged with the number of runs (1 run, 2 runs).

## What it costs to change later

One list order and one label in the page's view.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the tab and when it appears, not its place or its badge (author).

```

<!-- /omni-outbox-settled: s4-02-proof-tab-place -->

<!-- omni-outbox-settled: s5-01-prove-help-group -->

## s5-01-prove-help-group — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-prove-help-group
prd: 798
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

Under which heading of the skills pages should the new proof skill appear?

## The decision, in plain words

It sits under Every day, beside the status and help skills, because the Build it list is pinned by a test of the web app that this slice was not given.

## The intro, for fun

The new skill arrived at the party and needed a table.

## The punchline, for fun

The builders' table was full, so it sat with the regulars.

## The options, in plain words

A. Every day, beside status and help (built)
B. Build it, after yolo-fix, with the web app's docs test updated
C. Run by other skills, since the yolo runs it

## What I had to decide

Whether the proof skill belongs under Every day or under Build it in the help and the docs.

## What I did meanwhile

The help entry has group everyday; the Build it list and the web app's docs test are unchanged.

## What it costs to change later

A constant: one word in the help entry, and one line in the web app's docs test to list it under Build it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the help entry but not its group; the web app's docs test pins the Build it list and lives outside this slice's ground.

```

<!-- /omni-outbox-settled: s5-01-prove-help-group -->

<!-- omni-outbox-settled: s5-02-proof-comment-gif-link -->

## s5-02-proof-comment-gif-link — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-proof-comment-gif-link
prd: 798
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

How does the proof comment on the pull request show the moving preview, when the sending step only gives back the page's link?

## The decision, in plain words

The sending step now prints the preview's public link on a second line, so the comment shows the moving preview whenever the run recorded one, as the spec asks.

## The intro, for fun

The trailer was shot, but nobody wrote down which cinema shows it.

## The punchline, for fun

So the cinema's address now goes on the poster.

## The options, in plain words

A. Leave the GIF out until the push prints its link
B. Change omni proof push to print the GIF's stable link on a second line (built)
C. Have the Proof tab link carry the run id, and build the GIF link from it

## What I had to decide

Whether the skill leaves the GIF out of the comment until omni proof push prints the run's GIF link, or whether that command changes to print it.

## What I did meanwhile

The skill embeds the GIF when omni proof push prints a second line. At the feature's finish, omni proof push was changed to print `<origin>/api/proofs/<run>/preview.gif` on that line whenever the run sent a `preview.gif`, which closes the gap with the spec.

## What it costs to change later

A small change: omni proof push prints <ask.url>/api/proofs/<run id>/preview.gif as a second line when the run holds preview.gif, and the skill already reads it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for the GIF embedded from its stable link, which needs the run id; the server mints it and omni proof push, outside this slice, never prints it.

```

<!-- /omni-outbox-settled: s5-02-proof-comment-gif-link -->
