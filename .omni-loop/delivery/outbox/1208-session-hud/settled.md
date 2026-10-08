# Settled outbox items — PRD 1208

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-now-runs-without-a-kit -->

## s1-01-now-runs-without-a-kit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-now-runs-without-a-kit
prd: 1208
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

Should the everyday omni command answer 'on nothing' when it is run in a folder where the loop is not installed, instead of refusing?

## The decision, in plain words

Yes: asking what a session is on outside a repository with the loop now answers that it is on nothing and succeeds, as the spec asks, instead of the usual refusal.

## The intro, for fun

Ask a stranger what they are working on, and they should not slam the door.

## The punchline, for fun

Now they just shrug and say: nothing, thanks for asking.

## The options, in plain words

A. A. Let now run without a kit: it answers the session is on nothing, exit 0 (built).
B. B. Keep the refusal: outside a kit the global omni prints one line on stderr and exits 2; inside one, nothing changes.

## What I had to decide

Whether the person-installed omni lets the now command run in a folder with no loop, or refuses it like other commands.

## What I did meanwhile

The launcher lets now run anywhere; it reads nothing and answers that the session is on nothing.

## What it costs to change later

One word in the launcher's list of commands that need no kit; removing it brings the refusal back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The slice's territory did not include the launcher (kit/lib/launch); the spec's acceptance criteria ask for exit 0 where the loop is not installed, which only this change gives through the global omni. (author)

```

<!-- /omni-outbox-settled: s1-01-now-runs-without-a-kit -->

<!-- omni-outbox-settled: s1-02-session-id-order -->

## s1-02-session-id-order — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-session-id-order
prd: 1208
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

When the session is named in more than one way at once, which one wins?

## The decision, in plain words

A session named on the command line wins, then the one Claude Code sends on the input, then the one in the environment.

## The intro, for fun

Three people answer to the same name at the door.

## The punchline, for fun

The one holding the invitation goes in first.

## The options, in plain words

A. A. Command line, then Claude Code's input, then the environment (built).
B. B. Command line, then the environment, then Claude Code's input.

## What I had to decide

The order in which the session's id is taken when the command line, Claude Code's input and the environment each name one.

## What I did meanwhile

Command line first, then Claude Code's input, then the environment.

## What it costs to change later

One line of order in the command; swapping it is a one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the command line then the environment, and Claude Code's input separately, without saying where it falls. (author)

```

<!-- /omni-outbox-settled: s1-02-session-id-order -->

<!-- omni-outbox-settled: s1-03-status-line-refresh-test-names -->

## s1-03-status-line-refresh-test-names — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-status-line-refresh-test-names
prd: 1208
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

The status line's own test checks the exact file its background refresh writes. Now that the file also keeps each slice's name, may this slice update that test?

## The decision, in plain words

Yes: the status line's refresh test now expects each slice's name in the file, and nothing else about it changed.

## The intro, for fun

The board learned everyone's name, and the old guest list did not know them yet.

## The punchline, for fun

So the guest list got a quick update, spelling checked.

## The options, in plain words

A. A. Update the status line's refresh test to expect the names (built).
B. B. Keep the names in a separate file so the status line's test stays as it was.

## What I had to decide

Whether the status line's refresh test, outside this slice's ground (kit/bin/statusline.test.ts), may be updated to expect the new slice names.

## What I did meanwhile

The test expects the names; no status line code changed.

## What it costs to change later

Four names in one test; a later slice that owns the status line can reshape them freely.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the board names to this slice but the status line test that checks the board file to slices s4 and s5. (author)

```

<!-- /omni-outbox-settled: s1-03-status-line-refresh-test-names -->

<!-- omni-outbox-settled: s2-01-branch-before-record -->

## s2-01-branch-before-record — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-branch-before-record
prd: 1208
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When the branch a session is on and the last thing it worked on disagree, which one should the session show?

## The decision, in plain words

The branch wins, as it already does for features: a session on a fix branch shows that fix, and only on a branch that names nothing does it show the last thing it worked on.

## The intro, for fun

Two signposts, two directions: the road you stand on, or the note in your pocket?

## The punchline, for fun

We trusted the road under our feet.

## The options, in plain words

A. A. The branch first, then the record, for features and fixes alike (built).
B. B. The record first, then the branch, as the spec's list orders them, for fixes and features alike.
C. C. The record first for fixes only, the branch first for features.

## What I had to decide

Pick A to keep the branch first, or B to follow the spec's list where the last recorded work comes before the branch.

## What I did meanwhile

A session shows the work its branch names; the record only fills in on a branch that names nothing.

## What it costs to change later

Switching the order is a few lines in one reading module and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists the record before the branch, while the status line it builds on reads the branch first; which one was meant is not written down (author).

```

<!-- /omni-outbox-settled: s2-01-branch-before-record -->

<!-- omni-outbox-settled: s2-02-record-new-shape-only -->

## s2-02-record-new-shape-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-record-new-shape-only
prd: 1208
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

Should the note of what a session works on still be readable by an older kit after a rollback?

## The decision, in plain words

The note is now written only in its new form. An older kit reads a feature note in the new form as nothing until the next command writes one in the old form.

## The intro, for fun

The new notebook has nicer lines, but grandpa's glasses only read the old ones.

## The punchline, for fun

Grandpa squints for exactly one command.

## The options, in plain words

A. A. Write the new form only (built).
B. B. Also write the old field on feature notes, so an older kit still reads them after a rollback.

## What I had to decide

Pick A to keep the new form only, or B to also write the old field for features so an older kit keeps reading them.

## What I did meanwhile

Every note is written as a kind and a number; old notes are still read.

## What it costs to change later

Adding the old field back is one line where the note is written, plus its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's rollback risk says an older kit ignores the new fields, while its record shape names only kind, number and time; the two were not reconciled (author).

```

<!-- /omni-outbox-settled: s2-02-record-new-shape-only -->

<!-- omni-outbox-settled: s6-01-hud-command-name -->

## s6-01-hud-command-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-hud-command-name
prd: 1208
slice: s6
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

The spec says people turn the band off by typing /omni:hud, but Claude Code does not let a plugin's own command have a colon in its name. What should the command be called?

## The decision, in plain words

The command is called /omni-hud, after the plugin itself: typing it once hides the band in this and later sessions, and typing it again shows it.

## The intro, for fun

The spec asked for a colon, and Claude Code said colons are for skills only.

## The punchline, for fun

So the band answers to a hyphen instead, which is almost the same punctuation.

## The options, in plain words

A. A. Keep /omni-hud, the plugin's own name, registered by the mod itself.
B. B. Add a skill named hud to the omni plugin so that /omni:hud exists and flips the same switch, which changes the omni plugin the spec leaves untouched.
C. C. Drop the command and leave the switch to the enabled plugins list in the settings file: turning omni-hud off there hides the band.

## What I had to decide

Whether /omni-hud is the name people type to hide or show the band, or whether the toggle should live somewhere else.

## What I did meanwhile

The band, its tests and its marketplace entry all use /omni-hud; the spec and the kit README (slice s7) should say /omni-hud too.

## What it costs to change later

A rename is one string in the mod, its reply line and its tests: no stored data changes, and the off switch kept in the person's settings stays as it is.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Not tried in a live session: whether Claude Code lists a plugin-registered command bare (/omni-hud) or prefixed with the plugin's name was not checked, because loading the mod into this session was out of bounds.

```

<!-- /omni-outbox-settled: s6-01-hud-command-name -->

<!-- omni-outbox-settled: s6-02-hud-outside-repo-checks -->

## s6-02-hud-outside-repo-checks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-hud-outside-repo-checks
prd: 1208
slice: s6
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

The band's code is written against Claude Code's own type definitions, which only Claude Code provides, so the repository's linter and dead-code audit cannot read it. How should the repository check it?

## The decision, in plain words

The linter and the dead-code audit skip the band's folder, and Claude Code's own validate and test commands check it instead, run from the plugin guard test whenever Claude Code is installed.

## The intro, for fun

The band speaks Claude Code's dialect, and the repository's linter only reads the house one.

## The punchline, for fun

So the band gets graded by a teacher who actually speaks its language.

## The options, in plain words

A. A. Skip the band's folder in the linter and the dead-code audit, and let Claude Code's validate and test commands check it.
B. B. Pin a copy of Claude Code's type definitions in the repository so the linter and the audit read the band like any other code.
C. C. Install Claude Code in continuous integration so its checks of the band run on every pull request too.

## What I had to decide

Whether skipping the band's folder in the linter and the dead-code audit is acceptable, with Claude Code's own checks standing in for them.

## What I did meanwhile

Two lines outside this slice's ground say so: one in the linter's settings and one in the dead-code audit's settings, each with a comment naming the checks that stand in.

## What it costs to change later

Undoing it means removing those two lines and adding a pinned copy of Claude Code's type definitions to the repository so both tools can read the band; no stored data is involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) On a machine without Claude Code, as in continuous integration, the guard test skips the band's checks and says so; nothing else checks the band's code there.

```

<!-- /omni-outbox-settled: s6-02-hud-outside-repo-checks -->
