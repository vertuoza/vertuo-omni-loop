# Settled outbox items — PRD 871

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-constituents-check-in-ci -->

## s1-01-constituents-check-in-ci — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-constituents-check-in-ci
prd: 871
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The new database check for constituents only runs on pull requests if the database workflow lists it, and that workflow sits outside this slice's area. Should the slice add it there?

## The decision, in plain words

I added one step to the database workflow so every pull request runs the constituents check, beside the business and Jev checks.

## The intro, for fun

A brand new safety check that nobody runs is just a very tidy file.

## The punchline, for fun

So it got a seat on the bus with the other checks.

## The options, in plain words

A. A. Keep the step in the database workflow, added by this slice.
B. B. Drop the step here and add it in a follow-up change.
C. C. Run the constituents check from inside the business check instead.

## What I had to decide

Keep the extra step in the database workflow, or move it to a separate change.

## What I did meanwhile

Every pull request touching the database runs the constituents check.

## What it costs to change later

Removing the step is a one-line change; nothing else depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no owner for the database workflow file; I took it as the slice that writes the check. (author)

```

<!-- /omni-outbox-settled: s1-01-constituents-check-in-ci -->

<!-- omni-outbox-settled: s1-02-statement-shape-and-never-numbers -->

## s1-02-statement-shape-and-never-numbers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-statement-shape-and-never-numbers
prd: 871
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The spec does not say how long a product's Statement may be, whether it can be removed, or whether Never line numbers count per product or per workspace.

## The decision, in plain words

A Statement is one line of up to 400 characters, an owner can remove it and write a new one, and Never line numbers count per product, so each product starts at number one.

## The intro, for fun

Every product gets one sentence about who it is, like a dating profile but stricter.

## The punchline, for fun

Four hundred characters, one line, no novels.

## The options, in plain words

A. A. One line up to 400 characters, removable, Never numbers per product.
B. B. Allow several lines in the Statement, up to 1000 characters.
C. C. Count Never numbers across the whole workspace instead of per product.

## What I had to decide

Confirm the Statement length and the per product numbering, or pick other limits.

## What I did meanwhile

Owners type Statements up to 400 characters on one line, and each product numbers its own Never lines from one.

## What it costs to change later

Changing the length is one small database change; renumbering Never lines after people cite them would be costly.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Nothing in the spec or the knowledge base sets a Statement length; 400 is my pick from the proposed Statements, which run about 150 characters. (author)

```

<!-- /omni-outbox-settled: s1-02-statement-shape-and-never-numbers -->

<!-- omni-outbox-settled: s2-01-hide-never-claims -->

## s2-01-hide-never-claims — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-hide-never-claims
prd: 871
slice: s2
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

Once the old Never lines have moved into the new Never list, should the old copies still show on the Business page, under Marked wrong?

## The decision, in plain words

The Business page no longer shows any old Never line among the claims, not even the moved copies kept as wrong. They stay stored, so a later change can bring them back.

## The intro, for fun

Every line moved house, but the old address still had its name on the door.

## The punchline, for fun

We took the name off the door and kept the key in a drawer.

## The options, in plain words

A. Hide every Never claim from the Business page (built).
B. Keep the moved ones listed under Marked wrong, with no way to confirm them again.
C. Keep them under Marked wrong as before, the ✓ refused by the database.

## What I had to decide

Whether the moved Never lines should stay visible as wrong claims, or vanish from the Business page as built.

## What I did meanwhile

The Business page draws no claim of the Never kind. The moved ones stay in the database as rejected, untouched.

## What it costs to change later

Showing them again is one filter removed in the page; no stored data changes either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the Never kind leaves the claim editor and the moved claims are kept rejected, but not whether the page still lists them under Marked wrong (author).

```

<!-- /omni-outbox-settled: s2-01-hide-never-claims -->

<!-- omni-outbox-settled: s2-02-history-times-in-utc -->

## s2-02-history-times-in-utc — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-history-times-in-utc
prd: 871
slice: s2
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

In the History drawer of the product's lines, should each change's date and time read in the reader's own time zone or in one shared time?

## The decision, in plain words

Every change shows its date and time in UTC, the same for every reader, so every reader sees the same moment.

## The intro, for fun

Two owners in two cities argued over when the line was edited.

## The punchline, for fun

We gave them one clock, and both of them grumbled equally.

## The options, in plain words

A. UTC for everyone, the same on the server and in the browser (built).
B. The reader's local time, drawn in the browser after the page loads.
C. A relative time (3 h ago) with the exact UTC time beside it.

## What I had to decide

Whether the History drawer should show times in the reader's local time instead of UTC.

## What I did meanwhile

Times read like 1 Oct 2026, 09:12 UTC, drawn the same on the server and in the browser.

## What it costs to change later

Switching to local time is a change to one formatting function and its test; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks for the date and time of each event but does not say in which time zone (author).

```

<!-- /omni-outbox-settled: s2-02-history-times-in-utc -->

<!-- omni-outbox-settled: s3-01-constituents-call-in-shared-client -->

## s3-01-constituents-call-in-shared-client — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-constituents-call-in-shared-client
prd: 871
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

The new startup command needs one call to the page that serves the product's limits, and adding it touched three files outside this slice's area: the shared web client and two tests that count the commands and the startup hooks. Is that the right place for them?

## The decision, in plain words

I added the one call to the shared web client, beside the business call, and updated the two counting tests so they include the new command and the new startup hook.

## The intro, for fun

A new command walked in and the head count was off by one.

## The punchline, for fun

So the tests learned to count to forty.

## The options, in plain words

A. A. Keep the call in the shared client and the two updated counting tests.
B. B. Write a small web caller inside the new command's own folder and leave the shared client alone.
C. C. Leave the counting tests to a follow-up change.

## What I had to decide

Keep the call in the shared client and the two updated counts, or move the call into the new command's own folder.

Decided by: Jev (hardToRevert 0.64) · agent said false

## What I did meanwhile

The command reads the page through the same client as every other terminal call, with the same sign-in renewal.

## What it costs to change later

Moving the call later is a few lines in two files; nothing stored depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists the new command's files but not the shared client, nor the two tests whose counts any new command or hook changes. (author)

```

<!-- /omni-outbox-settled: s3-01-constituents-call-in-shared-client -->

<!-- omni-outbox-settled: s4-02-settings-test-outside-territory -->

## s4-02-settings-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-settings-test-outside-territory
prd: 871
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

Adding the new decision to the Jev settings page made one existing page test expect three rows instead of four, and that test sits outside this slice's ground. Should the slice fix it, and who documents the judge's new shared secret?

## The decision, in plain words

The slice updated that one test so it expects the fourth row, and left the new shared secret out of the Galaxy example settings file, also outside its ground, for whoever sets it on the deployments.

## The intro, for fun

A fourth guest arrived and the seating chart still counted three.

## The punchline, for fun

One chair added, and a note left on the door about the new key.

## The options, in plain words

A. Update the one test now and leave the example settings file to whoever sets the secret.
B. Leave the test red for a later slice, staying inside the ground but merging the wave red.
C. Also add the secret to the Galaxy example settings file now, one more file outside the ground.

## What I had to decide

Whether a slice may update a test outside its territory that its own registry change breaks, and where the new secret is documented.

## What I did meanwhile

apps/galaxy/src/jev/settings/render.test.ts now lists constituent-break as the fourth row with its Sends line and Save form. CONSTITUENT_JUDGE_SECRET is not in apps/galaxy/.env.example; it must be set on Galaxy and on omni-app (s5) before the judge answers.
Decided by: Jev (hardToRevert 0.74) · agent said false

## What it costs to change later

Reverting the test change is one line; documenting the secret is two lines in the env example.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The env example and the deployment's secret are not covered by any slice's territory in the plan (author)

```

<!-- /omni-outbox-settled: s4-02-settings-test-outside-territory -->
