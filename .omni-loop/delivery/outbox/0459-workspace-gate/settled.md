# Settled outbox items — PRD 459

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-install-link-added-by-app -->

## s1-01-install-link-added-by-app — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-install-link-added-by-app
prd: 459
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When nobody's workspace owns a repository yet, who writes the link to install the Omni App: the database or the web app?

## The decision, in plain words

The database says no workspace owns the repository yet and to install the Omni App; the web app adds the install link it already knows, so the link follows whichever App a deployment uses.

## The intro, for fun

Every refusal deserves a door, and every door deserves a doorknob.

## The punchline, for fun

The database names the door; the web app hands over the knob.

## The options, in plain words

A. The database ends with the hint and the web app adds its own install link, so preview and production each link their own App.
B. The database writes the whole sentence with the link fixed in the migration, so nothing is added after it.
C. Leave the link out everywhere and let the guide tell people where to install the App.

## What I had to decide

Whether the install link belongs in the database's message or is added by the web app from its own App setting.

## What I did meanwhile

Refusals for an unowned repository end with the install link wherever the web app knows the App's name, and with the hint alone where it does not.

## What it costs to change later

A constant: moving the link into the database is one follow-up migration and deleting a small helper.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The web app recognises the database's hint by its closing words, so rewording that sentence in the database means changing the helper's constant too (author).

```

<!-- /omni-outbox-settled: s1-01-install-link-added-by-app -->

<!-- omni-outbox-settled: s1-02-dossier-reason-on-403-only -->

## s1-02-dossier-reason-on-403-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-dossier-reason-on-403-only
prd: 459
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When the Omni page refuses a dossier, should the terminal show the page's explanation for every kind of refusal or only when access is refused?

## The decision, in plain words

The terminal shows the page's explanation only when access is refused; other refusals, like a file that is too large, keep their short status as before.

## The intro, for fun

A terminal that explains everything is a terminal nobody reads.

## The punchline, for fun

So it only explains the one refusal people cannot guess.

## The options, in plain words

A. Print the reason only after an access refusal, and keep every other refusal as it was.
B. Print the reason after every refusal that carries one.
C. Never print a reason, and send people to the page instead.

## What I had to decide

Whether the dossier command prints the page's reason after every refused status, or only after an access refusal.

## What I did meanwhile

An access refusal reads with its reason; every other refusal reads exactly as it did before this change.

## What it costs to change later

A constant: printing the reason for every status is one condition removed and a few expected lines updated.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a too-large or malformed refusal would be clearer with its reason was not asked of anyone (author).

```

<!-- /omni-outbox-settled: s1-02-dossier-reason-on-403-only -->

<!-- omni-outbox-settled: s2-02-init-shows-the-sign-in-line -->

## s2-02-init-shows-the-sign-in-line — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-init-shows-the-sign-in-line
prd: 459
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The setup command's sign-in step has to show where the repository goes, but the part of setup that runs that step was not in this slice's ground. Touch it, or leave the line printed only in the sign-in's own output?

## The decision, in plain words

A few lines of the setup command were changed so its sign-in status line is the sign-in's own closing line, printed once. The sign-in's own tests were extended beside it to prove the three lines.

## The intro, for fun

The message was ready, but the envelope belonged to the neighbour.

## The punchline, for fun

We borrowed the envelope and left a note on the door.

## The options, in plain words

A. A. The setup command hands the sign-in's closing line to its status block, so it is printed once, in the step's own place.
B. B. Leave setup untouched: the sign-in prints its line while setup runs, and setup's status line still says only who signed in.

## What I had to decide

Whether the small change to the setup command stands, or setup goes back to printing its old status line under the sign-in's own line.

## What I did meanwhile

Setup ends its sign-in step on the same line the sign-in command prints: the workspace, the install hint, or the workspace the person is not a member of.

## What it costs to change later

Undoing it is removing four lines; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Nobody said whether a slice may change a file beside its ground when the spec's promise needs it (author).

```

<!-- /omni-outbox-settled: s2-02-init-shows-the-sign-in-line -->

<!-- omni-outbox-settled: s3-01-refused-repo-keeps-ask-mode-on -->

## s3-01-refused-repo-keeps-ask-mode-on — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-refused-repo-keeps-ask-mode-on
prd: 459
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When someone switches ask mode on in a repository whose questions cannot go to any page, should ask mode still switch on?

## The decision, in plain words

Ask mode switches on anyway and prints the reason under the page link; every question then comes back to the terminal, as it does whenever the page cannot take one. The page gives 'nowhere, and here is why' as a normal answer, not as an error.

## The intro, for fun

The letterbox is painted on a wall with no door behind it.

## The punchline, for fun

The post still arrives, it just lands back on your own desk.

## The options, in plain words

A. Switch ask mode on and print the reason; questions fall back to the terminal.
B. Leave ask mode off, print the reason as an error, and stop with a failure.
C. Switch ask mode on but print the reason as a warning on the error stream.

## What I had to decide

Whether a refused repository should keep ask mode off, or switch it on with the reason shown.

## What I did meanwhile

Ask mode switches on, the second line names the reason, and each question falls back to the terminal because the page refuses the session.

## What it costs to change later

Refusing instead is a few lines in the ask command and one test; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says to print the reason but not whether ask mode should then stay off (author).

```

<!-- /omni-outbox-settled: s3-01-refused-repo-keeps-ask-mode-on -->

<!-- omni-outbox-settled: s3-02-ask-command-tests-outside-territory -->

## s3-02-ask-command-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-ask-command-tests-outside-territory
prd: 459
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The tests for switching ask mode on, and the pretend page they talk to, sit in two files the plan did not list for this piece of work. May this piece change them?

## The decision, in plain words

Yes: both were changed, only to teach the pretend page the new question and to check the new lines; nothing else in them moved.

## The intro, for fun

The plan drew the fence one step short of the vegetable patch.

## The punchline, for fun

We watered the tomatoes anyway and left the gate as we found it.

## The options, in plain words

A. Change the two test files, as done.
B. Move the new checks into a new test file inside the listed ground, with a stubbed page there.
C. Widen the plan's ground to name both files, then keep the change.

## What I had to decide

Whether changing the ask command's tests and the pretend page, outside the listed ground, is fine.

## What I did meanwhile

Both files carry the new checks; the other tests using the pretend page are untouched and pass.

## What it costs to change later

Nothing to undo: moving the checks elsewhere is a copy of a few tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names the ask command's folder, but its tests live one level up, beside the other command tests (author).

```

<!-- /omni-outbox-settled: s3-02-ask-command-tests-outside-territory -->
