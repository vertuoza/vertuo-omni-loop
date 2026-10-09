# Settled outbox items — PRD 1322

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-push-and-email-packages-wait-for-their-sender -->

## s1-01-push-and-email-packages-wait-for-their-sender — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-push-and-email-packages-wait-for-their-sender
prd: 1322
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The plan asked this first step to add the two libraries that send phone alerts and emails, but nothing in this step sends anything yet, and the repository refuses a library no code uses. Should they be added now or with the step that sends?

## The decision, in plain words

They are not added here: the step that sends the alerts and emails adds them, together with the code that uses them.

## The intro, for fun

Two libraries packed for a trip they cannot take yet.

## The punchline, for fun

They ride along with the sender instead.

## The options, in plain words

A. A. Add the libraries in the step that first sends an alert, with the code that uses them (built).
B. B. Add them here anyway and exempt them from the unused-dependency check until the sending step lands.

## What I had to decide

Whether the push and email libraries come in with this step or with the step that first sends an alert.

## What I did meanwhile

The settings for both channels are read and documented; the libraries arrive with the sending step, which also owns the package list and lock file changes it needs.

## What it costs to change later

Low: adding two dependencies later is a one-line change in the package list and a lock file refresh.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the package list and lock file only to this step; the sending step (s2) needs them added to its territory when it runs (author).

```

<!-- /omni-outbox-settled: s1-01-push-and-email-packages-wait-for-their-sender -->

<!-- omni-outbox-settled: s1-02-alert-settings-listed-in-the-galaxy-readme -->

## s1-02-alert-settings-listed-in-the-galaxy-readme — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-alert-settings-listed-in-the-galaxy-readme
prd: 1322
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The four new settings for phone alerts and email must be listed in the page's setup guide, which the plan gives to a later step. Should this step add them to that list now?

## The decision, in plain words

This step adds the four settings to the setup guide's list of settings, two lines and nothing else, so the check that the guide and the code agree stays green.

## The intro, for fun

A new key on the ring, and the label maker is in the next room.

## The punchline, for fun

Two lines of label, borrowed early.

## The options, in plain words

A. A. List the four settings in the README now, the two lines only (built).
B. B. Leave the README to its later step and let the settings check fail until then.

## What I had to decide

Whether the galaxy README's list of settings gains the four alert settings in this step, outside its listed ground, or waits for the step that owns the README.

## What I did meanwhile

The README's marked settings list names VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, RESEND_API_KEY and RESEND_FROM; the later step that describes the handshake in the README keeps those two lines.

## What it costs to change later

Low: two lines in a list; the later step can reword them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s8, which owns apps/galaxy/README.md, wants these lines worded otherwise is not known (author).

```

<!-- /omni-outbox-settled: s1-02-alert-settings-listed-in-the-galaxy-readme -->

<!-- omni-outbox-settled: s4-01-approval-stream-contract -->

## s4-01-approval-stream-contract — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-approval-stream-contract
prd: 1322
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The spec names the two new server calls the waiting command makes, but not exactly what they answer. What do the command and the server agree each answer holds?

## The decision, in plain words

The command expects the people asked by name, whether only the author was left, the author and the product, then four kinds of news with a rising number each: asked, approved, voided and asked again. The server work is built to match.

## The intro, for fun

Two teams build both ends of one phone line at the same time.

## The punchline, for fun

So somebody wrote down what hello sounds like before anyone dialled.

## The options, in plain words

A. A. Keep the shapes as recorded here, with the approved event carrying who, when and how many files.
B. B. Have the approved event carry only its number, and let the kit read the approval again and compare the files before it says approved.
C. C. Have the request answer also the approval already in force, so the kit makes one call instead of two before it waits.

## What I had to decide

Contract the kit relies on (kit/lib/approval/stream.ts, kit/lib/approval/wait.ts), for s2 and s3 to match. POST /api/dossiers/approval/request, body {repo: 'owner/name', prd: number}, answers 200 {asked: [{login: string, name?: string|null}], nobodyElse: boolean, author: string, product: string|null}; nobodyElse true means only the author is asked (asked may then be empty or hold the author). 401 after one token refresh means signed out (exit 1); any other 4xx is 'refused (<status>)', exit 1; 5xx or unreachable is retried as a failed try. GET /api/dossiers/approval/stream?repo=&prd= with Accept: text/event-stream and Last-Event-ID when resuming answers 200 text/event-stream; events: 'asked' and 're-asked' with data equal to the request's reply shape; 'approved' with data {approver: login, approvedAt: ISO time, pinned: number of files}; 'voided' with data {pusher: login, kind: string, from: full sha256, to: full sha256} (the kit prints the first 7 characters); 'ping' and 'reconnect' with no data and no id. Every other event carries an increasing id; the kit drops an id it has seen. 'reconnect' makes the kit reconnect at once; a stream that closes before any message counts as a failed try. An approval already in force is read through the existing GET /api/dossiers/approval before any request. Small choices taken with it: a repository with no product says 'this repository has no other approver'; the approved time prints as the ISO string the server sends, as omni approval does.

## What I did meanwhile

s2 and s3 build their replies to these shapes; the kit's tests stub exactly these shapes.

## What it costs to change later

A renamed field is a one-line change in the kit's schema and in the server's service; nothing is stored in this shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec does not say whether an approved event should be checked against the files in the checkout; the kit trusts the event and leaves that check to omni approval at the gates

```

<!-- /omni-outbox-settled: s4-01-approval-stream-contract -->

<!-- omni-outbox-settled: s4-02-waiting-file -->

## s4-02-waiting-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-waiting-file
prd: 1322
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The spec says the waiting command keeps a small file the on-screen band reads, but not where or what it holds. Where does it live, and what is in it?

## The decision, in plain words

One file per PRD in the checkout's private folder, holding the current state, its line, the waiting line and when it was written. The command leaves its last state there when it ends, so the band can show it for ten seconds.

## The intro, for fun

The band wants to know what the terminal is waiting for.

## The punchline, for fun

Sticky notes on the fridge, one per PRD, never thrown away mid-sentence.

## The options, in plain words

A. A. One file per PRD under the private folder, left with its last state.
B. B. One single file for the checkout, the last wait to write winning.
C. C. One file per PRD, deleted when the wait ends, the band keeping the last line itself.

## What I had to decide

File: .omni-loop/local/approval-wait/<n>.json (the folder carries the existing .gitignore of .omni-loop/local). Content: {prd: number, state: 'waiting'|'approved'|'voided'|'held'|'signed-out'|'timeout'|'refused', line: the line just printed, waiting: the current waiting line or null before anyone is asked, at: ISO time it was written}. Written on every line printed after the request; left in place with the last state when the command exits. Not written when the command stops before asking (no ask.url, no sign-in, PRD not found). s5 reads it: show 'waiting' while state is waiting or held, and highlight 'approved' or 'voided' for 10 seconds from 'at', then fall back to 'waiting' after a void.

## What I did meanwhile

s5 builds the band against this file and shape.

## What it costs to change later

Moving or reshaping the file is a constant in the kit's wait module and in the band; it is never committed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec does not say whether two terminals may wait on two PRDs at once; one file per PRD lets them

```

<!-- /omni-outbox-settled: s4-02-waiting-file -->
