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

<!-- omni-outbox-settled: s4-01-stream-outside-territory -->

## s4-01-stream-outside-territory — adopted

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
id: s4-01-stream-outside-territory
prd: 657
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Making a PRD's page show before GitHub answers meant changing the part that builds that page and the existing page tests, which were not on this step's list. Is that all right?

## The decision, in plain words

The PRD page's builder now reads GitHub beside the page instead of before it, and the existing page tests check what a page ends up as once every piece has arrived. Nothing a person sees changed, apart from the page arriving sooner.

## The intro, for fun

The plan gave this step a list of rooms to paint, and one door was in the hallway.

## The punchline, for fun

The door is painted the same colour, and the hallway looks the same as before.

## The options, in plain words

A. Keep the change: the PRD page reads GitHub beside the page, and the tests read the finished page (built).
B. Undo the page builder change: the PRD page waits for GitHub as before, behind its loading skeleton only, and its tests go back as they were.

## What I had to decide

Whether s4 may change apps/galaxy/src/dossier/page/DossierRoute.tsx (the numbered PRD page now returns a streamed page, with its GitHub reads started and not awaited) and the page tests outside its territory (src/dashboard/page.test.ts, src/dashboard/board/page.test.ts, src/dashboard/fleet/page.test.ts, src/dossier/page/page.test.ts, src/fixes/routes.test.ts), which now read a streamed page through src/dossier/page/stream/settled.ts or unwrap the Streamed block.

## What I did meanwhile

Changed them: DossierRoute.tsx keeps its gate, its read and its redirects; a numbered PRD goes to src/dossier/page/stream/DossierStream.tsx, a draft and a fix render as before. The tests keep every assertion they had and read the settled page; /app's test gains the streamed and workspace-out-of-reach cases.

## What it costs to change later

Reverting is two files of code and five test helpers; no stored data, no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant the page builder to stay untouched, or simply did not list it, is not written anywhere.

```

<!-- /omni-outbox-settled: s4-01-stream-outside-territory -->

<!-- omni-outbox-settled: s4-02-board-streams-as-one-block -->

## s4-02-board-streams-as-one-block — adopted

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
id: s4-02-board-streams-as-one-block
prd: 657
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The plan asked for each tile and each section of a dashboard board to arrive on its own, but the board is drawn by one piece this step could not split. Is streaming the whole board as one block enough?

## The decision, in plain words

On your own dashboard, your hero, the waiting tile and the board each arrive on their own. On the workspace and fleet dashboards, the whole board arrives as one block under a skeleton of its size, because all its numbers come from the same few reads.

## The intro, for fun

The menu promised each dish would come out as soon as it was ready.

## The punchline, for fun

The dishes on the board share one oven, so they come out on one tray.

## The options, in plain words

A. Stream the board as one block, and Home's three parts on their own (built).
B. Split the board into sections that each wait for their own read, in a follow-up step that may change the board's own files.

## What I had to decide

Whether a board's sections (tiles, charts, People, Repositories, fleet ranking) must each stream in their own Suspense, or whether the board streams as one block. Board.tsx (src/dashboard/board/) is outside s4's territory and exports only Board, and the sections all draw from loadBoard's five reads, settled together.

## What I did meanwhile

/app streams three blocks (hero, Waiting for you, the board) from src/dashboard/stream/home.ts, each with its own skeleton and its own 'could not load'. /app/workspace and /app/fleet stream their whole screen in one Streamed block under the board skeleton; the fleet's picker and heading come from the same read as its board.

## What it costs to change later

Splitting the board later is a change inside the board's folder and the stream folder; no stored data, no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether one board block meets the '1 s warm load' target on production is not measured yet: the timings after merge will tell.

```

<!-- /omni-outbox-settled: s4-02-board-streams-as-one-block -->

<!-- omni-outbox-settled: s4-03-frame-waits-for-the-bell -->

## s4-03-frame-waits-for-the-bell — adopted

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
id: s4-03-frame-waits-for-the-bell
prd: 657
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The frame around every page, the sidebar and the top bar, still waits for the count of questions waiting for you before it is sent. Should that count arrive on its own instead, after the frame?

## The decision, in plain words

The frame still reads the count first: it is one quick read, shared with the page, and since clicks no longer reload the whole page it is read once per visit. Every slow part of the pages themselves now arrives on its own.

## The intro, for fun

The front door opens fast, but the doorman still counts your letters first.

## The punchline, for fun

He counts quickly, and he only does it when you walk in from the street.

## The options, in plain words

A. Keep reading the count before the frame (built).
B. Send the frame without the count, and let the bell fill in right after, in its own block or from the browser's first poll.

## What I had to decide

Whether the layouts (app/app/layout.tsx, app/prd/layout.tsx) send the frame before the waiting questions are read. viewerLive() in src/nav/viewer.ts reads the claims, the workspace and the questions before AppShell renders; streaming the bell apart means changing src/nav, which is outside s4's territory.

## What I did meanwhile

The layouts are unchanged: they await viewerLive(). Every route's loading.tsx sits inside the layout, so its skeleton is sent as soon as the layout's reads are done, and the page's heavy blocks stream after it.

## What it costs to change later

A change in the frame's code later, no stored data and no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the frame's reads keep the first paint under 200 ms on production is not measured: the timings run after merge will tell.

```

<!-- /omni-outbox-settled: s4-03-frame-waits-for-the-bell -->

<!-- omni-outbox-settled: s4-04-prd-filters-arrive-with-the-list -->

## s4-04-prd-filters-arrive-with-the-list — adopted

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
id: s4-04-prd-filters-arrive-with-the-list
prd: 657
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

On the PRD list, the plan asked for the filters to show before the rows, but the filters' repository choices come from the same read as the rows. Should the filters wait for the rows?

## The decision, in plain words

The heading and a grey outline of the filters show at once, and the real filters arrive together with the rows.

## The intro, for fun

The shop opens its doors, but the price tags are still in the delivery van.

## The punchline, for fun

The shelves are already out, and the tags come on the same truck as the goods.

## The options, in plain words

A. The filters arrive with the rows, under a skeleton of their size (built).
B. Show the filters at once with the search and the draft-or-PRD pick, and fill in the repository choices when the rows arrive.

## What I had to decide

Whether /prd renders its filters outside the list's Suspense. The filter form's repository choices (historyChoices) and the 'No PRD yet' state that hides the filters both come from the dossier rows, and DossierHistory.tsx, which draws filters and rows together, is outside s4's territory.

## What I did meanwhile

app/prd/page.tsx decides the demo, closed and signed-out cases at once, then streams the whole list (filters, stage bar, rows) in one Streamed block under a skeleton of the heading, the filters and six rows. The reads stay in page.tsx, where s5 swaps the GitHub reader.

## What it costs to change later

A change to the list's drawing later; no stored data, no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the filters showing a moment later matters to people using the list is unknown.

```

<!-- /omni-outbox-settled: s4-04-prd-filters-arrive-with-the-list -->

<!-- omni-outbox-settled: s4-05-prd-page-sent-twice -->

## s4-05-prd-page-sent-twice — adopted

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
id: s4-05-prd-page-sent-twice
prd: 657
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

A PRD's page now shows as soon as the database answers, then shows again, complete, when GitHub answers, so a long spec travels twice. Is that trade fine?

## The decision, in plain words

Yes for now: the page is readable at once, and the complete copy quietly replaces the first one with the stage button, the GitHub links, the Outbox and the Retro filled in.

## The intro, for fun

The newspaper arrives early, with a blank box where the weather goes.

## The punchline, for fun

Later a second copy lands on the mat, weather included, and the first one goes in the recycling.

## The options, in plain words

A. Send the page from the database first, then the complete page in its place (built).
B. Reshape the PRD page so only its GitHub parts (the stage button and links, the Outbox and Retro tabs and their badges) stream as small blocks of their own.

## What I had to decide

Whether /prd/<id> streams its GitHub pill and outbox as small blocks of their own, or as a whole-page swap. The view that draws them (dossierView in view.ts, DossierPage.tsx) builds the header, the tabs' badges and the Outbox pane from one GitHub summary, and both files are outside s4's territory.

## What I did meanwhile

src/dossier/page/stream/DossierStream.tsx renders a Suspense whose fallback is the page drawn from the database (pendingView: Outbox and Retro read 'Reading GitHub…', no GitHub badges or links) and whose content is the complete page with LiveRefresh. The shown Spec or Plan is rendered once and shared by both.

## What it costs to change later

Moving to small blocks later is a reshaping of the PRD page's view and page files; no stored data, no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How large the doubled page gets for the longest specs on production was not measured.

```

<!-- /omni-outbox-settled: s4-05-prd-page-sent-twice -->

<!-- omni-outbox-settled: s5-01-waiting-questions-stored -->

## s5-01-waiting-questions-stored — adopted

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
id: s5-01-waiting-questions-stored
prd: 657
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

The waiting list shows each question that waits on you, not just how many there are. Where should the question words come from once the list stops asking GitHub?

## The decision, in plain words

The new table keeps, beside each PRD's count, the few questions that wait on a person, so the waiting list can show them without asking GitHub.

## The intro, for fun

The plan packed a counter for the trip, but the waiting list wanted to read the postcards too.

## The punchline, for fun

So the postcards ride along in the same suitcase, and GitHub stays home.

## The options, in plain words

A. Keep the waiting questions beside each count in the new table, filled by the same recount (built).
B. Store only the count, and let the waiting list keep asking GitHub for the questions of the PRDs whose count is above zero.
C. Store only the count, and show the waiting list as a number per PRD, without the question words.

## What I had to decide

Whether prd_outbox keeps the waiting questions (rank, id and words of each human-action or high item while the feature PR is open) in a list column beside open_questions, as built, or whether the waiting outbox keeps reading GitHub for its question words.

## What I did meanwhile

The migration adds a waiting jsonb column (a list, checked by the database) to prd_outbox. The recount fills it from the same GitHub summary it counts, and GET /api/waiting/outbox builds its items from it with no GitHub call. The plan only named open_questions and synced_at.

## What it costs to change later

The table is new in this PRD, so before it ships dropping or changing the column is an edit of its migration; after it ships, one follow-up migration drops the column, and the waiting route goes back to the GitHub reader.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the waiting outbox reads prd_outbox but only names a count; it does not say where the question words come from.

```

<!-- /omni-outbox-settled: s5-01-waiting-questions-stored -->

<!-- omni-outbox-settled: s5-02-outbox-check-in-workflow -->

## s5-02-outbox-check-in-workflow — adopted

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
id: s5-02-outbox-check-in-workflow
prd: 657
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

The new database check for who may read the open-question counts only runs if the database workflow names it, and that workflow was outside this slice's ground. Should the slice add it there?

## The decision, in plain words

The slice added one step to the database workflow so the new check runs on every pull request, like the checks beside it.

## The intro, for fun

A new guard was hired, trained and given a badge, but nobody put them on the rota.

## The punchline, for fun

So the rota got one more line, written in the same pen as the others.

## The options, in plain words

A. Add the step to the database workflow in this slice (built).
B. Leave the workflow alone and add the step in a separate change after the feature merges.

## What I had to decide

Whether the new supabase/checks/prd_outbox.sql runs in the supabase workflow through its own step, added by this slice outside its territory, as built.

## What I did meanwhile

One step, 'Who may read and write the PRD outboxes', was added to .github/workflows/supabase.yml after the PRD stages step, running psql on supabase/checks/prd_outbox.sql. The check was also run once by hand against a local database, inside a transaction rolled back at the end, and passed.

## What it costs to change later

Removing or moving the step is a one-line edit of the workflow; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the check file in s5's territory but not the workflow that runs it.

```

<!-- /omni-outbox-settled: s5-02-outbox-check-in-workflow -->

<!-- omni-outbox-settled: s5-03-sync-reads-active-outboxes -->

## s5-03-sync-reads-active-outboxes — adopted

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
id: s5-03-sync-reads-active-outboxes
prd: 657
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

To keep the counts fresh, the quarter-hourly refresh now asks GitHub for the outbox of every PRD being built or waiting on its outbox, which spends some of the app's hourly GitHub allowance. Is that the right trade?

## The decision, in plain words

Every quarter hour, the refresh reads GitHub once for each PRD being built or waiting on its outbox, and stores zero for all the others without asking GitHub.

## The intro, for fun

The list stopped phoning GitHub on every visit, so now the night watch phones on a schedule instead.

## The punchline, for fun

Fewer calls overall, but the watch still has a phone bill.

## The options, in plain words

A. Recount every PRD at building or outbox on each quarter-hourly run (built).
B. Recount only on stage events and Sends, and let the quarter-hourly run store zero for PRDs that left building or outbox.
C. Recount on each run, but at most once an hour per PRD.

## What I had to decide

Whether the stages sync reads the GitHub summary of every PRD at building or outbox on each 15-minute run, as built, or only when a stage event or a Send says something changed.

## What I did meanwhile

The sync recounts each repository's PRDs after recording their stages: a PRD at building or outbox costs one GitHub summary (about 12 to 20 requests, config shared per repository by s6), any other stores 0 with no request. A summary that cannot be read keeps the stored count. With five such PRDs this is roughly 400 requests an hour, against the App's 5000 per installation.

## What it costs to change later

Changing when the sync recounts is a code change in the sync alone; nothing stored changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How many PRDs sit at building or outbox at once on production was not measured, so the real share of the GitHub budget is an estimate.

```

<!-- /omni-outbox-settled: s5-03-sync-reads-active-outboxes -->

<!-- omni-outbox-settled: s1-01-timings-baseline-owed -->

## s1-01-timings-baseline-owed — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-09-29T17:19:07Z
- Channel: feature pull request #664
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/664#issuecomment-5895134325
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Stays here: a one-off measurement for this PRD, already taken (timings.md, Before); it states no lasting rule about the product or about how to work here.
- Rank: high
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
A. A person signed in to the live site runs the timing tool once with their own session before the feature merges, and pastes its table into the timings page under Before.
```

### The item, as it was raised

```text
---
id: s1-01-timings-baseline-owed
prd: 657
slice: s1
rank: high
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The speed of the PRD list and the dashboards today has not been measured yet, because measuring needs someone signed in. Who takes that measurement, and when?

## The decision, in plain words

The measuring tool is built and the table waits with an empty before column. A person signed in to the site runs it once on the live site before this work goes live, and pastes the result into the table.

## The intro, for fun

A stopwatch is ready, the runners are ready, but nobody holds the key to the stadium.

## The punchline, for fun

Once this work ships, today's slow times are gone for good, so the before photo has to be taken first.

## The options, in plain words

A. A person signed in to the live site runs the timing tool once with their own session before the feature merges, and pastes its table into the timings page under Before.
B. Skip the before column: merge without a baseline and judge the speed target on the after numbers alone.

## What I had to decide

Whether a person runs the timing tool with their own session on the live site before the feature pull request merges, and pastes its table into timings.md under Before.

## What I did meanwhile

timings.md reads 'owed: run before merge' in every Before cell. The script, apps/galaxy/scripts/timings.mjs, is built and tested; run without a cookie it prints how to copy one from the browser, and it stops rather than time a signed-out page.

## What it costs to change later

Once the feature merges and deploys, the before numbers can no longer be measured on production, so acceptance criterion 11 would compare against nothing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No signed-in session cookie was available to the agent, and none should be: a session cookie signs in as a person. (author)

```

<!-- /omni-outbox-settled: s1-01-timings-baseline-owed -->
