# Settled outbox items — PRD 1660

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-device-requests-server-only -->

## s1-01-device-requests-server-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-device-requests-server-only
prd: 1660
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Who may touch the waiting sign-in requests in the database: only the Omni page's own server, or also a signed-in person directly?

## The decision, in plain words

Only the Omni page's server touches them, with its own clock. Without its private database key the device sign-in is simply off, and the page answers that it is not available.

## The intro, for fun

A sign-in request waits ten minutes in a locked drawer.

## The punchline, for fun

Only one key opens the drawer, and it never leaves the server.

## The options, in plain words

A. A. Server only: every function runs for the service role, with the server's clock; no key, no device sign-in (503).
B. B. The approval step also runs as the signed-in person, so a deployment without the service role key still approves requests.
C. C. As A, and the kit treats 503 like 404: it falls back to the loopback on a page without the key.

## What I had to decide

Keep the requests reachable through the server alone (A), or open the approval step to a signed-in person's own database access (B).

## What I did meanwhile

Built as A: the table is closed to every role, the service role included, and seven functions granted to the service role only are the one way in. Galaxy passes its own clock to each call, so expiry and slow_down are its rules, proven on a fake.

## What it costs to change later

B is a new migration that grants the approve and find functions to authenticated and binds them to auth.uid(): a constant-sized change, no data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The table has two columns the spec does not list: payload_expires_at (a kit token's own expiry, for s3, whose territory has no migration) and poll_interval (the spec's interval, renamed: interval is a SQL type name). (author)
- Without SUPABASE_SERVICE_ROLE_KEY both routes answer 503; the spec's kit falls back to the loopback on 404 only, so s4 should treat 503 the same way or a deployment without the key strands a cloud session. (author)

```

<!-- /omni-outbox-settled: s1-01-device-requests-server-only -->

<!-- omni-outbox-settled: s1-02-poll-answer-codes -->

## s1-02-poll-answer-codes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-poll-answer-codes
prd: 1660
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

When the terminal asks whether the sign-in was approved, should every answer come back as a plain success, or should waiting, too fast, expired and refused each carry their own web status?

## The decision, in plain words

Each carries its own web status, and the answer's words say the same thing. The terminal reads the words, so either way it works; the statuses only help whoever reads the server's logs.

## The intro, for fun

The terminal keeps asking: are we there yet?

## The punchline, for fun

The page now answers in two languages at once, just in case.

## The options, in plain words

A. A. A web status per answer, the body's status field the same: 200, 429, 410, 403.
B. B. 200 for every answer the terminal expects; only malformed bodies and failures carry an error status.

## What I had to decide

Keep a status per answer (A), or answer 200 for every outcome the terminal expects (B).

## What I did meanwhile

Built as A: pending and approved answer 200, slow_down 429, expired 410, denied 403; the body's status field is the contract the kit reads (src/ask/device.contract.ts).

## What it costs to change later

B is a one-line table change in the controller and its test, before s4's kit reads it; after, a kit that branches on the HTTP status would have to change too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names 404, 410 and 429 in its test seams without saying which answer each is; 404 is read here as the route missing on an older page (the kit's fallback), never an answer of these routes. (author)

```

<!-- /omni-outbox-settled: s1-02-poll-answer-codes -->

<!-- omni-outbox-settled: s2-01-no-button-plain-form -->

## s2-01-no-button-plain-form — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-no-button-plain-form
prd: 1660
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When someone presses No on the code check page, how should the page tell the server, and should it refuse a press that comes from another website?

## The decision, in plain words

No sends a plain form to the page's own address, which works without any script, and accepts it from anywhere: a press only refuses a sign-in nobody approved yet, and needs a code that lives ten minutes.

## The intro, for fun

Somebody pressed No, and the server has to believe them.

## The punchline, for fun

A stranger who guesses the code can only cancel a sign-in nobody wanted yet.

## The options, in plain words

A. A plain form to the page's own address, accepted from any origin
B. The same form, refused when the browser says it came from another site

## What I had to decide

Keep No as a plain form open to any origin (A), or add a same-site check to it (B).

## What I did meanwhile

Built as A: the page's No button posts the code to /ask/device/deny, which marks the pending request denied and sends the browser to Nothing was signed in (src/ask/device-card.controller.ts).

## What it costs to change later

B is a header check in denyDevice and one test, at any time, with nothing stored to migrate.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says No marks the request denied without saying how the page reaches the server. (author)

```

<!-- /omni-outbox-settled: s2-01-no-button-plain-form -->

<!-- omni-outbox-settled: s2-02-code-panel-inline-style -->

## s2-02-code-panel-inline-style — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-code-panel-inline-style
prd: 1660
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The code check page draws the code large on a darker panel and has a box to type a code, but the shared stylesheet of these pages is not part of this piece of work. Where should those two looks live?

## The decision, in plain words

They are written on the page's own card, from the same colour and type tokens the stylesheet uses, so the page follows the three themes; moving them into the shared stylesheet later changes nothing a person sees.

## The intro, for fun

Two new looks arrived, and the wardrobe was locked.

## The punchline, for fun

They dressed from the same rail, just in the hallway.

## The options, in plain words

A. Inline styles on the card, from the shared tokens
B. Two named classes in the shared stylesheet

## What I had to decide

Keep the code panel and the code box styled on the card (A), or move them into the shared stylesheet as named classes (B).

## What I did meanwhile

Built as A: CODE_PANEL and CODE_BOX in src/ask/device-card.tsx, using --ask-mono, --ask-sunk, --ask-surface, --ask-ink and --ask-line-strong only.

## What it costs to change later

B is two classes in src/ask/ask.css and two className swaps, at any time.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- src/ask/ask.css is outside this slice's territory, so no class could be added there. (author)

```

<!-- /omni-outbox-settled: s2-02-code-panel-inline-style -->

<!-- omni-outbox-settled: s3-01-unhanded-token-left-unusable -->

## s3-01-unhanded-token-left-unusable — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-unhanded-token-left-unusable
prd: 1660
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

When a terminal token is made from the code check page but the terminal's request stopped waiting in the meantime, what happens to that token nobody will receive?

## The decision, in plain words

Its sign-in is ended at once, so the token can never be used, but it stays listed on the person's profile until it expires or they revoke it.

## The intro, for fun

A token was made, and its terminal had already left the room.

## The punchline, for fun

It keeps its name tag, but no door opens for it.

## The options, in plain words

A. A. Keep it listed but unusable: its sign-in ended, it expires on its own
B. B. Delete it at once through a new server-only database function

## What I had to decide

Keep the unhanded token listed but unusable (A), or remove it at once (B).

## What I did meanwhile

Built as A: when attaching the token to the request fails or finds it no longer waiting, the fresh sign-in sealed in the token's row is ended, so any exchange of that token answers revoked.

## What it costs to change later

B is one new database function that deletes a kit token by its hash for the service role, and one call in the callback: no data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a request no longer pending attaches nothing, but not what becomes of a token made just before that was found; the kit tokens have no revoke function the server can call today.
- (author) It only happens when the request expires, is refused or is approved elsewhere during the few seconds of the sign-in, or when the database fails then.

```

<!-- /omni-outbox-settled: s3-01-unhanded-token-left-unusable -->

<!-- omni-outbox-settled: s4-01-poll-failure-ends-at-once -->

## s4-01-poll-failure-ends-at-once — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-poll-failure-ends-at-once
prd: 1660
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

While the terminal waits for the person to approve the sign-in, what should it do when one of its checks with the Omni page fails to get through?

## The decision, in plain words

It stops at once and says the page is unreachable, so the person runs the sign-in again, rather than quietly trying again for a while.

## The intro, for fun

The terminal knocked on the door, and nobody heard it once.

## The punchline, for fun

It went home instead of knocking again.

## The options, in plain words

A. A. End at once on the first failed check
B. B. Keep waiting through up to three failed checks in a row, then end

## What I had to decide

Keep the sign-in ending on the first check that fails (A), or let it ride over a few failed checks in a row before giving up (B).

## What I did meanwhile

Built as A: kit/lib/ask/device.ts ends its wait with the reason unreachable as soon as one poll cannot reach the page or gets an answer it cannot read, and omni signin prints omni signin: unreachable, exit 1.

## What it costs to change later

B is a counter of failed polls in the device module and one test, at any time: nothing is stored, and the page does not change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists unreachable among the endings without saying whether a single failed poll during the ten minutes is enough to end the wait.

```

<!-- /omni-outbox-settled: s4-01-poll-failure-ends-at-once -->

<!-- omni-outbox-settled: s4-02-device-link-from-ask-url -->

## s4-02-device-link-from-ask-url — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-device-link-from-ask-url
prd: 1660
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The terminal prints the link to approve the sign-in. Should it print the address the Omni page sends back, or build it from the address the repository's settings give for the Omni page?

## The decision, in plain words

It builds the link from the repository's own setting, the address the terminal already trusts and talks to, and only takes the short code from the page's answer.

## The intro, for fun

Two addresses for the same door walked into a terminal.

## The punchline, for fun

It picked the one written in its own notebook.

## The options, in plain words

A. A. Build the link from the configured address
B. B. Print the address the page sends back

## What I had to decide

Keep the link built from the configured address (A), or print the address the page answers with (B).

## What I did meanwhile

Built as A: deviceLink in kit/lib/ask/device.ts makes the ask device page under ask.url with the user code, and the page's url field is not read.

## What it costs to change later

B is one line in the device module and its test, at any time.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec prints the link under ask.url while the page's answer also carries its own url, built from the server's own origin, which may differ behind a proxy.

```

<!-- /omni-outbox-settled: s4-02-device-link-from-ask-url -->

<!-- omni-outbox-settled: s5-01-race-waits-on-the-survivor -->

## s5-01-race-waits-on-the-survivor — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-race-waits-on-the-survivor
prd: 1660
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

On a laptop the terminal waits for the browser and for the printed link at once. When one of the two fails, for example the link is refused or the page cannot be reached, should the terminal give up or keep waiting on the other?

## The decision, in plain words

It keeps waiting on the other and gives up only once both have failed, then says why the last one failed. A refused link or a dropped connection never cuts short a sign-in the browser is about to finish.

## The intro, for fun

Two doors were left open for the same guest, and one of them slammed shut.

## The punchline, for fun

The terminal kept an eye on the other door.

## The options, in plain words

A. A failure drops out and the other keeps waiting; the last failure is the one printed
B. The first way back to end, success or failure, ends the sign-in

## What I had to decide

Keep a failed way back dropping out while the other keeps waiting (A), or end the sign-in on the first way back to end, success or failure (B). Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

Built as A: firstOf in kit/lib/ask/race.ts takes the first result to come back and closes the other; a failure drops out, and once both failed it fails with the last failure, which omni signin prints as its one line.

## What it costs to change later

B is a few lines in the race and two tests, at any time: nothing is stored and the page does not change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the sign-in finishes on whichever comes back first, without saying what a failure of one does to the other.
- (author) With A, pressing No on the fallback link leaves the terminal waiting for the browser until the loopback's own five minutes run out, and a loopback that times out leaves it waiting for the link's ten.

```

<!-- /omni-outbox-settled: s5-01-race-waits-on-the-survivor -->
