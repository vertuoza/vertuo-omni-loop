# Settled outbox items — PRD 942

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-slice-waiting-reasons-left-to-wave-two -->

## s1-01-slice-waiting-reasons-left-to-wave-two — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-slice-waiting-reasons-left-to-wave-two
prd: 942
slice: s1
rank: medium
bears-on: none
raised: 2026-10-02
wave: 1
---

## The question, in plain words

The plan asks the first slice to remove every note saying a piece of code waits for another slice, but four such notes sit in files only later slices may change. Who removes them?

## The decision, in plain words

The first slice removed the seven notes in its own files and left the four others to the two later slices whose files hold them, so no slice steps on another's ground.

## The intro, for fun

Four old notes still say they are waiting for someone who already came.

## The punchline, for fun

They will be told the good news in the next wave.

## The options, in plain words

A. A. Leave the four notes to the later slices that own their files (built)
B. B. Widen the first slice's territory and clear them here
C. C. Clear them in a follow-up pull request after the feature branch is done

## What I had to decide

Whether the four leftover notes are cleared by the later slices that own their files, or by a follow-up to the first slice.

## What I did meanwhile

The later slices for the kit and the App own those files and are asked by the plan to give every cast a true reason, so they clear the notes as they pass.

## What it costs to change later

Low: if the later slices miss them, a one-line change per note fixes it before the feature ships.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant the first slice to reach outside its territory for these four notes (author)

```

<!-- /omni-outbox-settled: s1-01-slice-waiting-reasons-left-to-wave-two -->

<!-- omni-outbox-settled: s2-01-thrown-values-read-as-text -->

## s2-01-thrown-values-read-as-text — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-thrown-values-read-as-text
prd: 942
slice: s2
rank: medium
bears-on: none
raised: 2026-10-02
wave: 2
---

## The question, in plain words

When the tool fails with something that is not a normal error, which only happens through a mistake in the tool itself, what should its one-line message say?

## The decision, in plain words

The message now shows what was thrown, as text, where it used to show the word undefined or crash. Normal errors read exactly as before.

## The intro, for fun

Some failures arrive without a label, like a parcel with no address.

## The punchline, for fun

Now we at least read what is written on the box.

## The options, in plain words

A. A. Read a non-Error throw as text, through the shared helper (built)
B. B. Keep the old reading: the cast and its reason stay in those places
C. C. Treat a non-Error throw as a crash, with its own message

## What I had to decide

Whether a thrown value that is not an Error should keep reading as nothing (as the removed cast let it), or be read as text by the shared helper that replaced the cast.

## What I did meanwhile

The kit's errorMessage, and the yaml and plan parse failures in config, forms and plan grading, read what was thrown through messageOf: an Error's message, else the value as text. Every kit module throws an Error, so no output a test pins changed; a new test pins both readings.

## What it costs to change later

Low: putting back the old reading is one line in errorMessage, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec forbids behaviour change, but does not say whether a path only a kit bug can reach counts

```

<!-- /omni-outbox-settled: s2-01-thrown-values-read-as-text -->

<!-- omni-outbox-settled: s3-01-list-answer-checked-per-page -->

## s3-01-list-answer-checked-per-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-list-answer-checked-per-page
prd: 942
slice: s3
rank: medium
bears-on: none
raised: 2026-10-02
wave: 2
---

## The question, in plain words

When GitHub answers a request for a list with something that is not a list, should the app say so plainly, or fail the way it did before?

## The decision, in plain words

The app now checks that each page is a list and, when it is not, fails with a message naming the request instead of a generic programming error. Lists GitHub answers normally read exactly as before.

## The intro, for fun

GitHub was asked for a list and, once in a blue moon, might hand back something else.

## The punchline, for fun

Now the app names the odd answer instead of tripping over it.

## The options, in plain words

A. A. Check each page is a list and fail naming the request (built).
B. B. Put the casts back with their reasons and keep the old generic error.

## What I had to decide

Whether a malformed list answer should fail with a message naming the request (built) or with the old generic error.

## What I did meanwhile

A list answer that is not a list fails with 'GitHub answered the open pull requests unexpectedly: (answer): …' in the knowledge harvest, and 'GET …/events answered an unexpected shape: …' in the retro's timeline, instead of a TypeError. Both still fail, and the timeline still treats only a 403 or 404 as unreadable.

## What it costs to change later

A constant: putting the old cast back in two places restores the old error.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test drives a non-list answer through the harvest or the timeline end to end; only ListSchema itself is tested with one (author).

```

<!-- /omni-outbox-settled: s3-01-list-answer-checked-per-page -->

<!-- omni-outbox-settled: s7-01-database-reads-keep-a-marked-cast -->

## s7-01-database-reads-keep-a-marked-cast — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-database-reads-keep-a-marked-cast
prd: 942
slice: s7
rank: medium
bears-on: none
raised: 2026-10-02
wave: 2
---

## The question, in plain words

The dashboard and the profile read rows from the database without checking their shape. Should those reads check each row as it arrives, or keep trusting the database and say so plainly?

## The decision, in plain words

The reads keep trusting the database, as they did before, and each place that trusts it now says why in a short note. Nothing the pages show changes.

## The intro, for fun

Seven database reads walked in without showing a ticket.

## The punchline, for fun

They now wear a badge saying who let them in.

## The options, in plain words

A. Keep one marked cast per read, naming the untyped client (built)
B. Check each read's rows against a schema as they arrive, as the people page already does for the roster
C. Type the client with the generated database types and narrow what they leave loose

## What I had to decide

Whether the dashboard's and the profile's database reads keep a marked cast, or parse each row with a schema at the boundary as the architecture form's pattern asks.

## What I did meanwhile

Each of the seven reads keeps one cast, the double cast through unknown narrowed to a single one, with a reason naming the untyped client. A schema parse would turn a malformed row into an unreadable part, a behaviour change the PRD keeps out of scope; the people page's loader already shows the schema route for the roster if it is wanted.

## What it costs to change later

Low: swapping a cast for a schema parse is a local edit per read, with no stored shape or contract touched.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the stored answered count can arrive as text, which the loader's Number() suggests and a schema would have to allow (author)
- Whether the PRD wanted schema parses wherever a value comes from outside, or only where a cast could not be given a true reason (author)

```

<!-- /omni-outbox-settled: s7-01-database-reads-keep-a-marked-cast -->

<!-- omni-outbox-settled: s11-01-ceilings-file-names-the-arcade -->

## s11-01-ceilings-file-names-the-arcade — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-10-02T10:19:46Z
- Channel: feature pull request #943
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/943#issuecomment-5950218333
- Basis: contradiction-marker — the answer says "no", "not", which reads as a change to the recorded choice
- Closed: no — the build and the decision disagree until a rework sub-PR brings them back in line (/omni:yolo-fix)
- Rank: high
- Became: playbook/architecture#boundaries
- Bears on: ADR-0002
- Raised: 2026-10-02
- Slice: s11
- Wave: 3

### The answer, as it was given

```text
A proper fix, not a stop gap: the TypeScript guard checks the whole repository, so it is repository tooling, not a kit test. Move kit/test/typescript-guard.test.ts to scripts/typescript-guard.test.ts and kit/test/typescript-ceilings.json to scripts/typescript-ceilings.json, and take the exception back out of kit/test/no-game-words.test.ts. The kit then names the game nowhere, with no carve-out.
```

### The item, as it was raised

```text
---
id: s11-01-ceilings-file-names-the-arcade
prd: 942
slice: s11
rank: high
bears-on: ADR-0002
raised: 2026-10-02
wave: 3
---

## The question, in plain words

The new file that sets how many type escape hatches each part of the repository may keep has to name the arcade's folder, and the kit's own rule forbids any kit file but a test from naming the game. Is it right to treat that one file as part of the test that reads it?

## The decision, in plain words

The file stays where the spec puts it, under the kit's test folder, and the rule that keeps the game's name out of the kit now leaves exactly that one file alone, since only a test reads it and it never ships.

## The intro, for fun

A list of limits had to name the arcade, in the one place that never says its name.

## The punchline, for fun

So the list got a backstage pass, valid for one file and no other.

## The options, in plain words

A. A. Treat the ceilings file as the guard test's own data: a one-file exception in the word rule, proven narrow by a fixture (built)
B. B. Move the ceilings file out of the kit folder, beside the repository's root, so the word rule needs no exception
C. C. Keep the file, but key the arcade's area by a name without the game's word, and let the guard's messages use that name

## What I had to decide

Whether the ceilings file may name the arcade's area as the test it serves does, or must move or be renamed so the kit's word rule needs no exception.

## What I did meanwhile

The ratchet works as the spec describes, with its file at the path the spec names and its areas named as the spec names them; the word rule ignores that one file and still refuses the word in every other file under the kit but a test.

## What it costs to change later

Undoing it is one line in the word rule's test plus moving or renaming the ceilings file and the one constant in the TypeScript guard that points at it; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Neither the spec nor ADR-0002 says whether a data file only a test reads counts as part of that test; this reading is the author's own. (author)

```

<!-- /omni-outbox-settled: s11-01-ceilings-file-names-the-arcade -->
