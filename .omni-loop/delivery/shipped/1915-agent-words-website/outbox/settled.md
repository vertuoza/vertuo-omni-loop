# Settled outbox items — PRD 1915

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-home-screen-draft-words -->

## s1-01-home-screen-draft-words — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-home-screen-draft-words
prd: 1915
slice: s1
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The spec asks for the home page's design draft to carry the new words, but no part of the plan was given that draft to edit. Who updates it?

## The decision, in plain words

The home page itself was changed, and its design draft was left as it was, so it can be updated once, together with the PRD page's draft, when the feature is finished.

## The intro, for fun

The home page learned new words before its own sketch did.

## The punchline, for fun

For a moment, the drawing is the one telling old stories.

## The options, in plain words

A. A. Leave the drafts to one commit on the feature branch after the wave merges, covering home and the PRD page together (built).
B. B. Update the home draft and its mockup inside this slice, widening its ground to the screen library.
C. C. Leave the drafts as they are; the next design pass redraws them.

## What I had to decide

Whether the home and PRD page drafts get their new words in a follow-up commit on the feature branch, or inside this slice.

## What I did meanwhile

The built home page shows the new row and fine print; the draft in the screen library still shows the old fine print and no row.

## What it costs to change later

A few lines of text in two draft files and one mockup; nothing runs on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives no slice the screen library folder, so the slice could not edit the draft inside its own ground (author).

```

<!-- /omni-outbox-settled: s1-01-home-screen-draft-words -->

<!-- omni-outbox-settled: s3-01-release-demo-history -->

## s3-01-release-demo-history — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-release-demo-history
prd: 1915
slice: s3
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The release notes sample shown in the demo copies, word for word, the notes the first release actually published, and four of them say Claude. Should the sample keep the published words, or should both be reworded to speak of the agent?

## The decision, in plain words

The sample keeps the published notes as they were written, since they record what shipped and the real release page shows those same words from the database. The page's own introduction to the first release now speaks of the plugin for Claude Code and skills for any coding agent.

## The intro, for fun

History was written in September, and it named names.

## The punchline, for fun

Rewriting the past is a power best left to people.

## The options, in plain words

A. Keep the published notes and the sample word for word; only the page's own words speak of the agent.
B. Reword the four published first-release notes and the sample to speak of the agent.

## What I had to decide

Keep A unless the published first-release notes themselves should be reworded; then B rewords those notes and the sample together.

## What I did meanwhile

The demo's first-release notes still say Claude in four places, exactly as the live release page does.

## What it costs to change later

Switching to B later is a text edit of four published notes and the sample, with no data change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The slice's ground does not hold the published notes, so B could not be built here (author)
- The guard of the next slice will need the sample listed among its allowed files under A (author)

```

<!-- /omni-outbox-settled: s3-01-release-demo-history -->

<!-- omni-outbox-settled: s4-01-guard-found-strings -->

## s4-01-guard-found-strings — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-guard-found-strings
prd: 1915
slice: s4
rank: medium
bears-on: none
raised: 2026-10-14
wave: 2
---

## The question, in plain words

The new check found two more places the app named Claude that the spec's list did not cover: the message the question service sends back when an agent's lead text is too long, and the example name offered when a person makes a terminal key. Should they speak of the agent too?

## The decision, in plain words

Both now speak of the agent: the message says the text the agent wrote, and the example key name reads cloud-agent, in the form and in the demo profile.

## The intro, for fun

The new check went looking for one name and found two more hiding in plain sight.

## The punchline, for fun

They now answer to the agent, like everyone else.

## The options, in plain words

A. A. Both speak of the agent: the agent wrote, cloud-agent (built).
B. B. Keep claude-cloud as the example key name, since many keys are made for Claude cloud sessions; change only the refusal.
C. C. Keep both as they were and add them to the check's list of names that stay.

## What I had to decide

Whether the refusal message and the key-name example say the agent, as the spec's after column does for the rest of the app.

## What I did meanwhile

The refusal reads "the text the agent wrote before asking", and the key-name field suggests cloud-agent.

## What it costs to change later

Two short strings and one test line; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's table lists neither string; the slice applied its rule for a string found in the same sense (author).

```

<!-- /omni-outbox-settled: s4-01-guard-found-strings -->

<!-- omni-outbox-settled: s4-02-names-that-stay-beyond-the-list -->

## s4-02-names-that-stay-beyond-the-list — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-names-that-stay-beyond-the-list
prd: 1915
slice: s4
rank: medium
bears-on: none
raised: 2026-10-14
wave: 2
---

## The question, in plain words

Beyond the places the spec named, the check found four more that say Claude where rewording would rewrite a record or a stored message: the demo's first release, copied from the notes that shipped; the release notes' product line the spec itself wrote; two database refusal messages the test doubles repeat; and the model names the app calls. Should they stay?

## The decision, in plain words

They stay, each listed in the check with its reason. The first release keeps the words it shipped with, and the database messages wait for a change of their own.

## The intro, for fun

Some sentences are history, and history does not take edits kindly.

## The punchline, for fun

The check now knows which old words are on purpose.

## The options, in plain words

A. A. Keep them, each named in the check with its reason (built).
B. B. Reword the demo's first release and the shipped notes together, so the demo stays word for word.
C. C. Also add a migration that rewords the two database messages, and the test doubles with them.

## What I had to decide

Whether the shipped release notes and the database's refusal messages keep their words, or get rewritten to speak of the agent.

## What I did meanwhile

The check lets through exactly these words, in exactly these files; any new mention of Claude elsewhere fails it.

## What it costs to change later

Removing an entry from the check's list, then rewording: the release notes in their shipped folders and the demo together, or a small migration for the two database messages.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Rewording the shipped release notes rewrites a past record outside this slice's ground (author).
- The database messages are raised by migrations; the spec rules out any migration (author).
- The check reads the word Claude alone: names like claude_session_id stay code, as the spec says (author).

```

<!-- /omni-outbox-settled: s4-02-names-that-stay-beyond-the-list -->
