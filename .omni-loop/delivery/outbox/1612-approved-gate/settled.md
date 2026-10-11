# Settled outbox items — PRD 1612

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-refused-reads-held -->

## s1-01-refused-reads-held — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-refused-reads-held
prd: 1612
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When the approval cannot be trusted for a reason other than a server outage, for example the approver has left the workspace, should the approval check on a pull request say held or failed?

## The decision, in plain words

It says held, like an outage: only a file that changed since approval turns the check red. The terminal still prints the exact reason.

## The intro, for fun

An approver walked out of the workspace and left their signature on the desk.

## The punchline, for fun

We put the signature in a drawer marked held, not in the bin.

## The options, in plain words

A. A. Held (neutral): only a drift fails, a server-side doubt never blocks a merge.
B. B. Failed: an approval whose approver left is not an approval, so the check is red until someone approves again.
C. C. Waiting (neutral), pointing at the PRD page to approve again.

## What I had to decide

Whether an approval whose approver left, or a reply the server refused, makes the check neutral (held) or failed.

## What I did meanwhile

The shared judge maps the refused state to held; the terminal command's lines and exit code are unchanged.

## What it costs to change later

One line in the verdict mapping and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names four states and lists only the server being unreachable as held; it does not say where a refused reading goes (author).

```

<!-- /omni-outbox-settled: s1-01-refused-reads-held -->

<!-- omni-outbox-settled: s2-01-judge-route-signature -->

## s2-01-judge-route-signature — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-judge-route-signature
prd: 1612
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

How does the server know that a request for a PRD's approval really comes from our GitHub App, when that request carries no body to sign?

## The decision, in plain words

The App signs the address it asks for, the page and the PRD named in it, with the same shared secret it already uses for stage updates. A signature for one PRD cannot read another, and there is no clock in it.

## The intro, for fun

A letter with no body still needs a seal on its envelope.

## The punchline, for fun

So the App signs the address and trusts the postman with the rest.

## The options, in plain words

A. A. Sign the path and query exactly as sent, with the stage-event secret, no timestamp (built).
B. B. Also sign a timestamp header and refuse requests older than a few minutes.
C. C. Give the judge route its own secret, apart from the stage-event one.

## What I had to decide

Whether the App signs only the address it asks for, or also a timestamp so an old request expires.

## What I did meanwhile

The judge route accepts any request whose signature matches the path and query exactly as sent, under the stage-event secret; the App's check (s3) must sign the same string.

## What it costs to change later

Adding a timestamp later is one header on each side and one check here, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A replayed request only re-reads the same approval record a member already sees on the PRD's page; whether that is acceptable was not asked.

```

<!-- /omni-outbox-settled: s2-01-judge-route-signature -->
