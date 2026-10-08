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
