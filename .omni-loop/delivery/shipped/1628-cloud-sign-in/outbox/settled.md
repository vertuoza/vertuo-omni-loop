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

<!-- omni-outbox-settled: s3-01-token-printed-lines -->

## s3-01-token-printed-lines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-token-printed-lines
prd: 1628
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When the terminal hands back a new cloud token, how should it show it: on a line of its own as well as in the line to paste, or only in the line to paste?

## The decision, in plain words

The terminal shows the token on a line of its own, then the day it expires, then the line to paste, which carries the token a second time. Nothing else ever shows it again.

## The intro, for fun

A brand new key comes out of the machine, and it has to decide how many times to wave it at you.

## The punchline, for fun

Twice in one breath, then never again, like a magician who forgets the trick right after.

## The options, in plain words

A. A. Three lines: the token alone, its expiry, then the paste line, the option built.
B. B. Two lines: the expiry, then the paste line, so the token is printed exactly once.

## What I had to decide

Keep A, or pick B to print the token only inside the paste line (two lines instead of three).

## What I did meanwhile

omni setup-token prints three lines after the browser link: the token alone, 'It expires on <yyyy-mm-dd>.' (the expiry's UTC day), and 'Paste it as OMNI_TOKEN=<token> in your cloud environment's variables.'. The test pins those lines and sweeps every printed line so the token appears in no other.

## What it costs to change later

One constant line in kit/bin/commands/setup-token.ts and its test; the guide page (s5) quotes whatever lines are printed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists the token, its expiry and the paste line as three things printed, and the paste line itself holds the token, so 'the token once' reads either as shown once in its life or as printed once in the output.

```

<!-- /omni-outbox-settled: s3-01-token-printed-lines -->

<!-- omni-outbox-settled: s4-01-made-token-asked-on-open -->

## s4-01-made-token-asked-on-open — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-made-token-asked-on-open
prd: 1628
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

How does your profile page know, after the sign-in comes back, that a new token is waiting to be shown?

## The decision, in plain words

Your own profile asks once each time it opens whether a token is waiting; almost always the answer is no and nothing shows. The address coming back carries no mark, because the sign-in only accepts a plain way back.

## The intro, for fun

The page knocks on the token's door every time it walks past.

## The punchline, for fun

Usually nobody answers, and that is fine.

## The options, in plain words

A. A. Ask once on every open of your own profile, the option built.
B. B. Let the way back carry a marker (a change to the sign-in), and ask only then.
C. C. Have the page's server read the waiting token itself, widening where its cookie is sent.

## What I had to decide

Whether your own profile asks POST /api/ask/token/made once on every open, or only when the address it comes back to carries a marker, which s1's way-back rule (/app/... with no query) does not allow today.

## What I did meanwhile

TerminalTokens.tsx asks once per page on your own profile (a ref keeps React's double effect to one call); a 404 shows nothing. Someone else's profile and the demo never ask.

## What it costs to change later

A constant: the call moves behind a marker in a few lines once the way back allows one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- one extra small request on each open of your own profile (author)

```

<!-- /omni-outbox-settled: s4-01-made-token-asked-on-open -->

<!-- omni-outbox-settled: s4-02-limit-words -->

## s4-02-limit-words — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-limit-words
prd: 1628
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

What does Make a token say when you already hold 20 live tokens?

## The decision, in plain words

The form is greyed out and says: You hold 20 tokens already: revoke one to make another. Those are the database's own words, so the page and a refused sign-in say the same thing.

## The intro, for fun

Twenty tokens in the pocket, and the pocket is full.

## The punchline, for fun

Empty one before you stuff in another.

## The options, in plain words

A. A. The database's own sentence, the option built.
B. B. A shorter line, such as Limit of 20 reached.
C. C. No line: only the disabled button.

## What I had to decide

The limit-reached words were an open question of the profile draft; the built screen uses kit_token_make()'s refusal text, 13 words at rest, past the word pass's 7.

## What I did meanwhile

TERMINAL_LINE.limit in apps/galaxy/src/profile/terminal-tokens.ts; the draft's open question now records the choice.

## What it costs to change later

A constant: one string.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the word pass's 7-word rule is broken on purpose while the limit holds (author)

```

<!-- /omni-outbox-settled: s4-02-limit-words -->

<!-- omni-outbox-settled: s5-01-guide-tests-and-guard -->

## s5-01-guide-tests-and-guard — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-guide-tests-and-guard
prd: 1628
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

Adding the Cloud sessions page meant changing the guide's own tests and its checker, which sit outside the files this part of the work was given. Is it all right that they changed alongside the page?

## The decision, in plain words

The tests now expect the new page right after Join a team, and the checker now recognises a command listed beside others from one file, so the page can name the command that shows who you are signed in as.

## The intro, for fun

One new page in the guide, and two tests that count pages had to learn to count to eighteen.

## The punchline, for fun

The checker also learned that a command can share a file with its siblings.

## The options, in plain words

A. A. Change the two guide test files and the checker's command lookup alongside the page (built).
B. B. Leave them untouched and let a separate slice add the page to the tests and widen the checker, the guide's checks staying red until then.
C. C. Keep the checker as it was and avoid naming the who-am-I and sign-out commands as code on the page, against the plan's done-when.

## What I had to decide

Keep option A unless the guide's tests and checker should have been changed in a slice of their own.

## What I did meanwhile

The page, its place in the guide and its links ship with the tests and the checker updated to match.

## What it costs to change later

Undoing it is reverting a few lines in two test files and one regular expression; no data and no published behaviour depend on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gave the slice only the guide pages, so whether its tests count as part of the page is not settled anywhere (author).

```

<!-- /omni-outbox-settled: s5-01-guide-tests-and-guard -->

<!-- omni-outbox-settled: s2-02-token-from-environment -->

## s2-02-token-from-environment — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-12T05:22:03Z
- Channel: feature pull request #1629
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1629#issuecomment-6118266367
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: ADR-0057
- Raised: 2026-10-11
- Slice: s2
- Wave: 1
- Became: ADR-0057

### The answer, as it was given

```text
A. The store reads the token from the environment when no folder is given, the option built.
```

### The item, as it was raised

```text
---
id: s2-02-token-from-environment
prd: 1628
slice: s2
rank: high
bears-on: ADR-0057
raised: 2026-10-11
wave: 1
---

## The question, in plain words

How does every terminal command learn that a cloud token is set, when most commands were never handed the environment's settings?

## The decision, in plain words

The shared sign-in store reads the token from the environment itself, through the one module allowed to, whenever a command does not hand it a test folder. Commands did not have to change one by one.

## The intro, for fun

Twenty commands, one front door, and nobody wanted to rewire twenty doorbells.

## The punchline, for fun

So the front door learned to check the doormat for a key.

## The options, in plain words

A. The store reads the token from the environment when no folder is given, the option built.
B. Every command passes the token it was handed down to the store, touching each command.
C. The program's entry point hands every command a ready-made store, so commands never build one.

## What I had to decide

Whether homeTokens (and so signedInClient and every command that falls back to it) reads OMNI_TOKEN from the process environment through kit/lib/env/read.ts when no home is given, rather than every command passing the OMNI_TOKEN group from main()'s vars down to it, which would change some fifteen command files outside this slice's territory.

## What I did meanwhile

processOmniToken() in kit/lib/env/read.ts is the default when both home and omniToken are left out; a test hands its own home (no token) or an explicit omniToken, and never writes process.env. signin, whoami, signout and the status line read vars.omniToken as main() hands it.

## What it costs to change later

Threading vars through each command later is mechanical: one argument per call site, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the default path (no home, no omniToken) is covered by reasoning, not by a test, since a test may not write process.env (author)

```

<!-- /omni-outbox-settled: s2-02-token-from-environment -->
