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

<!-- omni-outbox-settled: s2-01-on-mode-still-asks-haiku -->

## s2-01-on-mode-still-asks-haiku — adopted

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
id: s2-01-on-mode-still-asks-haiku
prd: 812
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When Jev is trusted with sorting questions, should the old sorter still be asked every time as well?

## The decision, in plain words

Yes: with the question category On, the old sorter still answers every round beside Jev. Its answer is kept for comparison and counts at once whenever Jev cannot decide.

## The intro, for fun

Two referees on the pitch: only one blows the whistle, the other keeps notes.

## The punchline, for fun

It costs a few cents more, and the record never has a blank line.

## The options, in plain words

A. A. On still asks the old sorter every round, so the record keeps comparing and the fallback is immediate.
B. B. On asks the old sorter only when Jev cannot decide, saving that call but leaving the record without a comparison for most rounds.

## What I had to decide

Whether a round whose category decision is On still calls the old sorter (Haiku through OpenRouter) alongside Jev, or calls it only when Jev fails or answers under the floor.

## What I did meanwhile

Shadow and On both run the old sorter and Jev side by side after the response; On keeps Jev's answer when it counts and the old one otherwise, and every call is logged with both answers.

## What it costs to change later

One branch in the resolver's decide step: run the old path after Jev instead of beside it. No stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says Shadow runs both and that the record compares like with like, but does not say whether On keeps paying for the old sorter on every round

```

<!-- /omni-outbox-settled: s2-01-on-mode-still-asks-haiku -->

<!-- omni-outbox-settled: s3-01-decide-route-home -->

## s3-01-decide-route-home — adopted

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
id: s3-01-decide-route-home
prd: 812
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

Where should the code that answers a terminal's Jev question live, and may this slice touch a few files the plan did not list for it?

## The decision, in plain words

We put the answering code beside the decisions it serves, so its tests run with everything else, and we touched four files outside the plan's list: the terminal's connection to the page, a count of commands in the help, and two page tests that expected this decision to be still coming.

## The intro, for fun

Some rooms were not on the floor plan, but the pipes had to run through them.

## The punchline, for fun

Nothing moved in those rooms except the pipes.

## The options, in plain words

A. Keep it as built: the answering code beside the decisions, and the four small outside edits.
B. Move the answering code to its own folder next to the decisions, and widen the plan's list to cover it.
C. Teach the test runner to look under the app's routes folder too, and move the test there as the plan wrote.

## What I had to decide

The plan names app/api/decide/[decision]/route.test.ts, but vitest.config.mjs only includes apps/*/src/**, so a test there never runs. The route's logic (decideRoute) and its live deps sit in apps/galaxy/src/jev/decisions/decide-route.ts and decide-live.ts, the only src path in this slice's territory; app/api/decide/[decision]/route.ts stays one line. Outside the territory: kit/lib/ask/client.mjs gains a decide() call (the client's call and token refresh are private, and a hand-rolled fetch would lose the refresh); kit/lib/help/entries.test.mjs counts 38 commands; apps/galaxy/src/jev/settings/decision.test.ts and render.test.ts use bug-risk as the coming decision now that outbox-risk is registered.

## What I did meanwhile

Built it that way; all tests green, and the Next route is a one-line wrapper like every other API route.

## What it costs to change later

A file move and an import path each: no stored shape, no contract change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant these paths to be read this loosely (author)

```

<!-- /omni-outbox-settled: s3-01-decide-route-home -->

<!-- omni-outbox-settled: s3-02-decided-by-line-place -->

## s3-02-decided-by-line-place — adopted

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
id: s3-02-decided-by-line-place
prd: 812
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

Where on an outbox item does the note saying Jev made the call go?

## The decision, in plain words

The note goes as the last line of the part that says what had to be decided, written by the agent, because the tool that writes items takes no separate field for it.

## The intro, for fun

Every good decision deserves a signature, even a robot's.

## The punchline, for fun

Jev signs at the bottom of the page, like everyone else.

## The options, in plain words

A. Keep it as built: the agent ends the decision section with the note.
B. Add a dedicated field to the item tool that writes the note on its own line at the top of the item.

## What I had to decide

The spec wants `Decided by: Jev (hardToRevert 0.82) · agent said false` on the item. `omni item new` refuses unknown fields and kit/lib/policy/outbox-policy.mjs is outside this slice. The do-work skill tells the agent to end the `decide` field (## What I had to decide) with that line when Jev's answer counted.

## What I did meanwhile

The skill's Record it step says so; nothing in the kit parses the line.

## What it costs to change later

A skill wording change, or a new optional item field later: no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a reader of the item would rather see the note at the top (author)

```

<!-- /omni-outbox-settled: s3-02-decided-by-line-place -->

<!-- omni-outbox-settled: s3-03-decide-unowned-repository -->

## s3-03-decide-unowned-repository — adopted

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
id: s3-03-decide-unowned-repository
prd: 812
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When a terminal asks Jev about a repository that no workspace has claimed, whose settings apply?

## The decision, in plain words

We follow the same rule as the question pages: the repository goes to the first workspace the person joined, so that workspace's Jev settings apply; a repository another workspace owns is refused.

## The intro, for fun

A stray repository knocks on the door, and someone has to let it in.

## The punchline, for fun

It moves in with whoever you met first.

## The options, in plain words

A. Keep it as built: the same rule as ask mode, the first workspace joined.
B. Refuse any repository whose organisation no workspace owns, so no Jev settings apply to it.

## What I had to decide

POST /api/decide asks repo_workspace() (PRD 459), which falls back to the caller's first-joined workspace when no workspace owns the repository, and refuses (403) when another workspace owns it. The route refuses only when repo_workspace() names no workspace.

## What I did meanwhile

Built on repo_workspace() as ask mode and dossiers do.

## What it costs to change later

One check in the route: refuse when the repository's org matches no workspace.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether an owner expects their Jev settings to reach repositories of organisations the app is not installed on (author)

```

<!-- /omni-outbox-settled: s3-03-decide-unowned-repository -->

<!-- omni-outbox-settled: s4-01-agreement-counts-only-answered-calls -->

## s4-01-agreement-counts-only-answered-calls — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-agreement-counts-only-answered-calls
prd: 812
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When the Jev page says how often Jev agreed with the old way of deciding, which calls should that rate be measured on?

## The decision, in plain words

Every call counts in the number of calls, but the agreement rate only looks at the calls where Jev and the old way both gave an answer. A call where Jev failed, had no key or answered outside the options neither agrees nor disagrees.

## The intro, for fun

Jev cannot agree with anyone while it is not answering the phone.

## The punchline, for fun

So its silent calls sit out the vote and only the calls it actually answered get counted.

## The options, in plain words

A. Rate over the calls both sides answered; failures only raise the call count (built).
B. Rate over every call, a failure counting as a disagreement.
C. Option A, plus a separate count of failed calls shown beside the rate.

## What I had to decide

Whether the agreement rate should be measured only on answered calls, or on every call with failures counted as disagreements.

## What I did meanwhile

The page shows the number of calls over 30 days and, separately, agreed out of compared, where compared is only the calls both sides answered. Answers under the confidence floor are compared too.

## What it costs to change later

Changing it is a one-line filter in the record module and its tests; nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only 'how often Jev agreed with today's path' and does not say what a failed call counts as (author).

```

<!-- /omni-outbox-settled: s4-01-agreement-counts-only-answered-calls -->
