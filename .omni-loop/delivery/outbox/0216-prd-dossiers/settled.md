# Settled outbox items — PRD 216

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-draft-choice-guards -->

## s1-01-draft-choice-guards — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-draft-choice-guards
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The spec says a push numbers the draft this Claude session opened, or else the only unnumbered draft on the computer. That second rule can take a draft another brainstorm opened at the same time: should the push be stricter?

## The decision, in plain words

Yes, a little: a terminal that knows its Claude session never takes a draft another session opened, and once a PRD was numbered from this computer, a later push of it takes no other draft. Without a session id, the spec's rule stands as written.

## The intro, for fun

Two brainstorms shared one notebook of drafts, and a push came looking for its page.

## The punchline, for fun

It now reads the name on the page before tearing it out.

## The options, in plain words

A. Keep both guards: never another session's draft, and no other draft once the PRD was numbered here
B. Follow the spec to the letter: this session's draft, else the only unnumbered one, whoever opened it
C. Keep only the first guard, and still take the only unnumbered draft after the PRD was numbered here

## What I had to decide

Follow the spec's second rule to the letter, or keep a push from numbering a draft another brainstorm opened, which would merge that brainstorm into the wrong PRD.

## What I did meanwhile

A push takes this session's own draft first. From a terminal with a session id it never takes a draft another session opened, and after PRD n was numbered on this computer, later pushes of n reach its dossier by its key.

## What it costs to change later

One small function in the kit and its tests: dropping a guard is deleting two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a brainstorm ever runs across two Claude sessions (after clearing the conversation, say) is unknown; then the second session's push leaves the first session's draft unnumbered (author).

```

<!-- /omni-outbox-settled: s1-01-draft-choice-guards -->

<!-- omni-outbox-settled: s1-04-push-retitles-and-dates-merge -->

## s1-04-push-retitles-and-dates-merge — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-push-retitles-and-dates-merge
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

Each push carries the spec's title, and a draft numbered to a dossier the fallback already made is merged into it. Should every push rename the dossier, and which opening date should a merged dossier keep?

## The decision, in plain words

Every push sets the title to the spec's latest one. A merged dossier keeps the earlier opening date, the draft's, so the questions asked during that brainstorm still belong to it.

## The intro, for fun

The draft arrived first, and the fallback's copy arrived later with all the paperwork.

## The punchline, for fun

The dossier now remembers who was actually early.

## The options, in plain words

A. Retitle on every push, and date a merged dossier from the earlier opening
B. Title a dossier only when it is created or numbered, and keep the fallback's date on a merge
C. Retitle on every push, but keep the fallback's date on a merge

## What I had to decide

Rename the dossier on every push or only once, and keep the fallback's date or the draft's when the two merge.

## What I did meanwhile

The title follows the spec on every push, and a merge dates the dossier from the draft's opening.

## What it costs to change later

One line each in the database function and the test fake; no row changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The questions slice reads the opening date for its brainstorm rule; it is assumed to read this same date (author).

```

<!-- /omni-outbox-settled: s1-04-push-retitles-and-dates-merge -->

<!-- omni-outbox-settled: s1-05-version-numbers-counted -->

## s1-05-version-numbers-counted — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-version-numbers-counted
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

Versions show as v1, v2 and v3, but the spec's tables hold no version number. Should the number be stored, or counted from the order the versions were added?

## The decision, in plain words

It is counted: a version's number is its place among the versions of its kind, by the time it was added. Each version is timed as it is written, after the dossier is locked, so the newest is always the last added.

## The intro, for fun

Every version wanted a number on its shirt, and nobody had printed any.

## The punchline, for fun

They now line up by arrival and count off.

## The options, in plain words

A. Count each version's place among its kind, by the time it was added
B. Store a number on each version, unique for its dossier and kind

## What I had to decide

Store a number on each version, or count them.

## What I did meanwhile

A push answers each added version's number by counting, and the page slices can count the same way.

## What it costs to change later

Storing a number later is one additive migration, filled from the same order.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None beyond the spec: two versions of one kind are never added at the same moment, since a push holds the dossier's lock (author).

```

<!-- /omni-outbox-settled: s1-05-version-numbers-counted -->

<!-- omni-outbox-settled: s1-06-dossier-command-lines -->

## s1-06-dossier-command-lines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-06-dossier-command-lines
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The spec lists the command's lines and exit codes, but not which stream carries them, how a push ends when one file is too large, or what a missing PRD folder is.

## The decision, in plain words

A skip line goes to the error stream and a result to the normal one; a push with a file too large still sends the others, names that file and ends as skipped. The status line never fails, and a PRD with no folder is a usage mistake.

## The intro, for fun

One file was too big for the suitcase, so the others flew without it.

## The punchline, for fun

A note in the suitcase says which one stayed home.

## The options, in plain words

A. Skip lines on the error stream, a partly sent push ends as skipped, and a missing folder is a usage mistake
B. Every line on the normal stream, so a skill reads one place
C. A partly sent push ends as done, with the file too large named as a warning

## What I had to decide

Which stream carries which line, and how a partly sent push ends.

## What I did meanwhile

The two small skills of the next wave print whatever the command printed, on either stream.

## What it costs to change later

A few constants in the command and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The skills are not written yet; they are assumed to show both streams (author).

```

<!-- /omni-outbox-settled: s1-06-dossier-command-lines -->

<!-- omni-outbox-settled: s1-07-fallback-writes-through-grants -->

## s1-07-fallback-writes-through-grants — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-07-fallback-writes-through-grants
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The fallback slice may not add a database migration, yet it must create dossiers and add versions as the service account. What should this slice give it?

## The decision, in plain words

The service account may read both tables, create a dossier by its key and rename it, and add versions only through the version rule the kit's push uses. It may not delete anything or write a version directly.

## The intro, for fun

The night shift needed a key, and the building only had master keys.

## The punchline, for fun

We cut one that opens the front door and the mail slot.

## The options, in plain words

A. Table rights to read, create and rename, and the version rule for versions
B. One function for the fallback that finds or creates the dossier and adds its versions in one call
C. Nothing now: the fallback slice adds what it needs, outside its listed files

## What I had to decide

Give the fallback a few table rights plus the version rule, or one function that does its whole job.

## What I did meanwhile

The fallback slice can create dossiers with its table rights and call the version rule for each changed file.

## What it costs to change later

Moving to a single function later is one migration and a change in the fallback's script.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The fallback's exact reads are not designed yet; it may need a right this slice did not grant (author).

```

<!-- /omni-outbox-settled: s1-07-fallback-writes-through-grants -->

<!-- omni-outbox-settled: s2-01-sign-in-joins-workspace -->

## s2-01-sign-in-joins-workspace — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-sign-in-joins-workspace
prd: 216
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

Someone opening a PRD link for the first time may not belong to its workspace yet, because they have never signed in to the galaxy. Should signing in from the PRD's page also make them a member, as signing in from the game does?

## The decision, in plain words

Yes. Signing in from a PRD's page adds the person to the workspace of their company email, as signing in from the game already does, before the page is shown to them.

## The intro, for fun

A product owner followed a link from a chat and knocked on a door that had never heard of them.

## The punchline, for fun

Now the door checks their company badge first, then opens.

## The options, in plain words

A. Join the person's workspaces when they sign in from the PRD page, as the game's sign-in does
B. Join nobody there: a first-time visitor gets not found until they open the game once
C. Join on every visit to the page, not only at sign-in

## What I had to decide

Join the person to the workspaces of their email domain when they sign in from the PRD page, or leave joining to the other pages and show not found until they have visited one.

## What I did meanwhile

The PRD page's sign-in return joins the person to the workspaces of their confirmed email domain, as the arcade's sign-in does. A failure to join is logged, and the page then says not found.

## What it costs to change later

One call in the page's sign-in return; removing it changes nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the pages sign in like the ask pages, whose own sign-in returns do not join; whether they leave joining out on purpose is not written anywhere.

```

<!-- /omni-outbox-settled: s2-01-sign-in-joins-workspace -->

<!-- omni-outbox-settled: s2-02-dossier-times-in-utc -->

## s2-02-dossier-times-in-utc — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-dossier-times-in-utc
prd: 216
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The PRD's page shows when it was opened and the day each version arrived. Whose clock should those times follow?

## The decision, in plain words

Universal time, marked as such, the same for every reader, as the question history page already does. The version picker shows the day only, as the spec's own example does.

## The intro, for fun

A PRD was opened at nine o'clock, which raised the question: nine where?

## The punchline, for fun

The page settled it the way sailors do: one universal clock, and it says so.

## The options, in plain words

A. Universal time, marked as such
B. Each reader's own time zone, taken from their browser
C. The workspace's own time zone, once a workspace carries one

## What I had to decide

Show times in universal time, or in each reader's own time zone.

## What I did meanwhile

The header reads like 27 Sep 2026, 09:12 UTC and each version reads like 27 Sep, both in universal time, so the server and every browser write the same thing.

## What it costs to change later

One formatting function; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the people reading these pages work in more than one time zone is not written anywhere; the history page's own choice was followed.

```

<!-- /omni-outbox-settled: s2-02-dossier-times-in-utc -->

<!-- omni-outbox-settled: s2-03-mockup-version-address -->

## s2-03-mockup-version-address — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-mockup-version-address
prd: 216
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The before-and-after mockup is shown from an address of its own that names a version. Should it name the version by the number people read, v1 or v2, or by a hidden identifier that never changes?

## The decision, in plain words

By the number people read, counted per artifact from the oldest, which matches the version picker and reads well in a shared link. When a draft is joined to a PRD the repository reading had already found, both sets of versions are counted together by date, so a number may then point elsewhere.

## The intro, for fun

Every mockup got a house number, counted from the oldest house on the street.

## The punchline, for fun

If two streets ever merge, the numbers may shuffle, so the page says which street it counted.

## The options, in plain words

A. The version's number, counted per artifact from the oldest
B. The version's stored identifier, which never changes
C. The number in the address, with the identifier added as a check

## What I had to decide

Name a before/after version in its address by its number, or by its stored identifier.

## What I did meanwhile

The sandboxed route takes the version's number among the versions of its kind, oldest first: the same number the picker shows and the version rule returns when it adds one.

## What it costs to change later

How the page builds and reads one address; nothing stored changes, but links already shared to one version would stop working.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a link to one version must keep pointing at the same content after a draft is merged into a dossier the fallback created is not written in the spec.

```

<!-- /omni-outbox-settled: s2-03-mockup-version-address -->

<!-- omni-outbox-settled: s2-04-tab-and-version-in-address -->

## s2-04-tab-and-version-in-address — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-04-tab-and-version-in-address
prd: 216
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The PRD's page has a tab per artifact and a version picker. Where should the chosen tab and version be kept, and which tab should open first?

## The decision, in plain words

They are kept in the page's address, so every view is a link that can be shared and the page works before any script runs. The before-and-after page opens first, since it is what a product owner comes for.

## The intro, for fun

The tabs were asked where they live, and each one answered with its full address.

## The punchline, for fun

Share the link, and the reader lands on the very same version of the very same tab.

## The options, in plain words

A. In the address, with the before-and-after page first
B. In the address, with the spec first
C. In the page only, so the address never changes

## What I had to decide

Keep the tab and the version in the address or only in the page, and pick the tab that opens first.

## What I did meanwhile

The address carries the tab and the version; with neither, the page opens the before/after tab at its latest version. The picker is a form that sends its choice to the same address.

## What it costs to change later

A constant and the page's links; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists the tabs in an order but does not say which one opens first.

```

<!-- /omni-outbox-settled: s2-04-tab-and-version-in-address -->

<!-- omni-outbox-settled: s5-01-skill-checks-outside-ground -->

## s5-01-skill-checks-outside-ground — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-skill-checks-outside-ground
prd: 216
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The spec asks the plugin's test file to check that the two new skills exist and that the brainstorm and the plan call them, but that file is outside the ground this slice was given. Should the slice add those checks there anyway?

## The decision, in plain words

Yes. The checks were added to the plugin's test file: no other slice of this wave touches it, and without them nothing would notice a later edit dropping one of the calls.

## The intro, for fun

The test file sat just past the fence, and the slice had a ball to throw.

## The punchline, for fun

It threw the ball over, and wrote down that it did.

## The options, in plain words

A. A. Add the checks to the plugin's test file, outside the slice's ground
B. B. Keep to the ground: no new check, only the guards that already run on every skill
C. C. Keep the checks, and widen the plan so the slice's ground names that test file

## What I had to decide

Add the checks the spec names in a file outside the slice's ground, or keep to the ground and leave the new calls unchecked.

## What I did meanwhile

The plugin's test file has one new block checking both skills and the four calls, each after what it must follow. Nothing else outside the ground changed.

## What it costs to change later

Deleting one block of tests. Nothing depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan only asks that this test file stay green; whether leaving it out of the slice's ground was deliberate is unknown.

```

<!-- /omni-outbox-settled: s5-01-skill-checks-outside-ground -->

<!-- omni-outbox-settled: s7-01-fallback-compares-latest -->

## s7-01-fallback-compares-latest — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-fallback-compares-latest
prd: 216
slice: s7
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The background reader that copies each PRD's files from the main branch fetches a file only when the PRD's record does not hold it yet. Should that mean the last version kept, or any version ever kept?

## The decision, in plain words

The last version kept, so a file that goes back to an earlier wording is kept as a new version, as the record's rule asks. When that last version came from someone's terminal, the reader compares it with the file without fetching the file again.

## The intro, for fun

A file changed its mind and went back to how it read last Tuesday.

## The punchline, for fun

The record noticed, and kept Tuesday's words as its newest page.

## The options, in plain words

A. Compare each file with the latest version of its kind, and hash a terminal upload's stored text when the sizes match
B. Compare with any version ever kept: fewer fetches, but a file that returns to an earlier wording is never recorded again
C. Fetch every file at every run and let the record's rule decide: simplest, but many more requests to GitHub

## What I had to decide

Whether the reader compares each file on the main branch with the latest version of its kind, or with every version the record already holds.

## What I did meanwhile

The reader compares each file with the latest version of its kind. A version uploaded from a terminal carries no file hash from the repository, so when the sizes match the reader hashes the stored text itself, instead of asking GitHub for the file again.

## What it costs to change later

One comparison and its tests change; nothing stored changes, and the next run follows the new rule.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the reader fetches only the files the record has not stored, and also that content going back to an earlier state is still a new version. Read literally, the first rule would skip that return, so I followed the version rule.

```

<!-- /omni-outbox-settled: s7-01-fallback-compares-latest -->

<!-- omni-outbox-settled: s3-01-rounds-own-workspace -->

## s3-01-rounds-own-workspace — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-rounds-own-workspace
prd: 216
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

The spec links questions to a PRD in two ways: by the terminal session that brainstormed it, and by the PRD's number in its home repository. Should those links also stay inside the workspace the PRD belongs to?

## The decision, in plain words

Yes: a PRD shows only questions asked in its own workspace, and only that workspace's PRDs close a brainstorm. Everyone who can open the PRD sees the same list, and someone in two workspaces never sees one workspace's questions on the other's PRD.

## The intro, for fun

A question wandered into the wrong workspace and asked to be counted.

## The punchline, for fun

It was shown the door, politely, and counted where it belonged.

## The options, in plain words

A. Only questions from the PRD's own workspace, the same list for every reader
B. Every question the reader may open in any of their workspaces, so two readers may see different lists
C. Keep the brainstorm link inside the PRD's workspace, and let the delivery link look wherever the reader can

## What I had to decide

Whether the two linking rules look at every workspace the reader can open, or only at the dossier's own workspace.

## What I did meanwhile

The database function and the page's fake store limit both rules to the dossier's workspace: the ask sessions they read, and the dossier that ends a brainstorm window. The access checks prove that a member of two workspaces sees only the dossier's own workspace's rounds, and that another workspace's dossier with the same Claude session ends nothing.

## What it costs to change later

A change to one function in a follow-up migration. Nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) In practice both rules already stay in one workspace: a dossier and its terminal's ask sessions are placed by the same person and repository. Only an account in two workspaces can tell the difference, and the spec does not say which list it should see.

```

<!-- /omni-outbox-settled: s3-01-rounds-own-workspace -->

<!-- omni-outbox-settled: s3-02-questions-count-rounds -->

## s3-02-questions-count-rounds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-questions-count-rounds
prd: 216
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

The Questions tab shows how many questions were answered out of those asked. When Claude asks several questions at once, does that count as one or as one per question?

## The decision, in plain words

As one: each time Claude asks counts once, and it is answered when all of it is answered. The list shows the same thing, one card each, so a card holding three questions counts once.

## The intro, for fun

Three questions arrived in one envelope and argued about who gets counted.

## The punchline, for fun

The envelope counts. The questions share a stamp.

## The options, in plain words

A. Count each time Claude asks, one card each
B. Count every question inside it, so one card may count as three

## What I had to decide

Whether the tab's count, and the counts later slices build from the same list, count each ask or each question inside it.

## What I did meanwhile

The page counts rounds: one AskUserQuestion call each, answered or not as a whole, so the count matches the cards listed. The history list and the planet's tab of later slices read the same rows.

## What it costs to change later

A constant in the page's view, and the same in the later slices that count too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says answered out of asked, and for the planet n asked and n answered, without saying what one is; its user story speaks of eleven of twelve questions.

```

<!-- /omni-outbox-settled: s3-02-questions-count-rounds -->

<!-- omni-outbox-settled: s3-03-questions-oldest-first -->

## s3-03-questions-oldest-first — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-questions-oldest-first
prd: 216
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

In what order should the Questions tab list what was asked, and should it keep the questions nobody answered?

## The decision, in plain words

Oldest first, as the story happened: the brainstorm's questions, then those asked while the PRD was built. A question nobody answered stays in the list and says so.

## The intro, for fun

The questions lined up by age, and the youngest complained about the queue.

## The punchline, for fun

It was told the story starts at the beginning.

## The options, in plain words

A. Oldest first, the story in order, unanswered questions kept
B. Newest first, like the workspace's question history
C. Brainstorm questions first, then delivery questions, each newest first

## What I had to decide

The order of the list, and whether questions never answered are shown.

## What I did meanwhile

The tab lists every round oldest first, each marked brainstorm or delivery, and shows open and abandoned rounds as not answered, so the count in the tab's label matches the list.

## What it costs to change later

A constant in the page's view.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists what each round shows but not their order; the workspace's question history lists newest first.

```

<!-- /omni-outbox-settled: s3-03-questions-oldest-first -->

<!-- omni-outbox-settled: s4-01-last-activity-counts-answers -->

## s4-01-last-activity-counts-answers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-last-activity-counts-answers
prd: 216
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 4
---

## The question, in plain words

The list of PRDs puts the most recently active first, and the spec says activity is the latest version or question. Does an answer count as activity, and what about a draft nobody has touched since it was opened?

## The decision, in plain words

An answer counts, as much as a question being asked, and so do opening the dossier and giving it its number. A draft nobody touched sits at the date it was opened, below the ones people are working on.

## The intro, for fun

Two drafts sat at the bottom of the list, each claiming it had been busy.

## The punchline, for fun

The one with an answer this morning won the argument.

## The options, in plain words

A. Count the opening, the numbering, every version, and every question asked or answered
B. Count only versions and questions asked, as the spec words it, with the opening for a dossier that has neither
C. Count versions only, so questions never move a PRD up the list

## What I had to decide

What moves a dossier up the list: only a new version or a question asked, as the spec words it, or also an answer, its opening and its numbering.

## What I did meanwhile

The last activity is the latest of the opening, the numbering, every version, and every question asked or answered. The list and the planet's tab of the next slice read the same value.

## What it costs to change later

One line in the database function that lists the dossiers, and the same line in the test double; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says newest activity first, the latest version or question, without saying whether answering a question is activity or where a dossier with neither sits.

```

<!-- /omni-outbox-settled: s4-01-last-activity-counts-answers -->

<!-- omni-outbox-settled: s4-02-search-every-word-of-title -->

## s4-02-search-every-word-of-title — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-search-every-word-of-title
prd: 216
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 4
---

## The question, in plain words

The list of PRDs has a search over titles. When someone types several words, must a PRD's title hold all of them, or is one enough?

## The decision, in plain words

All of them, in any order and in any case, and a word also matches inside a longer one. This is how the question history's search already behaves, so the two searches feel the same.

## The intro, for fun

Someone typed three words into the search box and expected the list to listen to all three.

## The punchline, for fun

It did. Titles holding one word out of three stayed home.

## The options, in plain words

A. Keep a PRD when its title holds every word typed, as the question history's search does
B. Keep a PRD when its title holds any of the words typed
C. Match the words typed as one phrase, in that order

## What I had to decide

Whether a search with several words keeps the titles holding every word, or the titles holding any of them.

## What I did meanwhile

The search keeps a PRD when each word typed appears somewhere in its title, ignoring case, as the question history's search does with questions and answers.

## What it costs to change later

One line of the page's filtering; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a search finds a dossier by a word of its title, without saying what several words mean together.

```

<!-- /omni-outbox-settled: s4-02-search-every-word-of-title -->
