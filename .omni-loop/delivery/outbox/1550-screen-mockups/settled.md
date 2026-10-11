# Settled outbox items — PRD 1550

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-every-element-ends-a-string -->

## s1-01-every-element-ends-a-string — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-every-element-ends-a-string
prd: 1550
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When a sentence on a screen has one word in bold or in a link, should the word check still read it as one sentence, or as separate pieces?

## The decision, in plain words

Every tag now ends a piece of text, so a bolded word splits its sentence into pieces. A long sentence with emphasis in the middle may then escape the too-many-words warning.

## The intro, for fun

One bold word walks into a sentence and splits it into three.

## The punchline, for fun

Grammar teachers would object; the word check simply counts pieces.

## The options, in plain words

A. A. Every element boundary ends a string, emphasis included (built).
B. B. Only adjacent sibling elements with no text between them split; inline emphasis inside running text stays one string.
C. C. Inline tags (b, i, em, strong, a without href) never split; every other element does.

## What I had to decide

Whether only block-level siblings (spans side by side) split a string, or every element boundary does, as built.

## What I did meanwhile

Every element ends a string: `<span>a</span><span>b</span>` reads two strings, and so does `<p>Click <b>here</b> now</p>` (three). A control's label stays whole.

## What it costs to change later

Changing it later is one rule in the walk of kit/lib/design/words/pass.ts and its tests; no stored shape moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says sibling elements are two strings and that splitting a word across tags is the mockup's choice, but does not say what inline emphasis inside a running sentence does.

```

<!-- /omni-outbox-settled: s1-01-every-element-ends-a-string -->

<!-- omni-outbox-settled: s4-01-mock-command-file-place -->

## s4-01-mock-command-file-place — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-mock-command-file-place
prd: 1550
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

The plan puts the instructions for drawing a screen's mockup in the design skill's folder of command pages, but an existing test that proves a product rule allows only the current pages there. Where should the mockup instructions live?

## The decision, in plain words

The mockup instructions sit beside the design skill's main page instead of in its folder of command pages, so the protected test stays untouched. Everything they say is what the spec asks for.

## The intro, for fun

A new page arrived, and the bookshelf had a strict guest list.

## The punchline, for fun

So it waits on the side table, fully readable, until someone updates the list.

## The options, in plain words

A. Keep the mockup instructions beside the design skill's main page, where they are now
B. Move them into the folder of command pages as the plan says, and add their name to the protected test's list in the same change
C. Move them into that folder and loosen the protected test so it accepts any extra command page

## What I had to decide

Whether the mockup command moves into the reference folder, which means a person updates the protected test's list of commands by one name.

## What I did meanwhile

The mock command lives at kit/plugin/skills/pixel-perfect/mock.md, linked from the skill's input and command tables; nothing else differs from the plan.

## What it costs to change later

Moving it later is one file move and three link changes, plus one name added to the command list in kit/test/plugin.test.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- kit/test/plugin.test.ts pins the reference folder to its exact list of commands and is a law's proof outside this slice's territory, so it was not edited.
- omni help pixel-perfect does not name mock yet: kit/lib/help/entries.ts is outside this slice's territory. (author)

```

<!-- /omni-outbox-settled: s4-01-mock-command-file-place -->

<!-- omni-outbox-settled: s2-01-design-ignore-default-unset -->

## s2-01-design-ignore-default-unset — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-design-ignore-default-unset
prd: 1550
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

Should the setting that leaves tests out of the design check show its default list when someone asks the config for it, or only the list a repository wrote itself?

## The decision, in plain words

The default test shapes apply whenever a repository writes no list of its own, but asking the config for the setting says it is not set until the repository writes one.

## The intro, for fun

A setting with a default that it keeps to itself.

## The punchline, for fun

It works quietly; it just will not say so when asked.

## The options, in plain words

A. Leave the key unset when the file does not name it, and apply the default where it is read (built).
B. Fill the default when the config is read, and update the law's proof in a law change of its own.
C. Fill the default and make omni config print defaults for optional keys in general.

## What I had to decide

Whether design.ignore is filled with its four default globs when the config is read, so omni config design.ignore prints them.

## What I did meanwhile

design.ignore is optional in the schema; kit/lib/design/ignore.ts reads an unset key as the four test globs, and omni config design.ignore prints no key until a repository sets one.

## What it costs to change later

Filling the default is a one-line schema change (a .default), plus updating the design section's expected value in kit/lib/config.test.ts, a law's proof this slice may not touch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The proof kit/lib/config.test.ts compares the whole parsed design section, so a filled default would turn it red; this slice was told not to edit it (author).

```

<!-- /omni-outbox-settled: s2-01-design-ignore-default-unset -->

<!-- omni-outbox-settled: s2-02-check-design-warning-print -->

## s2-02-check-design-warning-print — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-check-design-warning-print
prd: 1550
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The design check now warns about screens that claim a whole folder; the line that prints those warnings sits in a file outside this slice's agreed area. Is that fine?

## The decision, in plain words

One line was added to the shared check command so the folder warnings reach the person, printed like the warnings of the other checks, and the check still passes.

## The intro, for fun

A warning nobody prints is a very polite warning.

## The punchline, for fun

So it borrowed one line next door to be heard.

## The options, in plain words

A. Print the warnings below the check, as the other checks print theirs (built).
B. Print them on stdout above the pass line instead.
C. Count them in the pass line only, without the lines.

## What I had to decide

Whether the one line printing check design's warnings may live in kit/bin/commands/check.ts, outside s2's territory.

## What I did meanwhile

gradeDesign returns warnings; check.ts prints each as 'warning: <line>' on stderr, as check kb does, and the guard's verdict is unchanged.

## What it costs to change later

Moving it is a one-line change: the grading already returns the warnings.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the plan lists check-design.ts but not the command that prints its result (author).

```

<!-- /omni-outbox-settled: s2-02-check-design-warning-print -->
