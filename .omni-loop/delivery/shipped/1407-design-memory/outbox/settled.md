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

<!-- omni-outbox-settled: s9-01-design-areas-per-surface -->

## s9-01-design-areas-per-surface — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-design-areas-per-surface
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

Our app has three looks that live side by side: the public front page, the game, and the reading pages, yet the design page can describe only one look. Should it be able to describe each area on its own?

## The decision, in plain words

For now the design page describes the three areas in one block of text, and a reviewer has to work out which look applies to the screen in front of them.

## The intro, for fun

One wardrobe, three costumes, and a single label on the door.

## The punchline, for fun

The reviewer opens it and guesses which outfit today is.

## The options, in plain words

A. Keep one design page for the whole product, areas told apart in prose (built)
B. Add an optional areas list to the design form, read by the review and the word pass
C. Let each screen carry its own look, with no shared area

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: an optional areas list in the design form, each area with its own product, system, deliberate and review text and the paths or routes it covers; a screen of the library names its area; the review and the word pass read the area of the screen they look at.

## What I did meanwhile

Nothing of the kit changed in this slice. The form's System section says "Two surfaces read it differently" in prose (arcade.css and home.css use the named colours, ask.css the Ask reading tokens in three themes). The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a third look (the GitHub comments and check runs the app writes) is an area too is not settled by the spec

```

<!-- /omni-outbox-settled: s9-01-design-areas-per-surface -->

<!-- omni-outbox-settled: s9-02-copy-laws-scoped-to-an-area -->

## s9-02-copy-laws-scoped-to-an-area — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-02-copy-laws-scoped-to-an-area
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The front page must never say six of the loop's inside words, but the reading pages use one of them on purpose, and the kit keeps one list of avoided words for the whole product. Should a list apply only where it belongs?

## The decision, in plain words

No product-wide list was written. Tried as one, it raised three hundred and twenty-nine warnings on pages where those words are the right ones, and it missed a plural the front page's own test catches.

## The intro, for fun

A word banned in the shop window is the name of the product in the back office.

## The punchline, for fun

One list for both rooms shouts at the wrong one all day.

## The options, in plain words

A. Leave the avoided-word list product-wide and write none for omni-loop (built)
B. Scope avoided words to an area or a set of screens, with plurals and exceptions
C. Move copy laws into locked laws of the Language section

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: avoided words scoped to an area or to a screen (a glob of screens or routes), matched with their plural like apps/galaxy/src/home/lingo.ts does, with the parts of a page they skip (code, a glossary sidebar) named; plus a "say instead" column, since a copy law names the word to use as well as the one to avoid.

## What I did meanwhile

Nothing of the kit changed in this slice. The form's Product section records HOME's list as HOME's, from lingo.ts, and asks a person whether a product-wide list exists. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether copy laws belong in the Language slot (locked laws) or in Product (described voice) is not settled

```

<!-- /omni-outbox-settled: s9-02-copy-laws-scoped-to-an-area -->

<!-- omni-outbox-settled: s9-03-motion-vocabulary -->

## s9-03-motion-vocabulary — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-03-motion-vocabulary
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

Our screens move in a handful of ways on purpose: a blinking start button, a turning planet, a flyby, a level-up flash, each stilled when a person asks for less motion, and nothing in the design page records how things move. Should it?

## The decision, in plain words

Motion is left unwritten: the design page describes colours, faces and widths, and each slice keeps finding the moving parts in the stylesheets.

## The intro, for fun

The planet spins, the button blinks, and nobody wrote the dance down.

## The punchline, for fun

Every new step gets invented again, a little out of time.

## The options, in plain words

A. Leave motion out of the design page (built)
B. Add an optional motion slot: named moments, timing and the reduced-motion version of each
C. Keep motion in each screen of the library instead

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: an optional motion slot in the design form: the named moments (enter, blink, celebrate, page change), their durations and easings, what each becomes under reduced motion, and which areas allow which; the craft floor's motion rule reads it.

## What I did meanwhile

Nothing of the kit changed in this slice. The reduced-motion handling exists in twenty galaxy files (src/arcade/scenes/*.css, src/home/home.css, src/ask/ask.css), and the form names none of it. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists motion skills as out of scope; a motion slot is a written vocabulary, not a skill, but the line between them is the person's to draw

```

<!-- /omni-outbox-settled: s9-03-motion-vocabulary -->

<!-- omni-outbox-settled: s9-04-component-inventory -->

## s9-04-component-inventory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-04-component-inventory
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

Some small parts appear on almost every screen, like the fleet badge or the sign-in card, and when one of them changes the kit cannot say which screens are affected. Should the design memory keep a list of its parts and where they are used?

## The decision, in plain words

No list of parts was written. A past change to the fleet badge touched a hundred files and the kit could only name the screens that list those files themselves.

## The intro, for fun

The same little badge is pinned on every jacket in the building.

## The punchline, for fun

Change its colour and nobody can say which jackets to check.

## The options, in plain words

A. Keep no list of shared parts (built)
B. Add a component inventory that the touched check and the review read
C. Let each screen list the shared parts it uses

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: a component inventory in the design memory (name, path, what it is for, its states, the screens that use it); omni design touched names the components a diff touches and the screens that use them, so the review screenshots those too.

## What I did meanwhile

Nothing of the kit changed in this slice. The form's System section names the component folders by area. A replay of PRD 652 (person and fleet chips everywhere) through the kit's touched logic matched 101 paths and named only the dashboard and the PRD page. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the inventory should be read from code (exports of a folder) or hand-kept is not settled; the spec says no hand-kept index for screens

```

<!-- /omni-outbox-settled: s9-04-component-inventory -->

<!-- omni-outbox-settled: s9-05-accessibility-floor-per-area -->

## s9-05-accessibility-floor-per-area — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-05-accessibility-floor-per-area
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The reading pages test every text colour for contrast, while the game uses tiny pixel text and the whole site turns off pinch zoom for the handheld look; nothing says which accessibility floor each part of the product keeps. Should the design page say so?

## The decision, in plain words

The design page asks a person whether zoom being off on the reading pages is on purpose, and records no floor of its own.

## The intro, for fun

The arcade locks the zoom so the handheld looks right on a phone.

## The punchline, for fun

The reading room next door inherited the lock without asking.

## The options, in plain words

A. Leave the floor to the generic craft floor and ask about zoom (built)
B. Add an accessibility floor per area to the design page
C. Fold it into each locked law of the Language section

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: an accessibility slot per area in the design form: the contrast level, the smallest text, zoom, reduced motion, keyboard or gamepad paths, and what each area sets aside on purpose; the review checks a screen against its own area's floor instead of the craft floor alone.

## What I did meanwhile

Nothing of the kit changed in this slice. apps/galaxy/app/layout.tsx sets maximumScale 1 and userScalable false for every page; apps/galaxy/app/app/layout.tsx overrides only the theme colour. The form's Deliberate section holds the question. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether zoom being off on the app pages is deliberate is unknown: the layout comment speaks of the Game Boy only

```

<!-- /omni-outbox-settled: s9-05-accessibility-floor-per-area -->

<!-- omni-outbox-settled: s9-06-mockup-convention-for-pages-about-screens -->

## s9-06-mockup-convention-for-pages-about-screens — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-06-mockup-convention-for-pages-about-screens
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

Our before-and-after pages are documents that explain a change with small drawings of screens inside, and the word check reads the whole document as one screen when nothing is marked, so almost everything it reports is about the explanations, not the screens. How should it treat such pages?

## The decision, in plain words

Nothing was changed: the word check ran over all one hundred and forty pages, one of them marked, and its two thousand six hundred and fifty-three warnings are recorded with the few real faults picked out by hand.

## The intro, for fun

The proofreader was handed the whole magazine to check one advert.

## The punchline, for fun

It underlined every article and missed the typo in the ad.

## The options, in plain words

A. Run the word check as it is and record its findings by hand (built)
B. Make unmarked pages report nothing, and fix how strings and primaries are read
C. Mark the screens in every past before-and-after page

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: a page with no marked screen reports "no screen marked: nothing read" instead of reading the page whole, or reads its explanatory prose apart from any screen; the strings are split at every element, not only block tags, so a heading and its caption are not one sentence; an element marked primary counts as a control for the long-label rule; a page's screens are named by a mockup convention the kit's skills already write; and omni check warns on a new before/after page that marks no screen.

## What I did meanwhile

Nothing of the kit changed in this slice. The word pass ran on every before-after.html of the inbox and shipped folders; its findings by rule, per page, are in dogfood.md. PRD 1407's own page marks its "today" mock, whose ten-word label on a primary was reported as text at rest, not as a long label. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether old shipped pages should be marked after the fact is not settled: they are records of a decision, and editing them changes the record

```

<!-- /omni-outbox-settled: s9-06-mockup-convention-for-pages-about-screens -->

<!-- omni-outbox-settled: s9-07-screens-that-are-not-pages -->

## s9-07-screens-that-are-not-pages — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-07-screens-that-are-not-pages
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The game room is not a web page of its own: it is a scene inside the game, reached from a menu, and a PRD page holds a dozen tabs that each behave like a screen, while the library expects one address per screen. Should a screen say how to reach it, and which larger screen it is part of?

## The decision, in plain words

The game room is recorded at the address the game's own links use, and the PRD page as one screen with all its tabs, each with an open question about it.

## The intro, for fun

The game room has no street address, only a door at the back of the arcade.

## The punchline, for fun

The reviewer arrives at the front desk and asks for directions.

## The options, in plain words

A. Record each such screen at the nearest address, with an open question (built)
B. Let a screen name how it is reached and which screen it belongs to
C. Keep the library to whole pages, and leave scenes and tabs out

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: a screen of the library may name how it is reached (a key path from a named screen, an account or demo state, a query) and the screen it is part of (a tab of a page, a scene of an app, a state of a dialog), so the review can open it and touched can name the parent with the part.

## What I did meanwhile

Nothing of the kit changed in this slice. game-room.md routes /play#games (DEEP_LINKS in apps/galaxy/src/arcade/deep-link.ts); prd-dossier.md routes /prd/<id> and lists its tabs under Words. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether tabs should be screens of their own or regions of one screen is the owner's call; the open questions of prd-dossier.md ask it

```

<!-- /omni-outbox-settled: s9-07-screens-that-are-not-pages -->

<!-- omni-outbox-settled: s9-08-shared-frames-and-layouts -->

## s9-08-shared-frames-and-layouts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-08-shared-frames-and-layouts
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

A few files frame every screen at once: the top layout that sets zoom for the whole site, and the app shell with its sidebar; a change to them touches every screen, but no screen of the library says it depends on them. Should the library know which frame each screen sits in?

## The decision, in plain words

Each draft screen lists only its own files. A change to the shared layout or the app shell names no screen.

## The intro, for fun

Every painting hangs in the same frame, and nobody listed the frame.

## The punchline, for fun

Re-gild it and the catalogue says no painting changed.

## The options, in plain words

A. Leave frames out of the screens' files (built)
B. Add a frame to the library that names the layouts each screen sits in
C. List the shared layout in every screen's files

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: a frame kind in the library (or a frame field on a screen) naming the layouts and shells a screen sits in; touched lists every screen in a frame the diff changes.

## What I did meanwhile

Nothing of the kit changed in this slice. design.paths includes apps/galaxy/app/, so a layout change still reads ui: yes, but its screens: line is empty: none of the four drafts lists apps/galaxy/app/layout.tsx or apps/galaxy/src/nav/. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Listing the shell under every screen's implements would work today but makes every shell change name every screen, which may be what a person wants

```

<!-- /omni-outbox-settled: s9-08-shared-frames-and-layouts -->

<!-- omni-outbox-settled: s9-09-themes-as-a-review-dimension -->

## s9-09-themes-as-a-review-dimension — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-09-themes-as-a-review-dimension
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The reading pages come in three themes, the default dark one, a light one and a dark one, and our screenshot script shoots each; a locked screen has one mockup, and the review checks widths, not themes. Should a screen be reviewed and locked in every theme it has?

## The decision, in plain words

The design page lists the three themes under how to review a screen; the library has no way to say which theme a mockup shows.

## The intro, for fun

The same room, painted three ways, photographed in one light.

## The punchline, for fun

The other two coats dry with nobody looking at them.

## The options, in plain words

A. List the themes in the design page only (built)
B. Review and lock each screen in every theme the product ships
C. Pick one reference theme and review only that one

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: the review slot names the themes (or modes) the product ships, the review shoots each of them, and a screen's mockup may hold one view per theme, a locked screen being compared in each.

## What I did meanwhile

Nothing of the kit changed in this slice. The form's Review section names Omni, Light and Dark from apps/galaxy/scripts/shots.ts. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Which theme is the reference when only one mockup exists is asked in dashboard.md

```

<!-- /omni-outbox-settled: s9-09-themes-as-a-review-dimension -->

<!-- omni-outbox-settled: s9-10-a-way-to-see-the-library -->

## s9-10-a-way-to-see-the-library — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-10-a-way-to-see-the-library
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The screen library is a folder of text files and a list in the terminal, so a product owner deciding what to lock cannot see the screens side by side. Should the library have a page that shows every screen?

## The decision, in plain words

The library is listed in the terminal only. The four drafts have no picture, since invade draws none.

## The intro, for fun

The gallery opened with every frame facing the wall.

## The punchline, for fun

Visitors read the labels and imagine the paintings.

## The options, in plain words

A. Keep the library as text and a terminal list (built)
B. Add a page that shows every screen with its picture and status
C. Show the library on the Omni page next to each PRD

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: omni design gallery (or a tab on the Omni page) that renders each screen of the library: its mockup or a fresh screenshot of its route, its status, who locked it and its open questions, so a person locks from what they see.

## What I did meanwhile

Nothing of the kit changed in this slice. omni design screens lists dashboard, game-room, home and prd-dossier, all draft, with their routes. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec puts a mockup gallery app out of scope; a static page made by the CLI may still be one

```

<!-- /omni-outbox-settled: s9-10-a-way-to-see-the-library -->

<!-- omni-outbox-settled: s9-11-primary-action-per-screen -->

## s9-11-primary-action-per-screen — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-11-primary-action-per-screen
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

On three of the four screens we drafted, the first open question was the same: which action is the one that matters most here? The screen format has no place to say it, so the word check cannot compare what a screen is meant to put first with what it marks.

## The decision, in plain words

Each draft asks the question under its open questions.

## The intro, for fun

Four screens, and three of them have two front doors.

## The punchline, for fun

Visitors pick one, and it is often the side entrance.

## The options, in plain words

A. Leave the primary action to the open questions (built)
B. Add a primary action to the screen format, checked by the word check and the review
C. Make one primary action per screen a law a person locks

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: a Primary section (or a primary field) in the screen format: the one action the screen leads to, and its quiet second; the word check compares it with what the mockup marks primary, and the review with what the built screen shows first.

## What I did meanwhile

Nothing of the kit changed in this slice. home.md, prd-dossier.md and dashboard.md each open their questions on the primary action. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a screen may have no primary action (a reading page) is not settled

```

<!-- /omni-outbox-settled: s9-11-primary-action-per-screen -->

<!-- omni-outbox-settled: s9-12-reference-for-a-screen-that-exists -->

## s9-12-reference-for-a-screen-that-exists — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-12-reference-for-a-screen-that-exists
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

Our four screens already exist and work, but none has a mockup, so locking one today would lock words with no picture to compare against. Should the kit be able to take today's screen as the reference a person locks?

## The decision, in plain words

The drafts carry no mockup, and each asks whether today's page is the reference.

## The intro, for fun

The house is built and lived in, but nobody kept the drawings.

## The punchline, for fun

Locking it now means locking a description of a house.

## The options, in plain words

A. Leave existing screens without a mockup (built)
B. Capture today's screen as its reference before it is locked
C. Draw a mockup by hand for each screen a person wants to lock

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: a capture step that saves today's screen at its route as the screen's reference (a self-contained HTML snapshot, or a screenshot kept outside the repository and linked), with the widths and themes of the review slot, so lock has a picture to hold and the review a picture to compare.

## What I did meanwhile

Nothing of the kit changed in this slice. All four drafts have mock: null. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec keeps automatic screenshots out of the repository; an HTML snapshot in the library may or may not count as one

```

<!-- /omni-outbox-settled: s9-12-reference-for-a-screen-that-exists -->

<!-- omni-outbox-settled: s9-13-design-paths-ignore-tests -->

## s9-13-design-paths-ignore-tests — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-13-design-paths-ignore-tests
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The check that says whether a change touches a screen counts test files as screens, because they live in the same folders: this very feature reads as a screen change only because of two test files. Should the check be able to leave some files out?

## The decision, in plain words

The folders are listed whole, as the spec asks, and test-only changes read as screen changes.

## The intro, for fun

The smoke alarm goes off every time someone makes toast.

## The punchline, for fun

Soon everyone learns to ignore it, fire included.

## The options, in plain words

A. List the folders whole, tests included (built)
B. Let the paths leave out tests and other files that hold no screen
C. List only the files that render a screen, one pattern each

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: design.paths accepts exclusions (a leading ! or a design.ignore list), so a repository leaves out tests, fixtures and server-only files; invade proposes the exclusions it can prove.

## What I did meanwhile

Nothing of the kit changed in this slice. omni design touched origin/main on this branch prints ui: yes for apps/galaxy/src/docs/docs.test.ts and guide.test.ts only. A replay of eight past commits found tests in every match, 341 of 670 paths in PRD 976's. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) apps/omni-app/src/ holds no screen at all (it is the GitHub App's server); it is listed because the spec names it

```

<!-- /omni-outbox-settled: s9-13-design-paths-ignore-tests -->

<!-- omni-outbox-settled: s9-14-route-notation-and-bracketed-paths -->

## s9-14-route-notation-and-bracketed-paths — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-14-route-notation-and-bracketed-paths
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

Screen files name their addresses and files in a short list form, and a file path with square brackets, as our framework writes a page with a changing part, breaks that list without a clear message, and addresses are written three ways across the kit. Should the kit settle one way and explain the failure?

## The decision, in plain words

The bracketed path was put in quotes, and addresses are written with a placeholder in angle brackets.

## The intro, for fun

The address had a bracket in it, and the post office returned the letter.

## The punchline, for fun

The stamp said only that the envelope was the wrong shape.

## The options, in plain words

A. Quote the path and write addresses with angle brackets (built)
B. Settle one notation for addresses and explain the quoting in the refusal
C. Read addresses from the router instead of writing them by hand

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: the screen reader's refusal says to quote a path holding brackets; the screen format names one notation for a route's changing part (the router's own, or :name), and touched and the review read it; the spec's and the guide's examples use it.

## What I did meanwhile

Nothing of the kit changed in this slice. prd-dossier.md quotes "apps/galaxy/app/prd/[id]/" and routes /prd/<id>; the spec shows /quotes/:id; the router declares app/prd/[id]/. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Which notation the review needs to open a route with a real id is not settled

```

<!-- /omni-outbox-settled: s9-14-route-notation-and-bracketed-paths -->

<!-- omni-outbox-settled: s9-15-design-paths-include-the-routes-folder -->

## s9-15-design-paths-include-the-routes-folder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-15-design-paths-include-the-routes-folder
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The plan listed three folders for the check that spots screen changes, but the pages and layouts that put our screens on their addresses live in a fourth folder. Should that folder count too?

## The decision, in plain words

Yes: the routes folder of the web app was added to the three the plan names, so a change to a page or a layout reads as a screen change.

## The intro, for fun

The plan listed the rooms and forgot the hallway that leads to them.

## The punchline, for fun

The hallway got its own sign on the door.

## The options, in plain words

A. Add the routes folder to the three the plan names (built)
B. Keep the three folders the plan names, and nothing else

## What I had to decide

Whether apps/galaxy/app/ joins the three folders the plan names for design.paths.

## What I did meanwhile

design.paths in .omni-loop/config.yml lists apps/galaxy/src/, apps/galaxy/app/, apps/omni-app/src/ and packages/design/. Without the second, a change to apps/galaxy/app/layout.tsx (zoom for every page) would read ui: no.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the plan name three folders and say nothing of apps/galaxy/app/

```

<!-- /omni-outbox-settled: s9-15-design-paths-include-the-routes-folder -->

<!-- omni-outbox-settled: s6-03-plugin-test-gains-design-memory-tests -->

## s6-03-plugin-test-gains-design-memory-tests — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-10T15:12:01Z
- Channel: feature pull request #1408
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1408#issuecomment-6098944963
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-89
- Raised: 2026-10-10
- Slice: s6
- Wave: 4
- Stays here: one answer about one test file, as for PRD 1342's s8-03: a law's proof file may gain tests when the tests that prove the law stay as they were.

### The answer, as it was given

```text
A. A. Add the tests to the file the plan names, leaving the agent-limit tests untouched (built)
```

### The item, as it was raised

```text
---
id: s6-03-plugin-test-gains-design-memory-tests
prd: 1407
slice: s6
rank: high
bears-on: BR-PRODUCT-89
raised: 2026-10-10
wave: 4
---

## The question, in plain words

The test file that proves the loop never starts too many agents at once also holds the checks on how every skill is written, and this work added checks for locking screens to it. Is it all right to add to that file?

## The decision, in plain words

Yes: the new checks cover only the design craft command and the slice builder, and the checks proving the agent limit were left exactly as they were.

## The intro, for fun

Another chapter went into the rulebook the judge keeps on the bench.

## The punchline, for fun

The judge's page is untouched, but the bench still asks for a signature.

## The options, in plain words

A. A. Add the tests to the file the plan names, leaving the agent-limit tests untouched (built)
B. B. Move this slice's tests to a file of their own, so the law's proof file does not change

## What I had to decide

Whether the checks of locking, the review against a locked screen and the slice builder reading the screen library go in the test file the plan names, which also proves BR-PRODUCT-89, or in a test file of their own.

## What I did meanwhile

A new describe block in kit/test/plugin.test.ts holds twelve tests for this slice, and the pixel-perfect block gained the lock command and the language section; no line of the tests proving BR-PRODUCT-89 changed, and the whole file passes.

## What it costs to change later

A constant: move the new describe block to its own file under kit/test, which then no law names.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names kit/test/plugin.test.ts as this slice's test file, as it did for PRD 1342, whose same question was answered A (author)

```

<!-- /omni-outbox-settled: s6-03-plugin-test-gains-design-memory-tests -->
