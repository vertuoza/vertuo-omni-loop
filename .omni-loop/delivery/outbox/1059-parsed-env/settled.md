# Settled outbox items — PRD 1059

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-one-parse-stops-every-command -->

## s1-01-one-parse-stops-every-command — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-one-parse-stops-every-command
prd: 1059
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

When one setting in the environment is half filled in or malformed, should every command of the loop's tool stop, or only the commands that use that setting?

## The decision, in plain words

Every command stops, with one message naming each setting that is wrong and never its value. The tool reads all its settings once when it starts, so a bad setting is found at once rather than deep inside a run.

## The intro, for fun

One typo in a setting, and the whole toolbox stays shut.

## The punchline, for fun

Loud and early beats quiet and wrong an hour later.

## The options, in plain words

A. A. One read at startup: any half-set or malformed group stops every command, naming its variables.
B. B. Each command reads only the groups it uses: a wrong setting it does not use is ignored.
C. C. As A, but the status line never stops: it draws as before and ignores the error.

## What I had to decide

Whether a wrong setting a command does not use (the game's database pair, the model's key) should stop that command too.

## What I did meanwhile

Every omni command, the status line included, and every game script and check:changed stop with exit 2 and one line naming the variables when any group of the kit's, the game's or the scripts' environment is half set or malformed.

## What it costs to change later

Answering B means a read per group in kit/lib/env/read.ts and each command asking for its own groups: a few hours, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a half-set group fails at startup but does not say whether a group the running command never reads counts.
- (author) The status line used to draw whatever the environment held; it now prints the error line instead when a setting is wrong.

```

<!-- /omni-outbox-settled: s1-01-one-parse-stops-every-command -->

<!-- omni-outbox-settled: s1-02-optional-setting-alone-is-half-set -->

## s1-02-optional-setting-alone-is-half-set — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-optional-setting-alone-is-half-set
prd: 1059
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

When only the optional part of a feature's settings is filled in, such as the model's name without the key that pays for it, should that count as a mistake or as the feature being off?

## The decision, in plain words

It counts as a mistake: the feature is half set up, and the tool says which setting is missing. Before, the feature quietly stayed off.

## The intro, for fun

A model's name without its key is a car with no ignition.

## The punchline, for fun

Better to hear it now than to wonder why nothing was sorted.

## The options, in plain words

A. A. An optional member set alone makes the group half set: one error names the missing variables.
B. B. A group is off until one of its required members is set: an optional member alone is ignored, as before.

## What I had to decide

Whether a group whose only set variables are optional ones (OPENROUTER_MODEL without OPENROUTER_API_KEY) is half set, or off.
Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

envReader in kit/lib/env/group.ts reports it as half set, naming every variable of the group; the GitHub App and the arcade will inherit the rule in wave 2.

## What it costs to change later

Answering B is one condition in readGroup (count only required members when deciding whether a group is set) and its test: under an hour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says a group is null when none of its variables is set; it does not say how an optional member alone is read.

```

<!-- /omni-outbox-settled: s1-02-optional-setting-alone-is-half-set -->
