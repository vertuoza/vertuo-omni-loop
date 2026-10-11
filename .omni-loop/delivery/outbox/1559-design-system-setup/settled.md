# Settled outbox items — PRD 1559

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-config-command-shows-design-system-default -->

## s1-01-config-command-shows-design-system-default — adopted

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
id: s1-01-config-command-shows-design-system-default
prd: 1559
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

To show the usual design file name when a repository names none, we changed the settings command, a place this slice was not given: is that the right place?

## The decision, in plain words

The settings command now shows the default design file path when none is set, while the stored settings stay exactly as before.

## The intro, for fun

The plan said the default lives where the setting is read, so we went to where it is read.

## The punchline, for fun

One line stepped outside the fence, and the fence still stands.

## The options, in plain words

A. A. The settings command fills in the default design file path when it prints (built).
B. B. The parsed settings carry the default themselves, and the law's test of the design section is updated to match.
C. C. The settings command prints nothing for an unset design file path, and only the skills apply the default.

## What I had to decide

Keep the settings command showing the default design file path, or move the default somewhere else.

## What I did meanwhile

Asking the settings for the design file path prints DESIGN.md when the repository names none; every other setting prints as before.

## What it costs to change later

Undoing it is a one-line change to the settings command and drops one function from the config module.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The slice's territory names the config module but not the settings command; no other place makes the command answer DESIGN.md without changing the parsed shape a law's test pins (author).

```

<!-- /omni-outbox-settled: s1-01-config-command-shows-design-system-default -->

<!-- omni-outbox-settled: s2-01-what-the-parts-check-counts -->

## s2-01-what-the-parts-check-counts — adopted

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
id: s2-01-what-the-parts-check-counts
prd: 1559
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The spec says the parts check flags controls with no part name and new component files no part covers, but not exactly which things count. Is the line drawn in the right place?

## The decision, in plain words

A control is a button, a text field, a dropdown, a text area, a link drawn as a button or the screen's main action, and a component is a new screen file in the usual front-end formats. Part names match whatever their capitals, spaces or dashes.

## The intro, for fun

Every button wants a name tag, but not every link is a button.

## The punchline, for fun

We drew the line; you get to move it.

## The options, in plain words

A. Keep the line as built: the controls, extensions and name matching above.
B. Count every link as a control too, so menus and inline links must carry a part tag.
C. Count any new source file under the screen folders as a component, plain TypeScript and JavaScript files included.

## What I had to decide

Which elements of a mockup count as controls that must carry a part tag, which added files count as new components, how a tag is matched to a listed part, and how the command tells a page from a git ref.

## What I did meanwhile

Controls: button, input (but a hidden one), select, textarea, a control role, a link classed btn or button, anything design.words.primary marks; a tag on an element around a control covers it. Component files: .tsx, .jsx, .vue, .svelte, .astro added under design.paths, design.ignore dropped. Names match with case, spaces, dashes and underscores ignored. An operand ending in .html or .htm is a page, anything else a ref.

## What it costs to change later

A constant each: the control tags and roles, the extension list and the name key live in kit/lib/design/parts/. Nothing is stored and nothing blocks, so a different line changes only what the check prints.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a plain navigation link should count as a part: left out, since a menu would flood the check (author)
- Whether a .ts or .js file under design.paths can be a component: left out, since it would name every helper (author)

```

<!-- /omni-outbox-settled: s2-01-what-the-parts-check-counts -->

<!-- omni-outbox-settled: s3-01-component-file-shape -->

## s3-01-component-file-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-component-file-shape
prd: 1559
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When the design check looks for screen parts the design system does not list, which files count as a part? The spec says a component file but does not say how to tell one apart.

## The decision, in plain words

A file counts as a part when it is a React, Vue, Svelte or Astro component file inside the folders the design settings name, test files left out. Plain scripts and styles are never flagged.

## The intro, for fun

Every file in the screens folder wants to be a component when it grows up.

## The punchline, for fun

We picked the ones that already render something.

## The options, in plain words

A. A. React, Vue, Svelte and Astro component files under the design paths (as built)
B. B. A, plus server templates (Twig, Blade, PHP views)
C. C. Only files inside a folder named components under the design paths

## What I had to decide

Keep the four front-end component file kinds, or widen or narrow the list (add server templates for a PHP repository, or count only files inside a components folder).

## What I did meanwhile

The drift check warns on unlisted React, Vue, Svelte and Astro component files under the design paths; it never turns the check red.

## What it costs to change later

A constant in one file: changing the list later is a one-line edit and a test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A repository whose components are server templates (PHP, Twig, Blade) gets no unlisted-file warning today (author)
- Slice s2 reads a diff for new component files in parallel and may pick its own definition; the two should share one (author)

```

<!-- /omni-outbox-settled: s3-01-component-file-shape -->

<!-- omni-outbox-settled: s4-01-init-beside-skill -->

## s4-01-init-beside-skill — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-init-beside-skill
prd: 1559
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The plan put the instructions for setting up a design system in the folder of design commands, but a guarded test only allows the existing commands in that folder. Where should they live?

## The decision, in plain words

They sit next to the main design instructions, as the mockup command already does, so the guarded test stays as it is.

## The intro, for fun

A new tenant arrived, but the building only had keys for the old ones.

## The punchline, for fun

So it moved in next door, like its sibling did last spring.

## The options, in plain words

A. A. Keep the setup instructions next to the main design instructions, where the mockup command already lives; the guarded test stays as it is.
B. B. Move them into the folder of design commands, and change the guarded test to allow them there.

## What I had to decide

Keep `init.md` beside `SKILL.md` (A), or move it under `reference/` and amend the proof that lists that folder (B).

## What I did meanwhile

The init command reads from `kit/plugin/skills/pixel-perfect/init.md`; the skill's tables link it there.

## What it costs to change later

Moving it later is a file rename and two link edits in SKILL.md, plus the porting note.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan named `reference/init.md` without noting that `kit/test/plugin.test.ts`, a law's proof, holds the `reference/` folder to its exact list (author).

```

<!-- /omni-outbox-settled: s4-01-init-beside-skill -->

<!-- omni-outbox-settled: s5-01-one-look-without-design-md -->

## s5-01-one-look-without-design-md — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-one-look-without-design-md
prd: 1559
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

When a repository has design craft on but no design system file yet, should the screen review still look only once, or take up to three rounds too?

## The decision, in plain words

Only a repository with a design system file gets the three rounds. Without one, the review looks once and confirms once, as it did before this change.

## The intro, for fun

Three rounds of looking need something to look against.

## The punchline, for fun

No design system file, no rematch: one look, one fix, done.

## The options, in plain words

A. Three rounds only when the repository has a design system file; without one, one look and one confirming look, as before (built).
B. Up to three rounds for every repository with design on, judged against the design form when there is no design system file.

## What I had to decide

Keep A, or pick B to give every design-on repository up to three rounds. B rewords the Bounded line of the review reference and the law proof that pins today's wording, kit/test/plugin.test.ts, in the same change.

## What I did meanwhile

Repositories without a DESIGN.md review as before, with one look and one confirming look; those with one get up to three rounds and the parts check.

## What it costs to change later

A constant: one sentence of the review reference and one assertion of the law proof.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's review section does not say whether the rounds need a DESIGN.md; its Risks say reviews take up to three rounds with a DESIGN.md, which A follows. (author)
- The help entry for pixel-perfect still says one batch of polish and one confirming look; it sits outside every slice's territory and should name the rounds once a slice may change it.

```

<!-- /omni-outbox-settled: s5-01-one-look-without-design-md -->
