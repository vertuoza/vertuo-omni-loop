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
