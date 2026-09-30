# Settled outbox items — PRD 774

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-stuck-draft-fifteen-minutes -->

## s1-01-stuck-draft-fifteen-minutes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-stuck-draft-fifteen-minutes
prd: 774
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

If a draft stops half way because the server gave up on it, how long should the page wait before letting someone start a new one?

## The decision, in plain words

After fifteen minutes a draft that never finished is marked as failed, and the next click starts a fresh one.

## The intro, for fun

A draft that never comes back should not keep the door locked forever.

## The punchline, for fun

Fifteen minutes of patience, then we knock again.

## The options, in plain words

A. Fifteen minutes, then a new draft may start: longer than any server run lasts
B. Never: a stuck draft blocks until someone clears it by hand
C. A shorter wait, such as five minutes, with a small risk of overlapping runs

## What I had to decide

Whether fifteen minutes is the right wait before a stuck draft stops blocking the next one.

## What I did meanwhile

A draft still running after fifteen minutes is marked failed ('It stopped answering.') and a new one starts.

## What it costs to change later

One constant in the function that starts a draft, changed by a small follow-up migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says one draft at a time but not what happens when one dies before finishing (author).

```

<!-- /omni-outbox-settled: s1-01-stuck-draft-fifteen-minutes -->

<!-- omni-outbox-settled: s1-02-recheck-runs-as-the-service -->

## s1-02-recheck-runs-as-the-service — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-recheck-runs-as-the-service
prd: 774
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The weekly recheck runs with nobody signed in. May it start a draft and propose claims on its own, while every button a person presses stays for members only?

## The decision, in plain words

Yes: the recheck may start, update and finish a draft and propose drafted claims. Confirming, rejecting and web pages stay for members.

## The intro, for fun

Sunday night, nobody is signed in, and the recheck still has work to do.

## The punchline, for fun

It may suggest; only a member may say yes.

## The options, in plain words

A. The recheck writes as the server's key, for drafts and proposals only
B. The recheck writes as a stored member of each workspace
C. The recheck only reads; proposals wait for a member to open the page

## What I had to decide

Whether the unattended recheck should be allowed to write proposed claims and draft rows, and nothing else.

## What I did meanwhile

The four draft functions accept the server's own key as well as a member; every other function refuses it.

## What it costs to change later

Taking the permission back is one grant line in a follow-up migration; s4's recheck would then need another way in.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the recheck runs as galaxy with a secret, not which database identity it writes as (author).

```

<!-- /omni-outbox-settled: s1-02-recheck-runs-as-the-service -->

<!-- omni-outbox-settled: s1-03-contradicted-left-out-of-sentence -->

## s1-03-contradicted-left-out-of-sentence — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-contradicted-left-out-of-sentence
prd: 774
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

In the terminal, the business is shown as one sentence and a list. Should a claim the evidence now disputes appear in the sentence?

## The decision, in plain words

No: it stays in the list, marked as contradicted, and the sentence is made from confirmed claims only, so an agent never states it as settled.

## The intro, for fun

The pricing page says CRM, the old answer says ERP, and nobody has picked yet.

## The punchline, for fun

Until someone answers, the sentence keeps quiet about it.

## The options, in plain words

A. Leave it out of the sentence, mark it on its line
B. Keep it in the sentence with a mark, such as 'ERP (disputed)'

## What I had to decide

Whether a disputed claim belongs in the terminal's sentence while nobody has answered.

## What I did meanwhile

The sentence leaves a disputed claim out (a blank if it was the only one); its line says 'contradicted: evidence disagrees, nobody answered yet'. The JSON form carries it with its state.

## What it costs to change later

A one-line change in how the command builds the sentence.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says agents read a contradicted claim marked as such, not how the sentence shows it (author).

```

<!-- /omni-outbox-settled: s1-03-contradicted-left-out-of-sentence -->

<!-- omni-outbox-settled: s1-04-replacement-picks-first-held-value -->

## s1-04-replacement-picks-first-held-value — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-replacement-picks-first-held-value
prd: 774
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When a product already has two confirmed sizes and the evidence finds a third, which one does the new size replace?

## The decision, in plain words

The oldest one: the first confirmed value becomes disputed, and the others stay as they are.

## The intro, for fun

Two sizes on file and a third one shows up at the door.

## The punchline, for fun

The oldest one gets asked first.

## The options, in plain words

A. Replace the oldest held value
B. Replace every held value of that kind at once
C. Add it as a plain new claim when several are held

## What I had to decide

Which confirmed value a new offering or size disputes when more than one is on file.

## What I did meanwhile

The oldest confirmed (or already disputed) value of that kind is the one replaced.

## What it costs to change later

One ordering rule in the merge function, changed by a follow-up migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says offering and size hold one value, but the pick screen lets a person keep several (author).

```

<!-- /omni-outbox-settled: s1-04-replacement-picks-first-held-value -->

<!-- omni-outbox-settled: s1-05-kit-reads-missing-state-as-confirmed -->

## s1-05-kit-reads-missing-state-as-confirmed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-kit-reads-missing-state-as-confirmed
prd: 774
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When the terminal command reads the business from an Omni page that has not been updated yet, the claims carry no state. How should it read them?

## The decision, in plain words

As confirmed: an older page only ever sent confirmed claims, so nothing is lost and agents keep working.

## The intro, for fun

New terminal, old page: someone has to be polite about it.

## The punchline, for fun

No state means what it always meant: confirmed.

## The options, in plain words

A. Read a missing state as confirmed
B. Refuse the reply until the page is updated

## What I had to decide

Whether a claim without a state should read as confirmed, or the whole reply be refused.

## What I did meanwhile

A claim with no state reads as confirmed; a claim with any state other than confirmed or contradicted makes the reply refused, and the command still exits 0.

## What it costs to change later

One default in the command, changed in a later release.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec adds state to the read but says nothing of a terminal meeting a page not yet updated (author).

```

<!-- /omni-outbox-settled: s1-05-kit-reads-missing-state-as-confirmed -->

<!-- omni-outbox-settled: s2-01-which-twelve-files-first -->

## s2-01-which-twelve-files-first — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-which-twelve-files-first
prd: 774
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

A repository can hold more readable documents than the draft reads. When there are more than twelve, which ones come first, and which product write-ups count as the most recent?

## The decision, in plain words

The main readme first, then the documentation pages by name, then the most recent product write-ups, newest first, until twelve are read. The newest write-ups are the ones with the highest numbers.

## The intro, for fun

Twelve seats at the table, and more documents than chairs.

## The punchline, for fun

The readme sits first; the latest write-ups take what is left.

## The options, in plain words

A. A. Readme, then documentation pages, then the newest write-ups by number, up to twelve
B. B. Readme, then the newest write-ups, then documentation pages
C. C. Keep room for each kind, such as four documentation pages and seven write-ups
D. D. Find the write-ups that shipped last from their merge dates, at the price of more GitHub calls

## What I had to decide

Whether the readme and the documentation pages should come before the product write-ups when a repository holds more than twelve, and whether the highest number is a fair stand-in for the most recently shipped.

## What I did meanwhile

The draft reads the readme, then the documentation pages in name order, then the product write-ups from the highest number down, and stops at twelve files per repository.

## What it costs to change later

An ordering rule in one function; nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the three kinds of files and the cap of twelve, but not which kind wins when they do not all fit, nor how to tell which write-up shipped last without extra calls to GitHub.

```

<!-- /omni-outbox-settled: s2-01-which-twelve-files-first -->

<!-- omni-outbox-settled: s2-02-web-pages-go-on-first-product -->

## s2-02-web-pages-go-on-first-product — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-web-pages-go-on-first-product
prd: 774
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

A pasted web page belongs to the business, not to one product. When it names what the company sells, who it sells to or whom it competes with, which product should that finding go on?

## The decision, in plain words

It goes on the first product of the business, the one the page shows while there is only one. Regions go on the business as always.

## The intro, for fun

The pricing page talks about the company, and the page wants a product to file it under.

## The punchline, for fun

When nobody says which, the first product takes the mail.

## The options, in plain words

A. A. The first product of the business
B. B. Let the person pick a product when pasting the page
C. C. Propose it on every product of the business

## What I had to decide

Whether findings from a pasted web page should land on the first product, or wait until a person says which product they belong to.

## What I did meanwhile

Every finding from a web page, other than a region, is proposed on the business's first product; findings from a repository go on the product that repository belongs to.

## What it costs to change later

One choice in how the draft picks a product; claims already proposed would need a person to move them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a web page is kept on the business, but every kind other than region belongs to a product, and it does not say which one for a web page.

```

<!-- /omni-outbox-settled: s2-02-web-pages-go-on-first-product -->

<!-- omni-outbox-settled: s5-01-business-bell-not-in-badge -->

## s5-01-business-bell-not-in-badge — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-business-bell-not-in-badge
prd: 774
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When claims wait to be checked on the Business page, should the bell's red number and the browser tab's count go up too, or should the Business line only sit inside the bell's list?

## The decision, in plain words

The Business line sits inside the bell's list only. It does not raise the red number, the tab's count or any alert, the way new documents already behave, since the digest is weekly and asks for no sound.

## The intro, for fun

A weekly digest knocks on the bell, but does it get to ring it?

## The punchline, for fun

It waits politely inside the list, no red number, no chime.

## The options, in plain words

A. A. Only a line in the bell's list, like new documents: no red number, no tab count, no alert
B. B. Count it in the red number and the tab's count as one waiting thing, still with no sound
C. C. Count each thing to check separately in the red number

## What I had to decide

Whether things to check on the Business page count in the bell's red number and the tab's count, or only show as a line in the bell's list.

## What I did meanwhile

The Business line shows in the bell's list when something waits and never adds to the red number, the tab's count, the favicon dot or the alerts. Showing it needed a small change to the bell itself, which the plan left out of this slice's ground.

## What it costs to change later

One line where the bell adds up its count, and the same where the tab's count is made; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the bell shows one group and no email or sound, but not whether it counts in the red number (author).
- The plan's ground for this slice leaves out the bell's own drawing code, which the group cannot appear without (author).

```

<!-- /omni-outbox-settled: s5-01-business-bell-not-in-badge -->

<!-- omni-outbox-settled: s3-01-marks-wait-for-thats-us -->

## s3-01-marks-wait-for-thats-us — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-marks-wait-for-thats-us
prd: 774
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When a person taps Right or Wrong on one drafted row, should that row be saved at once, or wait for the That's us button?

## The decision, in plain words

It waits: Right and Wrong only mark the row on the page, and That's us saves every row at once, rejecting those marked Wrong and confirming the others. Leaving the page before That's us forgets the marks.

## The intro, for fun

Five rows, two buttons each, and one big button at the bottom.

## The punchline, for fun

Nothing is saved until the big button says so.

## The options, in plain words

A. Marks wait for That's us, and a reload forgets them
B. Each tap saves its row at once, and That's us confirms the rest
C. Marks wait, and are kept in the browser across a reload

## What I had to decide

Whether a tap on Right or Wrong on a drafted row should save that row straight away, or only mark it until That's us.

## What I did meanwhile

Right and Wrong mark the row on the page; the pill says nothing is saved yet; That's us saves them all in one call, and a reload forgets the marks.

## What it costs to change later

A few lines in the page to save each tap at once; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec gives each row Right and Wrong and says That's us confirms every row not marked Wrong, but not whether a single tap saves anything.

```

<!-- /omni-outbox-settled: s3-01-marks-wait-for-thats-us -->

<!-- omni-outbox-settled: s3-02-draft-outcome-lines-after-watching -->

## s3-02-draft-outcome-lines-after-watching — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-draft-outcome-lines-after-watching
prd: 774
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When should the page say what a draft came to, such as nothing we could quote, and what should it say when everything it quoted is already on the page?

## The decision, in plain words

Drafted rows show on every visit, but the lines saying nothing was found, nothing is new or the draft failed show only right after a draft the person watched. When every quote matches a claim already confirmed, the page says nothing new was found instead of nothing we could quote.

## The intro, for fun

The draft came back empty handed, or did it just find what you already knew?

## The punchline, for fun

Old news gets its own polite line.

## The options, in plain words

A. Only after a watched draft, with a separate nothing-new line
B. On every visit after the latest draft, until another runs
C. Only after a watched draft, saying nothing we could quote in both cases

## What I had to decide

Whether these lines should also show on a later visit, and whether the extra nothing-new line is welcome.

## What I did meanwhile

The lines show only after a draft watched on the page; a reload shows the normal page. A draft whose quotes all matched confirmed claims says nothing new instead of nothing we could quote.

## What it costs to change later

One rule in the page's pure logic and one line of text; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the thin and nothing-found lines but not how long they stay, nor what to say when every quote matches a claim already confirmed.

```

<!-- /omni-outbox-settled: s3-02-draft-outcome-lines-after-watching -->

<!-- omni-outbox-settled: s4-01-thats-us-also-confirms-an-addition -->

## s4-01-thats-us-also-confirms-an-addition — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-thats-us-also-confirms-an-addition
prd: 774
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 4
---

## The question, in plain words

When the weekly check finds a new region next to ones already confirmed, it waits at the top of the page. If someone presses That's us for other finds while it waits, should it be confirmed too?

## The decision, in plain words

Yes: That's us confirms every waiting find the database holds, the new region included, and the page shows it confirmed right away. Someone who disagrees can still mark it wrong in the list afterwards.

## The intro, for fun

Two buttons, one database, and a new region caught in the middle.

## The punchline, for fun

That's us means everyone, even the newcomer at the top.

## The options, in plain words

A. A. That's us confirms waiting additions too, as the database does today
B. B. That's us leaves additions alone; only their own buttons settle them (a follow-up migration)
C. C. Additions stay in the found list and are never shown on top after a member's own draft

## What I had to decide

Whether That's us should leave a waiting new value alone so it is only settled at the top of the page.

## What I did meanwhile

The top of the page shows new values beside confirmed ones as additions with their own buttons; That's us confirms them too, as the database already does, and the page says so by showing them confirmed.

## What it costs to change later

Passing the waiting additions to the database call as left alone needs a small follow-up migration of the confirm function; the page side is one filter.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says That's us confirms every proposed row not marked wrong, and that additions sit on top with their own buttons, without saying which wins when both wait at once.

```

<!-- /omni-outbox-settled: s4-01-thats-us-also-confirms-an-addition -->

<!-- omni-outbox-settled: s4-02-recheck-one-workspace-at-a-time -->

## s4-02-recheck-one-workspace-at-a-time — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-recheck-one-workspace-at-a-time
prd: 774
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 4
---

## The question, in plain words

The weekly check reads every workspace's sources again. Should it read them one workspace after another, or all at once?

## The decision, in plain words

One after another, inside the single weekly call, so the shared GitHub allowance is never spent in one burst. If many workspaces grow large, the call may run out of time before the last ones.

## The intro, for fun

Sunday night, a queue of workspaces, and only five minutes on the clock.

## The punchline, for fun

First come, first checked, and the rest wait for next Sunday.

## The options, in plain words

A. A. One workspace after another, in one call of at most five minutes
B. B. All workspaces at once in the same call, faster but harder on the GitHub allowance
C. C. One call per workspace from the weekly job, each with its own time limit

## What I had to decide

Whether one call, one workspace at a time, is enough, or the check should be split per workspace.

## What I did meanwhile

The weekly route rechecks the workspaces in turn within its five-minute limit; a workspace that fails is skipped and named in the answer, and the others carry on.

## What it costs to change later

Running them side by side is a one-line change; splitting into one call per workspace means a new small route and a loop in the weekly job.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say how many workspaces one weekly run must reach, nor how long one draft takes on a large repository.

```

<!-- /omni-outbox-settled: s4-02-recheck-one-workspace-at-a-time -->
