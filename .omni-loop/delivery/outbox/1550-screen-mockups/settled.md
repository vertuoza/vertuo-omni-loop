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
