# Settled outbox items — PRD 855

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-token-repo-scope -->

## s1-01-token-repo-scope — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-token-repo-scope
prd: 855
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

Which repositories may an agent's link ask about: only the ones the workspace lists, or also any repository its GitHub organisation owns?

## The decision, in plain words

A link reads a repository the workspace lists, or any repository its GitHub organisation owns, which is exactly what a member's own read already allows; any other repository is refused.

## The intro, for fun

A link walks up to a repository it has never met and asks to come in.

## The punchline, for fun

It may, if the family name on the door matches the workspace's.

## The options, in plain words

A. A. Listed repositories, or any repository the workspace's GitHub organisation owns (as a member's read).
B. B. Only the repositories the workspace lists.
C. C. Only the repositories the workspace tracks.

## What I had to decide

Whether a link may read a repository the workspace does not list but its GitHub organisation owns.

## What I did meanwhile

Such a repository reads the business's own claims (the region), as a member's read does, and never another workspace's.

## What it costs to change later

One condition in the database function that reads through a link.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a team expects an unlisted repository of its organisation to be readable through a link has not been asked (author).

```

<!-- /omni-outbox-settled: s1-01-token-repo-scope -->

<!-- omni-outbox-settled: s1-02-left-maker-links-listed -->

## s1-02-left-maker-links-listed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-left-maker-links-listed
prd: 855
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

When someone leaves the workspace, should the links they made still show in the list, even though they stopped working?

## The decision, in plain words

They stay in the list, marked as not working because their maker left, so an owner can revoke them for good; they read nothing in the meantime.

## The intro, for fun

A colleague leaves, but their editor links are still hanging on the coat rack.

## The punchline, for fun

They open no door any more, yet the owner can still clear them away.

## The options, in plain words

A. A. List them, marked not working, so an owner can revoke them.
B. B. Hide them: the list shows only links that work.

## What I had to decide

Whether the list shows the links of a person who left the workspace, marked not working, or hides them.

## What I did meanwhile

Such a link is listed with a not-working line and Revoke for owners; every call through it is refused.

## What it costs to change later

One condition in the list's database function and one line on the card.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a returning member's old links should start working again is not settled by the spec (author).

```

<!-- /omni-outbox-settled: s1-02-left-maker-links-listed -->

<!-- omni-outbox-settled: s2-01-link-refused-as-tool-answer -->

## s2-01-link-refused-as-tool-answer — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-link-refused-as-tool-answer
prd: 855
slice: s2
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

When an editor connects with a missing, wrong or revoked link, should the connection itself fail, or should it connect and answer every question with the one line saying to make a new link?

## The decision, in plain words

The editor connects and lists the tools, and each question it asks answers the one line saying to make a new link on Settings › Business, so the agent can tell its person what to do.

## The intro, for fun

A visitor with an old key still gets to the front desk.

## The punchline, for fun

The desk just tells them, politely, where to get a new one.

## The options, in plain words

A. Connect, list the tools, and answer each call with the one line as a tool error (built).
B. Refuse the connection with HTTP 401 and the one line, so the editor shows the server as failing.
C. Refuse a missing or malformed link with 401 at once, and an unknown or revoked one at the first call.

## What I had to decide

Whether a link that does not work fails the connection, or answers each question with the one line.

## What I did meanwhile

Every tool call with a bad link answers the one line as an error the agent reads; the database is never asked for a missing or malformed link.

## What it costs to change later

A constant: answering HTTP 401 instead is a few lines in the route and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Not tried against a real Cursor or Claude Code session: how each editor shows a 401 without OAuth was not checked.

```

<!-- /omni-outbox-settled: s2-01-link-refused-as-tool-answer -->
