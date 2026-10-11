# Settled outbox items — PRD 1628

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-exchange-lease -->

## s1-01-exchange-lease — adopted

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
id: s1-01-exchange-lease
prd: 1628
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When two cloud sessions use the same token at the same moment, the plan says the second one waits for the first. The database cannot hold a lock across the two calls the server makes, so how should the second one wait?

## The decision, in plain words

The first session takes a short hold on the token, at most thirty seconds. The second sees it is held, waits a quarter of a second, and asks again, up to ten seconds, then says to try again.

## The intro, for fun

Two cloud sessions reach for the same token at once, and only one may hold it.

## The punchline, for fun

The second one waits politely at the door, and gives up after ten seconds.

## The options, in plain words

A. A. A thirty-second hold taken by the first exchange; the second waits and claims again, up to ten seconds (built)
B. B. A database function that does the whole exchange in one call, with the session renewed from inside the database
C. C. No waiting: the second exchange is refused at once and the kit retries

## What I had to decide

Keep the thirty-second hold the exchange takes on the token, or ask for a different way to put two exchanges one after the other.

## What I did meanwhile

Two exchanges at once renew one after the other; one that never comes back blocks the token for thirty seconds at most.

## What it costs to change later

Changing the wait is a constant in galaxy; dropping the hold for something else is a follow-up migration that drops two columns.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Not measured against the hosted database: how long a renewal takes there (author)
- If the server crashes after Auth renewed the session but before it was written back, the stored session is lost and the token stops working; the person makes a new one (author)

```

<!-- /omni-outbox-settled: s1-01-exchange-lease -->

<!-- omni-outbox-settled: s1-02-token-workspace -->

## s1-02-token-workspace — adopted

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
id: s1-02-token-workspace
prd: 1628
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

A terminal token acts in one workspace, but a person can belong to several, and the plan does not say which one a token made from the terminal belongs to.

## The decision, in plain words

The page that starts the sign-in may name the workspace. When it names none, the token belongs to the first workspace the person joined.

## The intro, for fun

A person in three workspaces makes one token, and the token has to live somewhere.

## The punchline, for fun

Without a name on the envelope, it goes to the first address on file.

## The options, in plain words

A. A. The workspace the sign-in names, else the person's first one (built)
B. B. The workspace of the repository the terminal runs in, required
C. C. Ask the person on the sign-in page when they are in several

## What I had to decide

Keep the first workspace the person joined as the default, or say the terminal must always name one.

## What I did meanwhile

Tokens made from the terminal belong to the person's first workspace; the profile page can name its own.

## What it costs to change later

A rule in one database function and an optional field of the sign-in link; changing it touches no stored token.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The terminal's command (slice s3) may want to pass the workspace of the repository it runs in; that is its choice (author)

```

<!-- /omni-outbox-settled: s1-02-token-workspace -->

<!-- omni-outbox-settled: s1-03-who-sees-tokens -->

## s1-03-who-sees-tokens — adopted

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
id: s1-03-who-sees-tokens
prd: 1628
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

The list of a workspace's links is open to every member. Should every member also see the terminal tokens other people made, and must two terminal tokens have different names?

## The decision, in plain words

A terminal token is seen only by the person who made it and by the workspace's owners, who can revoke it. Two terminal tokens may share a name, since the terminal names them by date.

## The intro, for fun

Everyone can read the guest list, but not everyone's house keys.

## The punchline, for fun

Only you and the landlord know which keys you cut, and two can share a label.

## The options, in plain words

A. A. Maker and owners only; names may repeat (built)
B. B. Every member sees every terminal token, as for business links
C. C. Maker and owners only, and names unique per person

## What I had to decide

Keep terminal tokens visible to their maker and the owners only, or show them to every member as business links are.

## What I did meanwhile

Members see only their own terminal tokens; owners see everyone's; names may repeat.

## What it costs to change later

One condition in one database function; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A person's second token made the same day from the terminal carries the same name as the first; the last four characters tell them apart (author)

```

<!-- /omni-outbox-settled: s1-03-who-sees-tokens -->

<!-- omni-outbox-settled: s1-04-revoke-signout -->

## s1-04-revoke-signout — adopted

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
id: s1-04-revoke-signout
prd: 1628
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

The spec says revoking a terminal token also signs out the sign-in it keeps, but revoking happens in the database, which cannot reach the sign-in service. What is enough?

## The decision, in plain words

Revoking wipes the kept sign-in from the token at once, so nothing can renew it again. The sign-in itself is not told; access already handed out stops within the hour, as the spec allows.

## The intro, for fun

The key is thrown away, but the lock was never told.

## The punchline, for fun

Nobody can open the door again, and the last guest leaves within the hour.

## The options, in plain words

A. A. Wipe the kept sign-in in the database; access already handed out lasts an hour at most (built)
B. B. Also end the sign-in at the sign-in service, revoking through galaxy's server

## What I had to decide

Accept that a revoked token's last access runs out within the hour, or ask for the sign-in to be ended at the sign-in service as well.

## What I did meanwhile

A revoked token stops at its next renewal, an hour at most; the forgotten sign-in expires on its own on the sign-in service.

## What it costs to change later

Ending it at the sign-in service too means revoking through galaxy's server instead of the database alone: a change to the profile page's revoke and an admin call.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How long an unused sign-in lives on the hosted sign-in service before it expires was not checked (author)

```

<!-- /omni-outbox-settled: s1-04-revoke-signout -->

<!-- omni-outbox-settled: s1-05-token-key-variable -->

## s1-05-token-key-variable — adopted

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
id: s1-05-token-key-variable
prd: 1628
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Each terminal token keeps a sign-in, locked with a secret key on the server. Should that be a new key of its own, or the key that already locks the workspaces' Jev keys?

## The decision, in plain words

A new key of its own, set beside the others, so losing it only means everyone makes a new token. It is listed in the arcade's setup guide, a file outside this slice's ground.

## The intro, for fun

One more key on the server's key ring.

## The punchline, for fun

Lose this one and only the terminal tokens have to be cut again.

## The options, in plain words

A. A. A separate key for terminal tokens, listed in the setup guide (built)
B. B. Share the key that already locks the Jev keys

## What I had to decide

Keep a separate key for terminal tokens, or share the existing secrets key.

## What I did meanwhile

Without the new key set on a deployment, no terminal token can be made or used there, and the server says so.

## What it costs to change later

Switching to the shared key is one line in galaxy; every token made under the other key would have to be made again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The arcade's setup guide was changed to list the variable, though it is outside this slice's territory: its variable check fails otherwise (author)
- The key has to be set on the hosted deployment before anyone can make a token (author)

```

<!-- /omni-outbox-settled: s1-05-token-key-variable -->

<!-- omni-outbox-settled: s1-06-token-hand-back -->

## s1-06-token-hand-back — adopted

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
id: s1-06-token-hand-back
prd: 1628
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

A new token has to reach the page that asked for it, shown once, without sitting in the address bar. The spec does not say how.

## The decision, in plain words

The sign-in keeps the token for that browser for five minutes, where no script can read it, and the profile page asks for it once. The terminal gets it on its own computer, as a sign-in code is today.

## The intro, for fun

A brand-new secret has to cross the browser without leaving footprints.

## The punchline, for fun

It waits five minutes in a sealed envelope, then the envelope burns.

## The options, in plain words

A. A. Kept five minutes for that browser, read once by the profile page; the terminal gets it on its own computer (built)
B. B. Shown on a page of the sign-in itself, never sent back to the profile page

## What I had to decide

Keep the five-minute, read-once hand-back for the profile page, or choose another way to show the token once.

## What I did meanwhile

The profile page (slice s4) shows the token by asking for it once on its return; the terminal command (slice s3) reads it on its own computer.

## What it costs to change later

Contained in galaxy's sign-in and one route; the two slices that read it follow whatever is chosen.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The token travels to the terminal in the address of its own computer, which the browser may keep in its history (author)

```

<!-- /omni-outbox-settled: s1-06-token-hand-back -->

<!-- omni-outbox-settled: s2-01-refusal-details -->

## s2-01-refusal-details — adopted

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
id: s2-01-refusal-details
prd: 1628
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When the page turns a terminal token down, which details does it send back so the terminal can say why in one line: the expiry date, the person and the workspace?

## The decision, in plain words

The terminal reads the expiry date, the person's login and the workspace name from the refusal when the page sends them, and still prints a plain line without them. A token the page does not know gets its own line asking for a new token.

## The intro, for fun

A door that says no should at least say which key was wrong.

## The punchline, for fun

Ours says it in one line, and never reads the key out loud.

## The options, in plain words

A. Read the date, the login and the workspace from the refusal, the option built.
B. Read nothing beyond the reason, and print the lines without a date, a login or a workspace.
C. Have the server send the whole line ready to print, and the terminal print it as it comes.

## What I had to decide

The names of the extra fields a 401 refusal of the token exchange carries, which the server slice (s1) must answer with: expires_at for an expired token (seconds, milliseconds or a date), login and workspace (an object with a name, or a name) for an ex-member; and the line printed for the reason unknown, which the spec does not give.

## What I did meanwhile

The kit reads expires_at, login and workspace leniently, and prints 'OMNI_TOKEN is not known to <host>: make a new one with omni setup-token' for unknown; any field missing gives the line without it.

## What it costs to change later

Renaming a field is a one-line change on either side, before the feature merges.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the server slice s1 was not built when this was decided, so its field names are not yet confirmed (author)

```

<!-- /omni-outbox-settled: s2-01-refusal-details -->

<!-- omni-outbox-settled: s2-03-status-line-token -->

## s2-03-status-line-token — adopted

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
id: s2-03-status-line-token
prd: 1628
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Where on the status line does the cloud token show, since the status line never showed the sign-in before?

## The decision, in plain words

It shows at the end of the first line, after the ask-mode marker, as the word token and the token's last four characters.

## The intro, for fun

The status line had no seat for the sign-in, so we pulled up a chair.

## The punchline, for fun

At the end of the row, where latecomers sit.

## The options, in plain words

A. At the end of line 1, after the ask-mode marker, the option built.
B. Right after the model's name, at the start of line 1.
C. On line 2, beside the PRD the session is on.

## What I had to decide

The place of 'token ··<last four>' on the status line: the spec says where it shows the sign-in today, and line 1 shows only the model, the context, the usage and ask on.

## What I did meanwhile

Appended to line 1 as ' · token ··<last four>', after ask on, also on the unreadable-input line 'omni'; read from the variable alone, with no fetch.

## What it costs to change later

Moving it is a change to one function of the status line command.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the line still fits a narrow terminal once the token is added was not measured (author)

```

<!-- /omni-outbox-settled: s2-03-status-line-token -->
