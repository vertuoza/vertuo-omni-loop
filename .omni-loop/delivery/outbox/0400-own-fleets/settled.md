# Settled outbox items — PRD 400

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-mascot-choices -->

## s1-01-mascot-choices — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-mascot-choices
prd: 400
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Which pictures may an owner pick as a fleet's mascot?

## The decision, in plain words

The six fleet animals and characters the game already draws: the beaver, the octopus, the duck, the spy, the pirate and the invincible hero. The commander, the enemy, the plain heroes and the small icons are not offered.

## The intro, for fun

Six mascots walk into a fleet screen and ask to be picked.

## The punchline, for fun

The commander stays on the bridge, and the enemy stays outside.

## The options, in plain words

A. The six fleet mascots, kept as a list in the database, as built.
B. Every drawable sprite except the plain heroes and icons, the commander and the enemy included.
C. No list in the database: accept any short key and let the app draw a hero when it does not know it.

## What I had to decide

Which sprites count as mascots an owner may choose, and whether that list lives in the database or is read from the sprite library.

## What I did meanwhile

The database holds the six fleet mascots in one small list; adding a mascot later is one line in a new migration.

## What it costs to change later

One list in one migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the commander or the enemy should ever be a fleet mascot (author)
- whether the list should instead be generated from the sprite library at build time (author)

```

<!-- /omni-outbox-settled: s1-01-mascot-choices -->

<!-- omni-outbox-settled: s1-02-fleet-refusal-shape -->

## s1-02-fleet-refusal-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-fleet-refusal-shape
prd: 400
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

How does the fleet page learn which field a refusal is about?

## The decision, in plain words

Every refusal starts with the field's name, for example Label: 1 to 12 characters, and also carries the field on its own as a hint the page can read. A colour typed in capitals is accepted and stored in lowercase, and spaces around a label or motto are trimmed.

## The intro, for fun

The database says no, and politely points at the box you got wrong.

## The punchline, for fun

Label, colour, motto or mascot: it always names the culprit.

## The options, in plain words

A. A hint naming the field plus a message that starts with it, as built.
B. A separate error code per field, and no hint.
C. The functions answer a list of every problem at once instead of stopping at the first.

## What I had to decide

The shape of the fleet functions' answers and refusals, which the fleet page reads to show each refusal next to its field.

## What I did meanwhile

Each function answers the fleet as saved; a refusal carries the field as its hint and names it first in its message; the page maps the hint to the field.

## What it costs to change later

The wording and hints of four refusals, and the page's mapping.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the refusal messages should be written for people to read as they are, or be translated by the page (author)

```

<!-- /omni-outbox-settled: s1-02-fleet-refusal-shape -->

<!-- omni-outbox-settled: s1-03-fleet-key-from-label -->

## s1-03-fleet-key-from-label — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-fleet-key-from-label
prd: 400
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

How is a new fleet's permanent key made from the name its owner types?

## The decision, in plain words

The typed name is lowercased with dashes for anything that is not a letter or a digit, like c-i-a for the spy fleet. When that key is already used, even by a retired fleet, a number is added, like beaver-2.

## The intro, for fun

Two fleets both want to be called Beaver.

## The punchline, for fun

The second one gets a number, like a sequel nobody asked for.

## The options, in plain words

A. Lowercase with dashes and a counter when taken, as built.
B. A random short code, so a key never echoes the label at all.
C. Lowercase with dashes, and refuse a label whose key is taken instead of numbering it.

## What I had to decide

The rule that turns a fleet's label into its key, which never changes once made.

## What I did meanwhile

Lowercase, dashes for anything else, a counter when taken; keys already made stay as they are whatever rule comes later.

## What it costs to change later

A few lines in one function; existing keys never move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a key should ever be longer than the twelve characters a label allows, plus its number (author)

```

<!-- /omni-outbox-settled: s1-03-fleet-key-from-label -->

<!-- omni-outbox-settled: s2-01-fleets-menu-with-none -->

## s2-01-fleets-menu-with-none — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-fleets-menu-with-none
prd: 400
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When a workspace has no fleets yet, should the FLEETS entry of the arcade's menu disappear, or stay and open the invitation to raise your own fleets?

## The decision, in plain words

It stays. With no fleets it opens the invitation screen, which tells the owner where to set fleets up and a member to ask the owner, instead of the empty fleets wall.

## The intro, for fun

An empty hangar can still have a sign on the door.

## The punchline, for fun

So the door stays, and the sign says: build your own ships.

## The options, in plain words

A. Keep FLEETS on the menu; with no fleets it opens the invitation screen.
B. Hide FLEETS from the menu with no fleets; the invitation shows only if the fleet step is reached some other way.
C. Hide FLEETS, and show the invitation once, right after the hero is built, for a workspace with no fleets.

## What I had to decide

The spec asks both to hide the fleets wall when there are no fleets and to show the invitation on the fleet screens. With the fleet step skipped when there are no fleets, hiding the menu entry too would leave the invitation nowhere a person could reach it.

## What I did meanwhile

The FLEETS entry stays on the menu, its hint reads that there are no fleets yet, and it opens the invitation screen in place of the wall. The fleet column in the Hall of Heroes and TOP FLEETS are hidden.

## What it costs to change later

A constant: dropping the entry when there are no fleets is one condition in the menu's list, and the invitation screen stays for the fleet step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say which screen a member of a workspace with no fleets reads the invitation on. (author)

```

<!-- /omni-outbox-settled: s2-01-fleets-menu-with-none -->

<!-- omni-outbox-settled: s2-02-disbanded-with-no-fleets -->

## s2-02-disbanded-with-no-fleets — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-disbanded-with-no-fleets
prd: 400
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

A player whose fleet was retired is asked to pick a new one. What happens when the workspace has no other fleet left to pick?

## The decision, in plain words

They play on. While another fleet flies they are sent to pick one, as today; when none does, they go straight to the menu, still shown under their retired fleet's name.

## The intro, for fun

The ship was retired, and the harbour is empty.

## The punchline, for fun

The captain keeps sailing the old flag until a new one is raised.

## The options, in plain words

A. Let them play on under their retired fleet's name until a fleet flies again.
B. Make them solo automatically, clearing their retired fleet.
C. Show them the invitation screen and let them go on to the menu from it.

## What I had to decide

The spec makes a fleet optional and says a player is ready once they have a player row, but also keeps sending a player whose fleet was retired to pick again. With no active fleet, that pick screen would be the invitation, a dead end.

## What I did meanwhile

A player whose fleet was retired counts as ready when no fleet is active, and is sent to pick again only while at least one fleet is active. Their stored fleet is left as it is.

## What it costs to change later

A constant: one condition in the rule that says who is ready.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether such a player should read SOLO instead of their retired fleet's name was not settled. (author)

```

<!-- /omni-outbox-settled: s2-02-disbanded-with-no-fleets -->

<!-- omni-outbox-settled: s5-01-dashboard-play-copy -->

## s5-01-dashboard-play-copy — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-dashboard-play-copy
prd: 400
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The dashboard used to tell someone who has not played yet to join a fleet. Now that fleets are optional, what should that line say instead?

## The decision, in plain words

It now reads "Play in the arcade to get your hero and your score", and still links to the arcade.

## The intro, for fun

The dashboard stopped asking newcomers to pick a crew before they even have a cape.

## The punchline, for fun

Heroes first, crews later, paperwork never.

## The options, in plain words

A. Play in the arcade to get your hero and your score (built).
B. Build your hero in the arcade to start scoring.
C. Start playing in the arcade: your hero and your score will show here.

## What I had to decide

Keep this wording, or give the exact sentence the card should show.

## What I did meanwhile

The card shows the new sentence; nothing else changes.

## What it costs to change later

One sentence and its test to change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks only that the card no longer tell a member to join a fleet; it gives no replacement words (author).

```

<!-- /omni-outbox-settled: s5-01-dashboard-play-copy -->

<!-- omni-outbox-settled: s3-01-fleets-card-in-app-sections -->

## s3-01-fleets-card-in-app-sections — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-fleets-card-in-app-sections
prd: 400
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Where does the new Fleets card on the app's home page come from?

## The decision, in plain words

It is one more entry in the list of the app's sections, after the knowledge map, so the dashboard and every other place that lists the sections show it the same way.

## The intro, for fun

The app's home had four doors, and a fifth one knocked.

## The punchline, for fun

It got a spot in the hallway list, like everyone else.

## The options, in plain words

A. Fleets is the fifth entry of the app's section list (built).
B. The card is drawn apart, after the sections, by the dashboard's card file alone, and the dashboard's tests change instead.
C. No card on the app's home: Fleets is reached from the top bar's menu.

## What I had to decide

Keep Fleets as the fifth section of the app, or draw its card apart from the other sections.

## What I did meanwhile

Fleets is the fifth entry of the app's section list, and the two tests that named the four sections now name five.

## What it costs to change later

One entry and two test lines to move back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gave this slice only the dashboard's card file; the documented place to add a section is the section list, outside that ground, so the list and its two tests were changed.

```

<!-- /omni-outbox-settled: s3-01-fleets-card-in-app-sections -->

<!-- omni-outbox-settled: s3-02-member-cannot-see-owner-name -->

## s3-02-member-cannot-see-owner-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-member-cannot-see-owner-name
prd: 400
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The fleets page tells a member who may change fleets. Should it name the owner, when a member cannot yet find out who the owner is?

## The decision, in plain words

It reads, word for word, Only @owner can change fleets. A member is not allowed to see other members' roles, so the page cannot name the owner without a new database change.

## The intro, for fun

Somebody runs the hangar, and the sign on the door just says the boss.

## The punchline, for fun

Knock anyway, the boss is probably friendly.

## The options, in plain words

A. The line reads Only @owner can change fleets. word for word (built).
B. A new database function names the owner to members, and the line reads their GitHub handle.
C. The line reads Only the workspace's owner can change fleets.

## What I had to decide

Keep the line as it is, or have the database tell members who the owner is so the page can name them.

## What I did meanwhile

The line reads Only @owner can change fleets. for every member.

## What it costs to change later

A small database function plus one line on the page, whenever the owner's name should appear.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec quotes the line with @owner, which may be the owner's handle or the word itself; members can read only their own membership, so the page could not look it up.

```

<!-- /omni-outbox-settled: s3-02-member-cannot-see-owner-name -->

<!-- omni-outbox-settled: s4-01-demo-fleets-invented -->

## s4-01-demo-fleets-invented — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-demo-fleets-invented
prd: 400
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

What should the practice world show as fleets, now that it may not show the company's own?

## The decision, in plain words

The practice world keeps five made-up fleets and one retired one, and the home page's trading cards show them. Visitors who are signed out, or whose workspace could not be read, see no fleet at all.

## The intro, for fun

Five fleets were written out of the story, so five understudies got the part.

## The punchline, for fun

Nobody asked the understudies for their real names.

## The options, in plain words

A. Made-up fleets in the practice world; none signed out or on a failed read, as built.
B. No fleet at all in the practice world: every practice player flies solo, and the home page shows one card per mascot.
C. Made-up fleets, and the home page shows one card per mascot instead of fleets.

## What I had to decide

Whether the practice world, used for local runs, previews, the shareable page and the home page's cards, keeps made-up fleets or has none at all.

## What I did meanwhile

The practice world flies Builders, Inklings, Coiners, Night Owls and Corsairs, with Capes retired; one flies no mascot, to show a fleet drawn as a hero. The signed-out screen and a failed read get no fleet at all.

## What it costs to change later

One list of six entries in the practice world; the home page's cards follow it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says the practice world loses the company's fleets, not whether it keeps any fleet at all
- (author) whether the home page's trading cards should show made-up fleets or one card per mascot

```

<!-- /omni-outbox-settled: s4-01-demo-fleets-invented -->

<!-- omni-outbox-settled: s4-02-scan-reach-and-spy-key -->

## s4-02-scan-reach-and-spy-key — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-scan-reach-and-spy-key
prd: 400
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Where does the check for leftover company fleets look, and what about the spy mascot, whose key is the same word as one of the company's fleets?

## The decision, in plain words

The check reads the game's code: the arcade app, the shared packages and the game engine, outside the tests. The spy's key may appear only where flavour is looked up by mascot: the picture library, the sounds and the home page's card rules.

## The intro, for fun

The spy and the fleet share a name, which is exactly what a spy would want.

## The punchline, for fun

The check lets him in, but only through three doors.

## The options, in plain words

A. Game code only, with the spy's key allowed in the three mascot tables, as built.
B. The whole repository outside records and tests, and the other app's word list cleaned too.
C. Rename the spy mascot's key so the check can refuse the word everywhere, with a database change for the fleets already using it.

## What I had to decide

The reach of the leftover check, and how it treats the spy mascot's key, which the spec did not list among the mascot keys.

## What I did meanwhile

The check skips the planning records, the design notes, the other app's list of game words and the database checks, which name the company's fleets as history or test data. It fails on the retired and pirate fleet names anywhere it reads, and on the spy's key outside the three mascot tables.

## What it costs to change later

A folder list and a file list in one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec lists beaver, octopod and picsou as mascot keys but not the spy's, which the database already accepts as one
- (author) whether the other app's list of refused game words, which names the pirate fleet, should also be cleaned

```

<!-- /omni-outbox-settled: s4-02-scan-reach-and-spy-key -->

<!-- omni-outbox-settled: s4-03-outside-territory-touches -->

## s4-03-outside-territory-touches — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-outside-territory-touches
prd: 400
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

May this slice touch a few lines of arcade screens that belong to another slice, to finish removing the company's fleets?

## The decision, in plain words

Yes, the smallest possible touch: the arcade hands a fleet's mascot to the sound it plays, the mascot parade reads the shared mascot list, and two code comments stop naming company fleets. The practice data file for local databases is not regenerated.

## The intro, for fun

The last few crumbs were on the neighbour's side of the table.

## The punchline, for fun

We swept them anyway and left a note on the fridge.

## The options, in plain words

A. Touch the few lines outside the slice, and leave the local practice database file as it is, as built.
B. Touch the lines, and regenerate the local practice database file too.
C. Keep the old sound call by name and look the mascot up inside the sound, leaving the arcade's main screen untouched.

## What I had to decide

Whether to change files outside this slice's area: the arcade's main screen, where a fleet's sound is played, the arcade's fleet helpers, and two comments on the fleet screens.

## What I did meanwhile

Two calls now pass the whole fleet to the sound, the parade's list comes from the shared mascot library, and two comments were reworded. The local practice database file still holds the company's fleets until someone regenerates it.

## What it costs to change later

Four small edits, each undone by reverting a line or two.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gave the sound and the picture lookup to this slice but their callers to the arcade slice
- (author) whether the local practice database file should be regenerated in this feature

```

<!-- /omni-outbox-settled: s4-03-outside-territory-touches -->

<!-- omni-outbox-settled: s4-04-title-invite-placement -->

## s4-04-title-invite-placement — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-title-invite-placement
prd: 400
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Where does the signed-out title screen show the invitation to raise your own fleet?

## The decision, in plain words

On the title screen itself, just above PRESS START or INSERT COIN, while the mascots fly around the commander where the fleets used to. It shows whenever no fleet flies, signed in or not.

## The intro, for fun

The title screen had an empty seat where five fleets used to hover.

## The punchline, for fun

The mascots took the seats and brought a sign.

## The options, in plain words

A. On the title phase above the call to press, whenever no fleet flies, as built.
B. Only when signed out, never for a signed-in workspace with no fleets.
C. In the story phase, in place of the fleets line.

## What I had to decide

Which phase of the attract loop carries the invitation, and whether a signed-in workspace with no fleets sees it too.

## What I did meanwhile

The invitation sits on the title phase above the call to press, the parade flies the first five mascots, and the story phase keeps no fleets line when there are none.

## What it costs to change later

One line of layout and one condition.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says the attract mode shows the tagline and the parade, not which of its phases
- (author) the layout was checked by tests of positions, not by eye in a browser

```

<!-- /omni-outbox-settled: s4-04-title-invite-placement -->
