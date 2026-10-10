# Settled outbox items — PRD 1407

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s3-01-superseding-a-locked-screen -->

## s3-01-superseding-a-locked-screen — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-superseding-a-locked-screen
prd: 1407
slice: s3
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

When a locked screen is replaced by a new one, must the person also write a dated amendment on the old screen, or is marking it replaced enough?

## The decision, in plain words

Marking a locked screen as replaced is enough, as long as nothing else on it changes and the new screen names it. Any other change to a locked screen still needs a dated amendment.

## The intro, for fun

Retiring a screen should feel like handing over keys, not filing a form in triplicate.

## The punchline, for fun

The new screen names the old one, and that is the paperwork.

## The options, in plain words

A. A. Marking it replaced is enough when the new screen names it (built).
B. B. Replacing a locked screen also needs a dated amendment line on the old one.
C. C. Only a person's lock on the new screen allows the old one to be marked replaced.

## What I had to decide

Whether replacing a locked screen needs its own amendment line, or the new screen naming it is the record.

## What I did meanwhile

The design check lets a locked screen turn to replaced without an amendment line when its text is otherwise unchanged and another screen names it; any other change, turning it back into a draft included, needs a new amendment line.

## What it costs to change later

A constant in the design check: requiring the amendment line too is a one-line change and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a replaced screen is marked superseded and named by the new one, but not whether that change itself needs an amendment line. (author)

```

<!-- /omni-outbox-settled: s3-01-superseding-a-locked-screen -->

<!-- omni-outbox-settled: s4-01-avoid-list-shape -->

## s4-01-avoid-list-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-avoid-list-shape
prd: 1407
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

How does a team write down, on its design page, the words its product never uses, so that the word check can find them?

## The decision, in plain words

The check only reads a list that is clearly labelled as one: a line such as "Words we avoid:" followed by the words, or that label followed by one bullet per word. A sentence that just mentions avoiding something is never read as a list.

## The intro, for fun

Every product has words it would rather never say out loud.

## The punchline, for fun

We only listen when the list says it is a list.

## The options, in plain words

A. A. A labelled line (Words we avoid:, Words to avoid:, Avoided words: or Avoid:) with the words after it, or the label alone with one bullet per word below it
B. B. Only the config list; the design page is never read for avoided words
C. C. A dedicated sub-heading under the product part, with one bullet per word

## What I had to decide

Whether the labelled line (or labelled bullet list) is the shape a team writes its avoided words in on the design page, or whether the page should hold them some other way.

## What I did meanwhile

The word check reads avoided words from the config list and from a labelled line or bullet list in the product part of the design page; anything else there is ignored.

## What it costs to change later

Changing the accepted shape later is a change to one small reader and its tests; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The kit's design page template does not yet show this shape in its product hint; that template belongs to another slice (author)
- The guide page that explains the word check is written in a later slice and should show the shape (author)

```

<!-- /omni-outbox-settled: s4-01-avoid-list-shape -->

<!-- omni-outbox-settled: s4-02-word-pass-selector-subset -->

## s4-02-word-pass-selector-subset — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-word-pass-selector-subset
prd: 1407
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

When a team marks its screens and main buttons with its own markup instead of the kit's default markers, how rich can that marking be?

## The decision, in plain words

A team can name screens and main buttons by element type, id, class or attribute, several at once separated by commas, but not by where an element sits inside another. The config refuses anything richer, so a mistake shows up at once.

## The intro, for fun

Everyone wants their buttons found, but nobody wants to learn a new query language.

## The punchline, for fun

Simple names in, no family trees.

## The options, in plain words

A. A. Element type, id, class and attribute tests, comma-separated, with no nesting
B. B. Also allow nesting rules such as one element inside another
C. C. Only attribute names, as the default markers are

## What I had to decide

Whether element type, id, class and attribute (comma-separated) are enough for a team's own markers, or whether nesting rules are needed too.

## What I did meanwhile

The word check reads that simple set; a config with a nesting rule or a hover rule is refused with a message naming the setting.

## What it costs to change later

Widening the accepted set later is an addition to one small reader; nothing stored changes and no config that works today breaks.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No repository using its own markers has been tried yet; the dogfood slice uses the default markers (author)

```

<!-- /omni-outbox-settled: s4-02-word-pass-selector-subset -->

<!-- omni-outbox-settled: s4-03-word-pass-when-design-off -->

## s4-03-word-pass-when-design-off — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-word-pass-when-design-off
prd: 1407
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

Should the word check on a mockup run in a repository that has not switched design craft on?

## The decision, in plain words

No. While design craft is off, the word check prints that design is off and reads nothing, the same way the screen list does.

## The intro, for fun

A spell checker that runs when nobody asked is just a nag.

## The punchline, for fun

Off means off, for every design command alike.

## The options, in plain words

A. A. Print that design is off and read nothing, as the screen list does
B. B. Read the mockups anyway, since the check never blocks

## What I had to decide

Whether the word check stays silent while design craft is off, or reads mockups anyway because it never blocks anything.

## What I did meanwhile

With design craft off, the word check prints one line saying so and exits without reading the pages.

## What it costs to change later

Letting it run while off later is a one-line change and its test; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say how the word check behaves with design craft off; this follows the screen list built in the previous wave (author)

```

<!-- /omni-outbox-settled: s4-03-word-pass-when-design-off -->

<!-- omni-outbox-settled: s5-01-screens-line-shape -->

## s5-01-screens-line-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-screens-line-shape
prd: 1407
slice: s5
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

When a change touches a screen that is not locked yet, how should the list of touched screens show its state next to the pages it lives on?

## The decision, in plain words

A locked screen shows a lock, any other shows its state in brackets, and the pages it lives on follow in their own brackets, so a draft reads like this: quote list (draft) (/quotes).

## The intro, for fun

The spec drew a locked screen with its pages and a draft without any, and left the middle blank.

## The punchline, for fun

So the draft got two pairs of brackets, which is one more than most drafts ever get.

## The options, in plain words

A. A. Two pairs: quote-list (draft) (/quotes), a lock on a locked screen: quote-editor 🔒 (/quotes/:id)
B. B. One pair: quote-list (draft, /quotes)
C. C. Pages first, then the state: quote-list (/quotes) draft

## What I had to decide

Keep the two pairs of brackets, or fold the state and the pages into one pair.

## What I did meanwhile

Every touched screen is listed with its state and its pages; the review reads the pages from the same line either way.

## What it costs to change later

A change to one format function and its tests; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's example shows a draft without pages only, so the shape of a draft with pages is a guess (author).

```

<!-- /omni-outbox-settled: s5-01-screens-line-shape -->

<!-- omni-outbox-settled: s6-01-amendment-line-needs-its-owner -->

## s6-01-amendment-line-needs-its-owner — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-amendment-line-needs-its-owner
prd: 1407
slice: s6
rank: medium
bears-on: none
raised: 2026-10-10
wave: 4
---

## The question, in plain words

When a planned change touches a screen someone locked, may the builder write the dated amendment note on that screen itself, or does the note wait for the person who locked it?

## The decision, in plain words

The builder never writes the note. It builds the change, leaves the locked screen untouched, and raises the urgent question for the owner, with the note drafted and their words left blank for them to fill.

## The intro, for fun

An amendment note is a signature, and nobody should sign for someone else.

## The punchline, for fun

So the builder drafts the note and hands over the pen.

## The options, in plain words

A. A. The builder never writes the note; the urgent question carries it, for the owner's words (built)
B. B. The builder writes the note, quoting the approved plan and naming whoever approved it, then raises the urgent question
C. C. The builder does not build the change at all until the owner answers

## What I had to decide

Whether the amendment note on a locked screen is always written in its owner's words, or whether the builder may write it, quoting the approved plan, before the owner answers.

## What I did meanwhile

The building and review instructions say no agent writes an amendment note or edits a locked screen; the urgent question carries the note it would add, with the owner's words left for them.

## What it costs to change later

A few sentences in two instruction pages; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the agent writes an amendment line and raises the urgent question, but the line's shape holds a person's name and their own words, which only the owner can give (author)
- The design check passes because the locked screen's file is left unchanged; the urgent question alone holds the gate (author)

```

<!-- /omni-outbox-settled: s6-01-amendment-line-needs-its-owner -->

<!-- omni-outbox-settled: s6-02-help-does-not-name-lock-yet -->

## s6-02-help-does-not-name-lock-yet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-help-does-not-name-lock-yet
prd: 1407
slice: s6
rank: medium
bears-on: none
raised: 2026-10-10
wave: 4
---

## The question, in plain words

The built-in help for the design craft command does not mention the new way to lock a screen yet. Should a later piece of this work add it?

## The decision, in plain words

Left as it is in this piece, because the help text belongs to another part of the code. The help page should gain one sentence naming the lock command and that only a person uses it.

## The intro, for fun

A new door went in, and the map by the entrance has not heard about it.

## The punchline, for fun

One sentence on the map, and nobody walks into the wall.

## The options, in plain words

A. A. Leave the help as it is here; add the sentence later (built)
B. B. Add the sentence in the guide piece of this work

## What I had to decide

Whether the help entry for the design craft command gains a sentence on locking, in the guide piece of this work or in a follow-up.

## What I did meanwhile

The command and its instructions describe locking in full; the help entry lists the other commands only, and its test leaves locking out on purpose.

## What it costs to change later

One sentence in the help entry and one test line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The help entries are outside this piece's ground in the plan, so the change is a decision rather than an edit (author)

```

<!-- /omni-outbox-settled: s6-02-help-does-not-name-lock-yet -->

<!-- omni-outbox-settled: s7-01-concept-screens-get-their-own-pr -->

## s7-01-concept-screens-get-their-own-pr — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s7
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-concept-screens-get-their-own-pr
prd: 1407
slice: s7
rank: medium
bears-on: none
raised: 2026-10-10
wave: 5
---

## The question, in plain words

When a big idea is explored and one direction is crowned, its screens should be saved as drafts. The concept's own pull request may only hold the concept's folder, so where should those draft screens go?

## The decision, in plain words

They go in a second, documents-only pull request of their own, opened right after the concept's, listing each draft for its owner to read and lock.

## The intro, for fun

The concept arrived with a suitcase, and the suitcase rule says one bag per traveller.

## The punchline, for fun

So the screens travel on the next flight, with their own boarding pass.

## The options, in plain words

A. A. A second docs-only pull request holds the draft screens, beside the concept's (built)
B. B. Teach the concept check to let the screen library through, and put the drafts in the concept's pull request
C. C. Write no drafts at the concept stage: each area's brainstorm drafts the screens it draws

## What I had to decide

Whether the crowned concept's draft screens go in a pull request of their own, because the concept check refuses any file outside the concept's folder, or the concept check learns to let the screen library through, or the drafts wait until each area is brainstormed.

## What I did meanwhile

The think-big skill, with design craft on, opens a second docs-only pull request on the knowledge branch shape, topic concept-<n>-screens, holding one draft per screen of the vision tour, after the concept PR opens; the concept PR is unchanged and still passes omni concept.

## What it costs to change later

A paragraph of the think-big skill: moving the drafts into the concept PR needs omni concept to allow the screen library folder (a small change to the concept verdict and its test), and leaving them to brainstorm --concept is deleting the paragraph.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says think-big writes the crowned concept's screens but does not say on which branch, and omni concept (outside this slice) refuses any file changed outside the concept folder
- (author) Whether a person wants two pull requests for one concept is not settled anywhere

```

<!-- /omni-outbox-settled: s7-01-concept-screens-get-their-own-pr -->

<!-- omni-outbox-settled: s7-02-visual-fix-asks-the-screen-owner -->

## s7-02-visual-fix-asks-the-screen-owner — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s7
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-visual-fix-asks-the-screen-owner
prd: 1407
slice: s7
rank: medium
bears-on: none
raised: 2026-10-10
wave: 5
---

## The question, in plain words

A quick visual fix may change a screen someone has locked. Should that fix wait for the person who locked the screen to answer, the way a change to a rule does?

## The decision, in plain words

Yes: the fix is built and its pull request opens, with one question for the screen's owner that keeps it from going green until they answer.

## The intro, for fun

Someone put a padlock on the sidebar, and a paintbrush just showed up.

## The punchline, for fun

The brush waits politely while the padlock's owner reads the note.

## The options, in plain words

A. A. Build the fix and ask the screen's owner through one high question on its pull request (built)
B. B. Stop the visual fix on a locked screen and hand over to a full design run

## What I had to decide

Whether a visual fix whose pick departs from a locked screen raises one high question in the fix's own folder for the person who locked it, as a change to a rule already does, or simply stops and hands over to a full design run.

## What I did meanwhile

The visual-fix skill applies the pick, leaves the locked screen's file and mockup untouched, and writes one high item per locked screen in the fix folder's outbox, naming the screen and who locked it, with the amendment line left for the owner's words; no account is written, since no check names a locked screen in a visual fix.

## What it costs to change later

A section of the visual-fix skill: switching to a stop is replacing that section with a pointer to its existing stop.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a change to a locked screen raises a high item, but the visual fix had an outbox only for changes to a rule until now
- (author) omni visual does not read locked screens, so nothing but the outbox check holds the pull request

```

<!-- /omni-outbox-settled: s7-02-visual-fix-asks-the-screen-owner -->
