# Settled outbox items — PRD 812

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-typesafe-request-shape -->

## s1-01-typesafe-request-shape — adopted

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
id: s1-01-typesafe-request-shape
prd: 812
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

What exactly does TypeSafe expect in a request to Jev, and what does it send back?

## The decision, in plain words

We wrote the request and the reply the way the spec describes Jev (a state, a typed question, an answer with a confidence), without TypeSafe's own reference to check the field names against.

## The intro, for fun

Talking to a new service is like texting someone new: you hope you got the name right.

## The punchline, for fun

If the fields are off, Jev simply stays silent and today's answers keep counting.

## The options, in plain words

A. Keep the shape as built, and adjust it once a person compares it with TypeSafe's reference.
B. Have a person paste TypeSafe's reference into the spec first, and rework the client to match it before the feature merges.

## What I had to decide

The field names of the call to TypeSafe's systemone endpoint: model, state, question (type, instructions, options or levels as key and description, or a Noul's statement), and the reply's model, answer, confidence and optional probabilities.

## What I did meanwhile

At the wave check, the orchestrator rewrote the call to the shape TypeSafe publishes (a state, and questions keyed by name with type, instructions and criteria; answers keyed by the same name, with choice, score or noul), as TypeSafe's Cloudflare model page and two tutorials describe it. One guess remains: whether a Score's `score` is a 0-to-1 position or a level index. The client prefers the probabilities when Jev sends them. The shape lives in one file of Galaxy's server code and its test; a reply outside it is read as a failed call, so a wrong guess only means Jev never decides and today's answer counts.

## What it costs to change later

One file and its test to adjust once TypeSafe's reference is read; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- TypeSafe's API reference for the systemone endpoint was not available to check the field names against (author)

```

<!-- /omni-outbox-settled: s1-01-typesafe-request-shape -->

<!-- omni-outbox-settled: s1-02-jev-on-means-key-stored -->

## s1-02-jev-on-means-key-stored — adopted

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
id: s1-02-jev-on-means-key-stored
prd: 812
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Is switching Jev on a setting of its own, or does it just mean a key is saved?

## The decision, in plain words

Jev is on exactly when a key is saved: switching it off removes the key and turns every decision off, and no decision can leave Off without a key. Members see only whether it is on, not the last four characters of the key.

## The intro, for fun

One switch, one key, one less thing to keep in sync.

## The punchline, for fun

No key, no Jev: the switch cannot lie about it.

## The options, in plain words

A. Jev is on exactly when a key is stored, and a decision needs a key to leave Off.
B. Store a separate on/off flag, so the owner can pause Jev without removing the key.

## What I had to decide

Whether the page's Jev switch is its own stored flag or simply shows whether a key is stored, and whether a decision may be Shadow or On with no key.

## What I did meanwhile

No separate flag is stored: the switch reads the key's presence, and set_jev_decision refuses a mode other than Off without a key. The key's last four and its date are shown to the owner only.

## What it costs to change later

A separate on/off flag later is one column and a change to two database functions, in a new migration; nothing stored today would need moving.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec says members never see the key; showing them its last four was not asked either way (author)

```

<!-- /omni-outbox-settled: s1-02-jev-on-means-key-stored -->

<!-- omni-outbox-settled: s1-03-jev-page-in-settings-trail -->

## s1-03-jev-page-in-settings-trail — adopted

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
id: s1-03-jev-page-in-settings-trail
prd: 812
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Should the new Jev page also appear in the top bar's trail, like the other settings pages?

## The decision, in plain words

Yes: the Jev page is listed as a page of Settings, so the top bar reads Settings, then Jev. That meant updating one test outside this slice's area, the one that checks every settings page exists.

## The intro, for fun

A new room in the house deserves a sign on the door.

## The punchline, for fun

Even if it meant touching a test next door, politely.

## The options, in plain words

A. List the Jev page under Settings, and add its line to the page-exists test.
B. Show Jev only as a tab, so the top bar reads Settings alone on it and no test outside the slice changes.

## What I had to decide

Whether the Jev page is added to the Settings entry's pages (the trail and the page-exists test) or only to the Settings tabs.

## What I did meanwhile

It is added to both, and the list of expected pages in the page-exists test outside the slice's territory gained one line for the Jev page.

## What it costs to change later

One line in one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person wants Jev shown in the top bar trail was not asked (author)

```

<!-- /omni-outbox-settled: s1-03-jev-page-in-settings-trail -->
