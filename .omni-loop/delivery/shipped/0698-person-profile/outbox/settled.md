# Settled outbox items — PRD 698

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-chip-links-members-only -->

## s1-01-chip-links-members-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-chip-links-members-only
prd: 698
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Should the name of someone who is not a member of the workspace, like an outside contributor, also be clickable, even though their profile page would only say they are not in this workspace?

## The decision, in plain words

Only members are clickable. Someone outside the workspace keeps a plain name with their picture, as today, so no click leads to an empty page.

## The intro, for fun

A stranger's name on the board: open door, or just a nice nameplate?

## The punchline, for fun

We went with the nameplate. Nobody enjoys a door that opens onto a wall.

## The options, in plain words

A. Members only: a member's chip links, an outsider's stays plain
B. Everyone with a login: an outsider's chip links too, and lands on 'not in this workspace'

## What I had to decide

Whether people outside the workspace get a clickable name that opens the 'not in this workspace' page.

## What I did meanwhile

Outsiders' chips stay plain; members' chips link to their profile.

## What it costs to change later

One line in the people directory to also carry the login for an outsider looked up by login.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says byLogin fills the login, without saying whether that includes people outside the workspace (author)

```

<!-- /omni-outbox-settled: s1-01-chip-links-members-only -->

<!-- omni-outbox-settled: s1-02-chip-tests-outside-territory -->

## s1-02-chip-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-chip-tests-outside-territory
prd: 698
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Making names and fleets clickable changed how they look in the page's code on the home, workspace, fleet and PRD pages too, so their existing checks had to be updated. Is that fine, and should the fleet page's own title stay unclickable?

## The decision, in plain words

The existing checks on those pages now expect the clickable names and fleets, with nothing else changed on them. The fleet page's own title stays plain, since it would only lead back to the same page.

## The intro, for fun

One small click for a chip, a handful of rewritten expectations elsewhere.

## The punchline, for fun

The fleet page's title declined the promotion: linking to itself felt a bit vain.

## The options, in plain words

A. Keep: checks updated, fleet page title plain
B. Keep the checks, but make the fleet page title a link too

## What I had to decide

Whether updating those checks outside the slice's planned area is accepted, and whether the fleet page's title should link to itself.

## What I did meanwhile

Four check files outside the planned area expect the new links; the fleet page's title stays plain.

## What it costs to change later

Drop one setting on the fleet page's title to make it a link; the check updates follow the chips either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 did not list the home, workspace board, fleet-of-home and PRD page check files, whose chips now link by design (author)

```

<!-- /omni-outbox-settled: s1-02-chip-tests-outside-territory -->

<!-- omni-outbox-settled: s3-01-pull-request-see-all -->

## s3-01-pull-request-see-all — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-pull-request-see-all
prd: 698
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When someone has more than ten pull requests or reviews in the chosen period, where should the see all link under those lists take you? The spec names where see all goes for PRDs and fixes, but not for pull requests.

## The decision, in plain words

See all opens a GitHub search of that person's pull requests (or reviews) across the workspace's tracked repositories. It does not narrow to the chosen period.

## The intro, for fun

Ten pull requests fit on the page. The eleventh needs somewhere to go.

## The punchline, for fun

For now it goes to GitHub, which never runs out of room.

## The options, in plain words

A. A GitHub search of their pull requests or reviews in the tracked repositories (what is built).
B. The Engineering board for the same period, which lists everyone, not only this person.
C. No see all under these two lists: ten rows and a line saying more exist.

## What I had to decide

Where see all under the profile's pull requests and reviews should lead.

## What I did meanwhile

It opens GitHub's search, for that person, over the tracked repositories.

## What it costs to change later

One address to change in the profile module; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person would rather stay in the app, on an Engineering page filtered to that person, which does not exist yet (author)

```

<!-- /omni-outbox-settled: s3-01-pull-request-see-all -->

<!-- omni-outbox-settled: s3-02-profile-stage-links -->

## s3-02-profile-stage-links — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-profile-stage-links
prd: 698
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

On someone's profile, the PRDs count at each stage is a link. Should it open the PRD list filtered to that person, or to everyone?

## The decision, in plain words

Each stage count opens the PRD list at that stage for that person, using the person filter another part of this same feature adds to the PRD list.

## The intro, for fun

Home's stage counts say mine. On someone else's page, mine would be the wrong person.

## The punchline, for fun

So the counts point at them instead of at you.

## The options, in plain words

A. The PRD list at that stage, for that person (what is built).
B. The PRD list at that stage, for everyone, as the fleet and workspace boards do.
C. The same link as on Home, which shows the viewer's own PRDs.

## What I had to decide

Where the profile's PRDs stage counts lead.

## What I did meanwhile

They open the PRD list at that stage, filtered to the person whose profile it is.

## What it costs to change later

One address in the profile module; until the person filter on the PRD list merges, the link shows everyone's PRDs at that stage.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the person filter on the PRD list is settled by the spec; only whether the profile should use it is open

```

<!-- /omni-outbox-settled: s3-02-profile-stage-links -->

<!-- omni-outbox-settled: s4-01-prd-opener-rule -->

## s4-01-prd-opener-rule — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-prd-opener-rule
prd: 698
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When the PRD list is narrowed to one person, should it also count PRDs whose GitHub issue they opened, even when someone else started the PRD in the app?

## The decision, in plain words

It counts only the PRDs that person started in the app, the same rule the list already uses for your own PRDs. A PRD read straight from GitHub, with no one recorded as starting it, shows under nobody.

## The intro, for fun

Who opened this PRD: the person who started it here, or the one who filed the issue?

## The punchline, for fun

We kept the answer the list already gives you about yourself.

## The options, in plain words

A. Only the PRDs they started in the app, as the list does for you (what is built)
B. Also the PRDs whose GitHub issue they opened, reading GitHub for each listed PRD
C. Change the rule for everyone, your own PRDs included, to count the issue's author too

## What I had to decide

Whether a person's PRDs include the ones whose GitHub issue they opened, as the spec's wording suggests, or only the ones they started in the app, as the list's own filter for you does today.

## What I did meanwhile

A person's PRDs are the ones they started in the app, exactly as your own PRDs are chosen today.

## What it costs to change later

A small change in the list's filter and one extra GitHub read per listed PRD; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the profile's PRDs follow the rule the list uses for you, and also names the issue's author; the list for you today only looks at who started the PRD in the app
- (author) Counting the issue's author would add a GitHub read to the PRD list, which a recent change removed on purpose

```

<!-- /omni-outbox-settled: s4-01-prd-opener-rule -->

<!-- omni-outbox-settled: s5-01-profile-work-period-by-activity -->

## s5-01-profile-work-period-by-activity — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-profile-work-period-by-activity
prd: 698
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

On someone's profile, which PRDs and fixes belong to the chosen week, month or season: the ones they started in that time, or the ones that moved in that time?

## The decision, in plain words

A PRD or a fix shows when something happened on it during the chosen time, even if it was started earlier. That matches how the lists already sort by latest activity.

## The intro, for fun

A PRD started in June and shipped this week: is it this week's news?

## The punchline, for fun

We said yes. Old ideas still count when they finally move.

## The options, in plain words

A. Latest activity within the period (what is built)
B. Started within the period, so an older PRD that moved this week does not show
C. Started or had activity within the period, whichever is later

## What I had to decide

Whether the profile's PRDs, bug fixes and visual updates are chosen by when they were started or by their latest activity.

## What I did meanwhile

Each list keeps the rows whose latest activity falls in the chosen period, newest first.

## What it costs to change later

One date to swap in the profile module; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says each list is filtered by the chosen period without naming which date counts

```

<!-- /omni-outbox-settled: s5-01-profile-work-period-by-activity -->

<!-- omni-outbox-settled: s5-02-profile-work-one-workspace -->

## s5-02-profile-work-one-workspace — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-profile-work-one-workspace
prd: 698
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

Someone in two workspaces may have PRDs and fixes in both. Should their profile list only the ones of the workspace the profile is about, while see all shows every workspace you share?

## The decision, in plain words

The profile lists only the PRDs and fixes of the workspace it is about, as its board does. See all opens the full list, which covers every workspace you both belong to.

## The intro, for fun

Two workspaces, one person, one profile page.

## The punchline, for fun

The profile stays home; see all is the one that travels.

## The options, in plain words

A. Only the profile's workspace (what is built)
B. Every workspace the viewer shares with them, matching see all

## What I had to decide

Whether the profile's PRD and fix lists stay within the profile's workspace or span every workspace the viewer shares with that person.

## What I did meanwhile

The lists keep the profile's workspace only; see all opens the lists as they are, across the viewer's workspaces.

## What it costs to change later

One filter to remove in the profile module; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec resolves the profile in one workspace and says never to show another workspace's data, while the see all lists span all of the viewer's workspaces

```

<!-- /omni-outbox-settled: s5-02-profile-work-one-workspace -->
