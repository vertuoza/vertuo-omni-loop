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

<!-- omni-outbox-settled: s3-01-report-repo-must-be-the-workspaces -->

## s3-01-report-repo-must-be-the-workspaces — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-report-repo-must-be-the-workspaces
prd: 855
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

When an agent sends a question and names a code project that does not belong to the team, should the question still be kept?

## The decision, in plain words

The question is refused with one line, the same way reading the business is refused for a project that is not the team's.

## The intro, for fun

An agent walks in from the wrong building and asks the front desk a question.

## The punchline, for fun

The desk points at the sign on the door and says this is not that building.

## The options, in plain words

A. Refuse it, as the read does (built).
B. Keep it, and show the project's name as the agent sent it.

## What I had to decide

Whether a question naming a project outside the workspace is refused, or kept with that project's name on it.

## What I did meanwhile

Such a question is refused; the agent gets the same one-line reason it gets when it reads the business for that project.

## What it costs to change later

One condition in the report function: dropping it keeps such questions, with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says what a report stores, not which repositories it may name (author)

```

<!-- /omni-outbox-settled: s3-01-report-repo-must-be-the-workspaces -->

<!-- omni-outbox-settled: s4-02-jev-judges-first-report-bring-back-final -->

## s4-02-jev-judges-first-report-bring-back-final — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-01
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-jev-judges-first-report-bring-back-final
prd: 855
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

When should Jev judge an agent's question, and may it set aside again a question a person brought back?

## The decision, in plain words

Jev judges a question only the first time it arrives, not each time it is asked again. Once a person brings a question back, Jev never sets it aside again.

## The intro, for fun

Jev said the question was junk, and a person disagreed.

## The punchline, for fun

The person wins, and Jev does not get a second go.

## The options, in plain words

A. Jev judges a question once, on its first report, and a question a person brought back stays open (built).
B. Jev judges every report again, and may set aside again a question a person brought back.

## What I had to decide

The spec says Jev runs after a report and that Bring back reopens a set-aside question, but not whether a repeated question is judged again, nor whether Jev may set aside a question a person brought back. A repeat only bumps 'asked N times' on the same row, so judging it again would cost a Jev call for the same words; and setting aside again what a person brought back would undo the person's choice.

## What I did meanwhile

Built option A: the MCP link hands a report to Jev only when it stored a new row (asked once). agent_question_set_aside() changes only an open question with no brought_back_at, a column Bring back sets. A repeat of a set-aside question stays set aside and still adds to its count.

## What it costs to change later

Option B is a one-line change in the web app and dropping one condition in a database function; the brought_back_at column would simply go unused.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a set-aside question asked many more times should come back on its own (author).

```

<!-- /omni-outbox-settled: s4-02-jev-judges-first-report-bring-back-final -->

<!-- omni-outbox-settled: s4-01-jev-after-report-uses-full-access-key -->

## s4-01-jev-after-report-uses-full-access-key — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-10-01T09:28:57Z
- Channel: feature pull request #856
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/856#issuecomment-5928641311
- Basis: contradiction-marker — the answer says "not", which reads as a change to the recorded choice
- Closed: no — the build and the decision disagree until a rework sub-PR brings them back in line (/omni:yolo-fix)
- Rank: high
- Bears on: ADR-0051
- Raised: 2026-10-01
- Slice: s4
- Stays here: Jev running only when the workspace has its Jev key restates PRD 812's rule for every Jev decision; nothing new to record beyond this PRD.
- Wave: 4

### The answer, as it was given

```text
It should use the Jev key we set up (Settings › Jev). Yes, we have a Jev key; if that is not set up, the Jev step is not run.
```

### The item, as it was raised

```text
---
id: s4-01-jev-after-report-uses-full-access-key
prd: 855
slice: s4
rank: high
bears-on: ADR-0051
raised: 2026-10-01
wave: 4
---

## The question, in plain words

Jev judges a new question from an agent after the agent got its answer. Which key may the web app use to read that question and to set it aside?

## The decision, in plain words

The web app uses its full-access database key for this, the same way every other Jev decision already reads its settings and its key. Checking the agent's link still never uses it.

## The intro, for fun

Jev needs a key to tidy the questions pile.

## The punchline, for fun

It borrowed the one every Jev decision already carries.

## The options, in plain words

A. The full-access key reads the question and sets it aside, as for every Jev decision (built).
B. The agent's link carries Jev's verdict through a database function that checks the link, and the full-access key reads only Jev's settings and key.

## What I had to decide

The spec says the link is checked by the database and that the web app gains no power for it. Jev's settings and its key can only be read with the full-access key (PRD 812), and Jev runs after the agent's call, so the link alone cannot carry the verdict. Reading the question and setting it aside therefore run with that key, through two database functions only it may call (agent_question_for_jev, agent_question_set_aside).

## What I did meanwhile

Built option A: apps/galaxy/src/agent-connect/mcp/live.ts hands a first report to Jev through Next's after(), with jevDecideDeps() and serviceDb(); without SUPABASE_SERVICE_ROLE_KEY Jev never runs and every question waits for a person. The token check is untouched.

## What it costs to change later

A constant-sized change: option B is one more link-checked database function and about twenty lines in the web app; no stored data changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether ADR-0051's list of service-role uses should name Jev's decisions, which PRD 812 already added (author).

```

<!-- /omni-outbox-settled: s4-01-jev-after-report-uses-full-access-key -->
