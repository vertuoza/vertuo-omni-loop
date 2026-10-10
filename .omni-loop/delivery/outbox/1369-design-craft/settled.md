# Settled outbox items — PRD 1369

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-unreadable-base-reads-unknown -->

## s2-01-unreadable-base-reads-unknown — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-unreadable-base-reads-unknown
prd: 1369
slice: s2
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

When the check cannot read the branch it compares against, should it say it does not know, or stop with an error?

## The decision, in plain words

It says it does not know whether a screen changed, names the branch it could not read, and carries on, so the agent judges from the change itself.

## The intro, for fun

The check went looking for the branch to compare against and found an empty shelf.

## The punchline, for fun

So it shrugged politely instead of slamming the door.

## The options, in plain words

A. A. Print ui: unknown with the base it could not read, exit 0 (built)
B. B. Stop with a usage error, exit 2, as omni generated does
C. C. Fetch the base first, then fall back to A

## What I had to decide

Whether a missing comparison branch is an unknown answer or a usage error.

## What I did meanwhile

omni design touched prints ui: unknown and a line naming the base it could not read, and exits 0; a wrong number of arguments still exits 2.

## What it costs to change later

A constant: switching to an error is a one-line change in kit/bin/commands/design.ts and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the command always exits 0 and lists the four answers, but does not say what a base git cannot read prints (author).

```

<!-- /omni-outbox-settled: s2-01-unreadable-base-reads-unknown -->

<!-- omni-outbox-settled: s2-02-design-paths-glob-syntax -->

## s2-02-design-paths-glob-syntax — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-design-paths-glob-syntax
prd: 1369
slice: s2
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

Which pattern syntax should the list of screen locations accept?

## The decision, in plain words

It accepts the usual star, double star, question mark and either-or braces; a plain folder name means everything under it; square brackets are taken as written, so folders named with brackets match as they are.

## The intro, for fun

Every tool has its own dialect of wildcards, and each thinks its own has no accent.

## The punchline, for fun

This one speaks the common phrases and leaves the slang at the door.

## The options, in plain words

A. A. The common subset, brackets literal, a bare name as a folder (built)
B. B. Full glob syntax, with character classes and negation
C. C. Regular expressions, as the landings section uses

## What I had to decide

Whether design.paths needs character classes or negation, or the common subset is enough.

## What I did meanwhile

kit/lib/design/glob.ts matches *, **, ?, {a,b}; a pattern ending in / or with no wildcard is a folder prefix; [ and ] are literal.

## What it costs to change later

A constant: a wider syntax is an added branch in kit/lib/design/glob.ts; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says design.paths is a list of globs without naming the dialect (author).

```

<!-- /omni-outbox-settled: s2-02-design-paths-glob-syntax -->

<!-- omni-outbox-settled: s3-01-notice-in-the-plugin -->

## s3-01-notice-in-the-plugin — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-notice-in-the-plugin
prd: 1369
slice: s3
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The credit and the full licence text for the imported design craft sit in the kit's notice file, but repositories install only the plugin folder, which carries a credit line in every imported file and none of the licence text. Should the plugin carry its own copy of the notice too?

## The decision, in plain words

The full notice and licence text stay in the kit's notice file, as the spec asked, and each imported file opens with a line saying where it came from, under which licence, and that it was changed.

## The intro, for fun

The credits roll in the cinema, but the DVD box only says based on a true story.

## The punchline, for fun

One more file in the box would settle it.

## The options, in plain words

A. Keep the notice in the kit only, with a credit line in every imported file (built).
B. Also copy the notice and licence text into the skill folder, so it travels with the plugin.
C. Move the notice into the plugin folder, and leave the kit pointing at it.

## What I had to decide

Whether the skill folder gets its own copy of the notice and licence text.

## What I did meanwhile

Each imported file names its source, its licence and that it was modified; the skill's opening paragraph credits impeccable and Anthropic's frontend-design skill; the full text is in kit/NOTICE.md.

## What it costs to change later

Adding the copy later is one file in the skill folder and one test line; nothing else moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Apache-2.0 duty to hand recipients a copy of the licence is met by the plugin as installed was not checked with anyone who owns licensing (author).

```

<!-- /omni-outbox-settled: s3-01-notice-in-the-plugin -->

<!-- omni-outbox-settled: s4-01-review-screenshots-stay-out-of-the-repo -->

## s4-01-review-screenshots-stay-out-of-the-repo — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-review-screenshots-stay-out-of-the-repo
prd: 1369
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 4
---

## The question, in plain words

Where should the pictures the design review takes of a screen be kept, so the people reviewing the change can see them?

## The decision, in plain words

They stay outside the code and are attached to the change's review page when the agent can; otherwise the review names each screen and width it looked at.

## The intro, for fun

The review took lovely photos of the new screen and then looked around for a frame.

## The punchline, for fun

It chose the gallery wall over the kitchen drawer.

## The options, in plain words

A. Keep them out of the repository and attach them when the session can (built)
B. Commit them beside the slice's account in the PRD's outbox folder
C. Keep no screenshots, only the written lines

## What I had to decide

Whether the review's screenshots should be committed with the work, kept only as attachments, or not kept at all.

## What I did meanwhile

Screenshots stay in a scratch folder, attached to the sub-PR when the session can upload them; the Design review section names each screen and width seen.

## What it costs to change later

A constant in the skill's wording: committing them later is one sentence and a folder the outbox check accepts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Agents usually cannot attach an image to a pull request from the terminal, so most reviews will carry the named widths only (author).

```

<!-- /omni-outbox-settled: s4-01-review-screenshots-stay-out-of-the-repo -->

<!-- omni-outbox-settled: s4-02-no-design-review-on-a-target-slice -->

## s4-02-no-design-review-on-a-target-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-no-design-review-on-a-target-slice
prd: 1369
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 4
---

## The question, in plain words

When a slice is built in another repository from a planning repository, should the design review still look at its screens?

## The decision, in plain words

It does not run there for now: the planning repository never starts the other repository's app, so the review section says it was not run.

## The intro, for fun

The review packed its camera for a trip to the neighbour's house.

## The punchline, for fun

The neighbour only lets in the plumber, so it waved from the fence.

## The options, in plain words

A. Skip the review on a target slice, with one line saying so (built)
B. Run the critique and audit from the source only, with no app and no lint
C. Read the target's committed design flag and paths, and review as here

## What I had to decide

Whether a slice built in a target repository gets a design review from the source alone, from the target's own settings, or none.

## What I did meanwhile

Under --target the review does not run, and the sub-PR's Design review section is one line saying it was not run on a target slice.

## What it costs to change later

One sentence of the do-work skill; turning it on later reads the target's committed design flag, as its preflight is read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not mention multi-repository slices at all (author).

```

<!-- /omni-outbox-settled: s4-02-no-design-review-on-a-target-slice -->

<!-- omni-outbox-settled: s5-01-design-lint-proposed-despite-findings -->

## s5-01-design-lint-proposed-despite-findings — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s5
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-design-lint-proposed-despite-findings
prd: 1369
slice: s5
rank: medium
bears-on: none
raised: 2026-10-10
wave: 5
---

## The question, in plain words

When the setup step finds a design checker already installed, should it suggest using it even if the checker reports problems in today's screens?

## The decision, in plain words

It suggests the checker as long as it runs and produces its report, whatever problems it finds, because the design review only reports and never blocks. A checker that cannot start is turned into a question instead.

## The intro, for fun

Every app has a few pixels it would rather not talk about.

## The punchline, for fun

We let the checker speak anyway; it only takes notes.

## The options, in plain words

A. A. Suggest it whenever it runs to its report, findings or not, since the review never blocks
B. B. Suggest it only when it passes, like every other command setup suggests
C. C. Never suggest it; a person sets it by hand

## What I had to decide

Whether a design checker with findings on today's screens is still suggested during setup.

## What I did meanwhile

Setup suggests an installed design checker whenever it runs to its report, findings or not.

## What it costs to change later

A one-line change in the setup skill's config table; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only that a design checker already installed is suggested; every other command setup suggests must pass first (author)

```

<!-- /omni-outbox-settled: s5-01-design-lint-proposed-despite-findings -->
