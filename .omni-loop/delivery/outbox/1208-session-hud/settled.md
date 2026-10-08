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

<!-- omni-outbox-settled: s3-01-loop-roadmap-from-its-prds -->

## s3-01-loop-roadmap-from-its-prds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-loop-roadmap-from-its-prds
prd: 1208
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

When a loop starts, how does it know which roadmap it drives, since the plan it starts from does not say?

## The decision, in plain words

The loop names the one roadmap whose list of PRDs is exactly the plan's list. If no roadmap or more than one matches, it names none and shows the plain loop instead.

## The intro, for fun

The loop set off on a journey and forgot to write down which map it was holding.

## The punchline, for fun

So it checks every map in the drawer and picks the one that matches its route.

## The options, in plain words

A. Match the plan's PRDs against the roadmaps of the inbox: the one roadmap with exactly those PRDs is the loop's (built).
B. Have the planning step write the roadmap's number into the plan it makes, and read it at start.
C. Add a roadmap flag to the start command and have the drive skill pass it.

## What I had to decide

Whether a loop's roadmap is guessed from its list of PRDs, or written down by the planning step that made the plan.

## What I did meanwhile

A loop started from a roadmap's plan shows that roadmap above the work; a loop over the same PRDs started without the roadmap shows the roadmap too.

## What it costs to change later

Moving to B is one field in the plan file, set where the roadmap plan is made, and read at start in place of the match: no data to migrate, since loop.json is rewritten at each start.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The planning step's own files belong to no slice of this PRD, so B could not be built here (author).

```

<!-- /omni-outbox-settled: s3-01-loop-roadmap-from-its-prds -->

<!-- omni-outbox-settled: s7-01-init-wires-the-band-outside-its-territory -->

## s7-01-init-wires-the-band-outside-its-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: N-PRODUCT-6
- Raised: 2026-10-08
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-init-wires-the-band-outside-its-territory
prd: 1208
slice: s7
rank: medium
bears-on: N-PRODUCT-6
raised: 2026-10-08
wave: 3
---

## The question, in plain words

Setting up the loop now also turns on the band above the prompt, which needed a small change to the setup command this piece of work was not given. Is it fine that setup now writes two settings outside its own folder instead of one?

## The decision, in plain words

Yes: setup now writes one more setting in the same shared settings file, the line that turns the band on, by the same care rules, and commits that file whenever either of its two lines is the loop's.

## The intro, for fun

The setup was allowed to touch exactly one setting. The band politely asked for a second one.

## The punchline, for fun

Same file, same manners, one more line.

## The options, in plain words

A. Setup writes the band's line too, wired by a two-line change in the setup command, and commits the settings file when either line is the loop's (built).
B. Fold the band's line into the status-line writer so the setup command stays untouched; the settings file then goes uncommitted when the status line is someone else's but the band's line was added.
C. Leave setup alone and ask each person to turn the band on themselves.

## What I had to decide

Whether setup may write the band's line in the shared settings file, through a small change to the setup command outside this slice's paths, and whether the rule that setup writes only the status line there should now name the band too.

## What I did meanwhile

Setup adds the band's line after the status line. The setup command calls the new writer and commits the settings file when either line is the loop's. A value someone else set is never touched.

## What it costs to change later

A constant: removing the one call in the setup command, and its printed line, takes setup back to the status line alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gave this slice the setup library and its tests but not the setup command, which is the only place the new writer can be called from.
- (author) The knowledge entry saying setup writes only the status line outside its folder is still proposed and was not updated here: its folder is outside this slice.

```

<!-- /omni-outbox-settled: s7-01-init-wires-the-band-outside-its-territory -->

<!-- omni-outbox-settled: s4-01-loop-page-read-locally -->

## s4-01-loop-page-read-locally — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-loop-page-read-locally
prd: 1208
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

Should the loop's page link be kept by the background refresh, like the other links, or worked out on the spot from the loop this computer is running?

## The decision, in plain words

It is worked out on the spot: the loop already knows its own id and the Omni page's address, so the link needs no network and is always current.

## The intro, for fun

A loop knows where it lives, so nobody has to go and look it up.

## The punchline, for fun

One less errand for the background helper, which already has plenty.

## The options, in plain words

A. A. Work it out from the running loop's id and the configured address, no file (built).
B. B. Have the background refresh write a links file for the loop, keyed by its id.
C. C. Leave the loop page out until the app answers a loop's address itself.

## What I had to decide

Whether the loop page link is read straight from the running loop or kept in a refreshed links file like the others.

## What I did meanwhile

omni now shows the loop page from the loop kept in this checkout and the configured address, with no refresh and no file.

## What it costs to change later

Switching to a refreshed file later is a small change in one reader; nothing is stored that would need migrating.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists the loop page among what the refresh writes; the spec's table only says the Loop page's address. (author)

```

<!-- /omni-outbox-settled: s4-01-loop-page-read-locally -->

<!-- omni-outbox-settled: s4-02-refresh-without-kind-board-only -->

## s4-02-refresh-without-kind-board-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-refresh-without-kind-board-only
prd: 1208
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

When the background refresh is started the old way, without saying what kind of work it is for, should it still look up the links?

## The decision, in plain words

No: started the old way it refreshes the PRD's board only, as before. Links are looked up only when it is told the kind, which the status line will do from the next step on.

## The intro, for fun

The old way of asking keeps getting the old answer.

## The punchline, for fun

Nobody gets surprise phone calls to GitHub they did not ask for.

## The options, in plain words

A. A. No kind means the board alone; a kind adds the links (built).
B. B. No kind means a PRD, board and links both.

## What I had to decide

Whether a refresh started without a kind also fetches a PRD's links, or only its board.

## What I did meanwhile

Without a kind it writes the board alone; with the PRD kind it writes the board and the links; with a fix kind, the fix's links alone. A PRD's feature pull request is the open one, else the latest; a fix's pull request and a PRD's phase-0 pull request are listed only while open.

## What it costs to change later

Making the plain refresh fetch links too is a one-line default; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say what a refresh without a kind does, nor which feature pull request to pick when several exist. (author)

```

<!-- /omni-outbox-settled: s4-02-refresh-without-kind-board-only -->
