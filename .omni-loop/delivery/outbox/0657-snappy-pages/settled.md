# Settled outbox items — PRD 657

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-github-login-from-the-session -->

## s2-01-github-login-from-the-session — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-github-login-from-the-session
prd: 657
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The quick sign-in check no longer returns the list of accounts a person linked. Where should the app find their GitHub name now?

## The decision, in plain words

The app reads the GitHub name from the profile details the session already carries, which GitHub sign-in fills with the same name.

## The intro, for fun

The fast badge check at the door does not list every club card in your wallet.

## The punchline, for fun

So we read the name printed on the badge itself, which says the same thing.

## The options, in plain words

A. A: read the GitHub name from the session's profile details (built).
B. B: when the profile details carry no GitHub name, ask the sign-in service for the full account once per request.
C. C: always ask the sign-in service for the full account in the page, as before, and only speed up the check at the door.

## What I had to decide

Whether the GitHub name read from the session's profile details is good enough, or whether pages should ask the sign-in service for the full account when a name is missing.

## What I did meanwhile

The name comes from the session's profile details for a GitHub sign-in; an account with no GitHub name there shows no login, as an account with no linked GitHub did before.

## What it costs to change later

Low: one small function builds the person from the session, and swapping it back to a full account read is a few lines, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Not checked against a live production session that the profile details carry the GitHub name for every existing account (author).

```

<!-- /omni-outbox-settled: s2-01-github-login-from-the-session -->

<!-- omni-outbox-settled: s2-02-waiting-count-from-the-shared-list -->

## s2-02-waiting-count-from-the-shared-list — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-waiting-count-from-the-shared-list
prd: 657
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The dashboard's waiting-for-you tile used to read the question tables on its own. Now that the sidebar already read the same questions for the page, should the tile count from that list?

## The decision, in plain words

The tile counts from the list the sidebar read, so the questions are read once per page. A question that is both yours and shared with you now counts once, not twice.

## The intro, for fun

Two people counting the same pile of letters rarely agree on the one addressed to both of them.

## The punchline, for fun

Now one person counts, and that letter counts once.

## The options, in plain words

A. A: count from the list the sidebar read, once per page (built).
B. B: keep the tile's own read of the question tables, a second read per page.

## What I had to decide

Whether counting a question once when it is both yours and shared with you is right, and whether the tile may say it could not load when the sidebar's list could not be read.

## What I did meanwhile

The tile shows the same number as the sidebar's list. When that list cannot be read, the tile says it could not load, and the rest of the dashboard shows.

## What it costs to change later

Low: the tile can go back to its own read by dropping one argument, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a question can be both your own and shared with you in practice was not checked (author).

```

<!-- /omni-outbox-settled: s2-02-waiting-count-from-the-shared-list -->

<!-- omni-outbox-settled: s2-03-page-tests-outside-the-slice -->

## s2-03-page-tests-outside-the-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-page-tests-outside-the-slice
prd: 657
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Several existing page tests outside this part pretend to be the sign-in service with the old slow check: should this part update them too?

## The decision, in plain words

Yes: the stand-ins in seven existing test files now also answer the quick check, and a few now match the person by id rather than the whole record. What those tests check is unchanged.

## The intro, for fun

The rehearsal actors still knew only the old script.

## The punchline, for fun

We handed them one new line, and the play is the same.

## The options, in plain words

A. A: update the stand-ins in the existing tests (built).
B. B: leave those tests failing for the owning part to fix, which blocks this part's merge.

## What I had to decide

Whether these test-only edits outside the slice's own ground are acceptable, or whether each page's own part should own them.

## What I did meanwhile

The seven test files carry the new stand-in; no product code outside the slice changed.

## What it costs to change later

Low: test files only, each edit a few lines, easy to take back or move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The engineering, fixes, switch and dossier page tests belong to no slice of this plan, so no sibling part should touch them in this wave (author).

```

<!-- /omni-outbox-settled: s2-03-page-tests-outside-the-slice -->

<!-- omni-outbox-settled: s3-01-link-attribute-order-tests -->

## s3-01-link-attribute-order-tests — adopted

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
id: s3-01-link-attribute-order-tests
prd: 657
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new sidebar links write their attributes in a different order, which broke three older page checks that read the marked link a fixed way. May the slice adjust those checks, though they sit outside its own ground?

## The decision, in plain words

The three checks now find the marked link whatever the order of its attributes. What they check did not change: exactly one sidebar entry is marked as the current page.

## The intro, for fun

The links learned manners and now say where they are before saying where they go.

## The punchline, for fun

Three old checks were not ready for such politeness, so they got a little update.

## The options, in plain words

A. Adjust the three checks to read the marker in any attribute order.
B. Keep the sidebar on plain anchors and give up soft navigation.
C. Move the three checks into the slice's territory in the plan and leave them as edited.

## What I had to decide

Whether a slice may adjust tests outside its declared ground when its change only reorders markup.

## What I did meanwhile

The three tests read the current-page marker in any attribute order; the sidebar and app bar use next/link.

## What it costs to change later

Undoing it is reverting three test lines; no product code outside the slice changed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan did not list apps/galaxy/src/switch/headers.test.ts, apps/galaxy/src/switch/render.test.ts or apps/galaxy/src/dossier/page/page.test.ts in s3's territory, because nobody foresaw next/link reordering attributes (author).
- apps/galaxy/src/dossier/page/page.test.ts is inside s5's and s10's neighbourhood; a merge conflict there is possible but small (author).

```

<!-- /omni-outbox-settled: s3-01-link-attribute-order-tests -->

<!-- omni-outbox-settled: s8-01-season-cache-key-wider -->

## s8-01-season-cache-key-wider — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s8
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-season-cache-key-wider
prd: 657
slice: s8
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Should the saved copy of the season also be thrown away when an older event arrives late, or when someone edits a fleet or a sector, even though the newest event did not change?

## The decision, in plain words

Yes. Besides the newest event and the day, the saved season is also tied to how many events exist and to the fleets and sectors, so a late event or a fleet edit shows at once instead of the next day.

## The intro, for fun

The season now keeps a saved copy, like a scoreboard photo taken after the last goal.

## The punchline, for fun

A late goal or a new team colour now retakes the photo, even if the last goal did not change.

## The options, in plain words

A. Key on the newest event, the event count, the sectors and fleets, and the UTC day (built).
B. Key on the newest event and the UTC day only, as the spec says: a late event or a fleet edit shows the next day.
C. Key as in B, and have the settings pages and the game workflow clear the cache tag when they write.

## What I had to decide

Whether the saved season follows only the newest event and the day, as the spec says, or also the event count and the fleets and sectors.

## What I did meanwhile

The key carries the workspace, the newest event's id and time, the event count, a fingerprint of the sectors and fleets, and the UTC day. The count comes back with the newest-event query itself, and the sectors and fleets were already read on every page view.

## What it costs to change later

Nothing to undo but the key: dropping the count and the fingerprint from seasonKey is a one-line change, and the cache refills on its own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The game writes the ledger insert-only, but can insert events dated before the newest one (history projected from GitHub): the spec's key would miss those until the next UTC day. (author)
- Whether the exact count stays cheap on a very large ledger was not measured; s9's indexes cover the workspace filter. (author)

```

<!-- /omni-outbox-settled: s8-01-season-cache-key-wider -->

<!-- omni-outbox-settled: s10-01-prd-page-github-part-not-live -->

## s10-01-prd-page-github-part-not-live — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s10
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-01-prd-page-github-part-not-live
prd: 657
slice: s10
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The PRD page now reloads itself only when a new version or a new question round appears. Should a new stage, a changed outbox count, an answer typed on GitHub, or an answer given in another tab still show without reloading the page?

## The decision, in plain words

They no longer show on their own: the page stops asking for them and shows them the next time it is opened or reloaded. New versions and new rounds still appear within seconds.

## The intro, for fun

The page used to twitch at every whisper from GitHub; now it waits for real news.

## The punchline, for fun

Quieter page, but a reply typed on GitHub waits for the next reload.

## The options, in plain words

A. Refresh only on a new version or a new round; stage, outbox count and outside answers show at the next load (built)
B. Keep A, and add a small live stage and outbox badge that re-reads that part on its own every 15 seconds
C. Also refresh the whole page when an answer lands, as before

## What I had to decide

Whether the stage, the outbox count and answers typed elsewhere must still appear live on an open PRD page.

## What I did meanwhile

They show at the next load of the page; new versions and new rounds still appear within about 2 seconds.

## What it costs to change later

Option B is one small component that re-reads the stage and outbox part through the existing server call, without re-rendering the whole page. Option C is a one-line change back in the page's watcher.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the GitHub pill refreshes on its own through its existing server action, but no such pill refresh exists today; the server call it would use is left in place, now unused (author)
- Whether an answered count moving without a new round should refresh was not settled by the spec; read strictly, it does not (author)

```

<!-- /omni-outbox-settled: s10-01-prd-page-github-part-not-live -->
