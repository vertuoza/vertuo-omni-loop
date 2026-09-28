# Settled outbox items — PRD 359

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-old-hook-check-red-until-s2 -->

## s1-01-old-hook-check-red-until-s2 — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-old-hook-check-red-until-s2
prd: 359
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The older database check still expects the old rule that let people in by their company email, so it fails once GitHub becomes the only way in. Should this slice fix that older check, or leave it to the slice that removes the old rule?

## The decision, in plain words

This slice leaves the older check alone, since it belongs to the next slice's ground. Until that slice merges, the older check fails on the feature branch; the new sign-up check passes and runs first.

## The intro, for fun

The old doorman still checks email badges, but the door now only opens for GitHub.

## The punchline, for fun

He keeps shouting until the next slice hands him a new list.

## The options, in plain words

A. A: leave access.sql to s2; the supabase check is red on the feature branch until s2 merges (built)
B. B: widen s1's territory to delete access.sql's hook section now
C. C: reorder so s2's access.sql change lands with s1

## What I had to decide

Whether the older access check may stay red on the feature branch between this slice and s2.

## What I did meanwhile

supabase/checks/access.sql's hook section (the domain cases) fails against the new hook; s2, which owns access.sql, rewrites it. The signup.sql step was placed before the access step in the workflow so its proof shows.

## What it costs to change later

A constant: s2 deletes the old hook section of access.sql, or this slice could delete it in a one-line follow-up.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan did not say which slice updates access.sql's hook section; s2 owns the file (author)

```

<!-- /omni-outbox-settled: s1-01-old-hook-check-red-until-s2 -->

<!-- omni-outbox-settled: s1-02-reinstall-keeps-first-installation -->

## s1-02-reinstall-keeps-first-installation — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-reinstall-keeps-first-installation
prd: 359
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

If an org removes Omni Loop and installs it again, GitHub gives the new install a new number. Should the workspace switch to the new number, or keep the first one it recorded?

## The decision, in plain words

The workspace keeps the first installation it recorded; a later one on the same account is ignored, and the person still joins the workspace. Handling removed installs is out of this PRD.

## The intro, for fun

An org uninstalls and reinstalls, and GitHub hands out a fresh ticket.

## The punchline, for fun

The workspace keeps clutching the old one, sentimental to a fault.

## The options, in plain words

A. A: keep the first recorded installation, ignore a later one (built)
B. B: replace the recorded installation with the newest one
C. C: refuse the second installation with an error

## What I had to decide

Whether create_workspace_from_installation should replace a workspace's recorded installation when a different one arrives for the same account.

## What I did meanwhile

It records an installation only when the workspace has none (spec decision 6), so after an uninstall and reinstall the recorded id is stale until someone updates it by hand.

## What it costs to change later

A constant: one condition in the function, no data migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec leaves installation.deleted out of scope and does not say what a reinstall does (author)

```

<!-- /omni-outbox-settled: s1-02-reinstall-keeps-first-installation -->

<!-- omni-outbox-settled: s1-03-slug-collision-numbered -->

## s1-03-slug-collision-numbered — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-slug-collision-numbered
prd: 359
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

A new workspace takes its short web name from the GitHub account's name. When that name is already taken by another workspace, or is too short or too long to be one, what should it get instead?

## The decision, in plain words

It gets the name with a number added, like acme-2, trimmed to fit. The workspace's shown name stays the GitHub account's name either way.

## The intro, for fun

Two companies named Acme walk into a sign-up page.

## The punchline, for fun

The second one leaves as acme-2 and pretends it chose that.

## The options, in plain words

A. A: add -2, -3 and so on to the lowercased login (built)
B. B: refuse the install and show an error screen
C. C: add a short random suffix

## What I had to decide

How create_workspace_from_installation picks a slug when the lowercased login is taken or invalid, and what it answers.

## What I did meanwhile

Slug candidates are the lowercased login, then login-2, login-3 and so on, cut to 32 characters; a one-letter login becomes x-2. The function answers workspace_id, slug, role and created, for s4 to redirect with.

## What it costs to change later

A constant: the slug rule lives in one loop; existing slugs never change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the collision case as a test seam but not its rule (author)

```

<!-- /omni-outbox-settled: s1-03-slug-collision-numbered -->

<!-- omni-outbox-settled: s2-01-tests-beyond-territory-followed -->

## s2-01-tests-beyond-territory-followed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-tests-beyond-territory-followed
prd: 359
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Removing joining by email and Google sign-in broke two older checks and left one screen telling people to use Google, all in files another slice or no slice owns. Should this slice fix them, or leave them failing for their owner?

## The decision, in plain words

This slice changed them just enough to match: one arcade check now expects a person who has not signed in since to be outside, one knowledge check expects the GitHub button, and the knowledge page's notice now asks for a GitHub account.

## The intro, for fun

Pull one thread out of the sign-in sweater and three buttons elsewhere pop off.

## The punchline, for fun

This slice sewed them back on, and left a note for the tailor.

## The options, in plain words

A. A: edit the three files just enough to follow (built)
B. B: leave them for their owners, with the tests red on the feature branch until s3 merges
C. C: widen s2's territory in the plan to name them

## What I had to decide

Whether to edit files outside s2's territory that its change breaks or leaves wrong.

## What I did meanwhile

Edited outside the territory: apps/galaxy/src/arcade/onboarding.test.ts (s3's ground; BEA moved from the crew list to the outsider list, since the page no longer joins), apps/galaxy/src/knowledge/render.test.ts (expects 'Sign in with GitHub') and apps/galaxy/src/knowledge/KnowledgeScreen.tsx (the crew-only notice asks for the GitHub account of the workspace's org, not a Google one).

## What it costs to change later

A constant: three small edits, each revertible alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists KnowledgeSignIn in s2's territory but not the knowledge screen and test that name its button, nor s3's onboarding test that relied on joining by email

```

<!-- /omni-outbox-settled: s2-01-tests-beyond-territory-followed -->

<!-- omni-outbox-settled: s2-02-joining-needs-service-key-at-runtime -->

## s2-02-joining-needs-service-key-at-runtime — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-joining-needs-service-key-at-runtime
prd: 359
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Joining someone to their org's workspace at sign-in must run with the database's most powerful key, so the website now needs that key where it runs. Is it fine for the website's server to hold it, and who puts it there?

## The decision, in plain words

The website's server reads that key only when someone signs in, never in the browser. Where the key is missing, sign-in still works but nobody joins a workspace, and the failure is written to the log.

## The intro, for fun

The bouncer can now add names to the guest list, but only with the manager's master key.

## The punchline, for fun

No key on the hook, and the bouncer just shrugs and lets people in to an empty room.

## The options, in plain words

A. A: galaxy's server holds the service role key, read in one server-only module (built)
B. B: a dedicated Postgres role with only the two sign-up functions, and its own key
C. C: move joining into a Supabase edge function that holds the key instead

## What I had to decide

Where galaxy's server gets the right to run join_workspaces_by_github(), which only the service role may run.

## What I did meanwhile

apps/galaxy/src/data/sign-in-live.ts builds a service-role client from NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only module) for that one call. Without the key, joining throws, is logged, and the sign-in carries on (ADR 0044). The key must be set on galaxy's Vercel project; .env.example and the README, which describe it, are s4's ground.

## What it costs to change later

A constant: the variable name, or a narrower Postgres role later, in one module.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the functions are service role only but not which key galaxy's runtime holds; s4 owns .env.example and the README that would document it

```

<!-- /omni-outbox-settled: s2-02-joining-needs-service-key-at-runtime -->

<!-- omni-outbox-settled: s2-03-some-ask-callbacks-do-not-join -->

## s2-03-some-ask-callbacks-do-not-join — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-some-ask-callbacks-do-not-join
prd: 359
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

A few ask pages (a shared question, For me, the history, one ask session) have their own way back after signing in, and those do not join the person to their org's workspace. Should they?

## The decision, in plain words

They stay as they were: they sign the person in but join nothing. Signing in anywhere else, the game, the knowledge map, a PRD page, the ask home page or the terminal, joins them.

## The intro, for fun

Most doors of the house now hand out a room key on the way in.

## The punchline, for fun

Four side doors still just say hello and point at the front desk.

## The options, in plain words

A. A: leave the four callbacks as they were (built)
B. B: make them join and link too, in a rework slice
C. C: send every ask sign-in back through the ask home page's own way back

## What I had to decide

Whether the four ask callbacks outside s2's territory join by GitHub org at sign-in.

## What I did meanwhile

apps/galaxy/app/ask/[session]/callback, ask/q/[round]/callback, ask/for-me/callback and ask/history/callback only exchange the code, as before PRD 359 (they never joined by domain either). The page no longer joins on its own, since joining needs the GitHub token that only the callback holds.

## What it costs to change later

A constant: wrap each callback's exchange in settlingExchange(), one line per route.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names app/ask/callback in s2's territory but not the four other ask callbacks

```

<!-- /omni-outbox-settled: s2-03-some-ask-callbacks-do-not-join -->

<!-- omni-outbox-settled: s2-04-ask-mode-still-gated-by-email -->

## s2-04-ask-mode-still-gated-by-email — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-04-ask-mode-still-gated-by-email
prd: 359
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Ask mode and the terminal sign-in still let in only people whose account email is at the company's own domain, so now that everyone signs in with GitHub, a crew member whose GitHub email is personal or hidden is turned away. Should ask mode admit anyone who belongs to a workspace instead?

## The decision, in plain words

This slice left that rule as it is, because the files that hold it belong to no slice of this plan. Until someone changes it, a crew member whose GitHub email is not a company address cannot use ask mode.

## The intro, for fun

The front door now opens with a GitHub key, but the ask room still checks for a company badge.

## The punchline, for fun

Anyone who left their badge at home gets a polite no from the terminal.

## The options, in plain words

A. A: leave the email rule; a follow-up changes it (built)
B. B: admit anyone who belongs to a workspace, in a rework slice of this PRD
C. C: drop the rule and rely on the database's own membership checks

## What I had to decide

Whether ask mode's email rule, which sits outside this slice's ground, changes with GitHub sign-in.

## What I did meanwhile

apps/galaxy/src/ask/auth.ts and apps/galaxy/src/ask/cli-code.ts still refuse an account whose email does not end in @vertuoza.com (isCrewEmail), with the message 'Ask mode is for @vertuoza.com accounts only.'. Neither file is in s2's territory, nor in any slice's of this plan.

## What it costs to change later

A constant: replace isCrewEmail with a workspace membership check in two call sites and their tests; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan does not name apps/galaxy/src/ask/auth.ts or apps/galaxy/src/ask/cli-code.ts in any slice's territory, and the spec does not mention ask mode's email rule

```

<!-- /omni-outbox-settled: s2-04-ask-mode-still-gated-by-email -->

<!-- omni-outbox-settled: s3-01-leftover-link-code-outside-territory -->

## s3-01-leftover-link-code-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-leftover-link-code-outside-territory
prd: 359
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The arcade no longer has a step to link GitHub, but some pieces that served it live in files this slice may not touch. Should this slice remove them, or leave them for a later tidy-up?

## The decision, in plain words

This slice leaves those pieces in place, unused by the arcade. The practice arcade, which only pretends to sign in, now also pretends to link GitHub at sign-in, so its guest can play at once like everyone else.

## The intro, for fun

The arcade tore down the old GitHub bridge, but the signposts are on the neighbour's lawn.

## The punchline, for fun

They stay up for now, pointing proudly at nothing.

## The options, in plain words

A. A: leave the unused pieces where they are, and let the practice arcade link its guest when it signs in (built)
B. B: let this slice remove the unused pieces, and have the practice arcade give its guest a GitHub name at sign-in
C. C: remove the unused pieces in a later tidy-up slice

## What I had to decide

Whether to remove the now-unused link-step code that sits outside s3's territory.

## What I did meanwhile

The arcade no longer calls the link step. Left in place, unused by the arcade: Account.linkGithub in src/arcade/types.ts and its three implementations (account-supabase.ts, account-demo.ts, account-closed.ts); the callback's next=link answer in src/data/sign-in.ts (['linked', …] / ['link_error', …]); and games/room.ts's 'LINK GITHUB TO EARN XP' visitor label, which no signed-in account reaches now. The demo account's signIn does not set a GitHub login and its save refuses a guest without one, so ArcadeApp's signIn calls account.linkGithub() once when the session it gets back has no login: the demo guest is linked at sign-in and plays at once.

## What it costs to change later

A constant: a follow-up deletes the unused method, the next=link branch and the label, and moves the demo's made-up login into its signIn.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no slice for the Account interface, sign-in.ts's next=link path or games/room.ts once the link step goes (author)

```

<!-- /omni-outbox-settled: s3-01-leftover-link-code-outside-territory -->

<!-- omni-outbox-settled: s3-02-outsider-keys-and-play-row -->

## s3-02-outsider-keys-and-play-row — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-outsider-keys-and-play-row
prd: 359
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

Someone signed in who belongs to no workspace sees a screen sending them to sign up. Which buttons should it offer, and what should the menu offer someone signed in who has not picked a team yet?

## The decision, in plain words

On that screen the main button goes to sign-up and the back button signs out. In the menu, someone without a team still sees a Play row, which now leads straight to picking a team.

## The intro, for fun

A visitor with no workspace walks up to the cabinet and presses every button.

## The punchline, for fun

One says sign up, the other says goodbye; both are honest.

## The options, in plain words

A. A: the main button goes to sign-up, the back button signs out, and the menu keeps a Play row for someone without a team (built)
B. B: the main button goes to sign-up, the back button returns to the title, and signing out stays in the menu only
C. C: drop the Play row, so the start screen is the only way to pick a team

## What I had to decide

The outsider screen's keys, and what replaces the menu row that used to lead to the link step.

## What I did meanwhile

OutsiderOverlay (src/arcade/scenes/join.tsx) shows NO WORKSPACE YET, the account as @login (or the email when there is none), and a link to /signup; A (or START) goes to /signup, B signs out (it used to be A sign out, B back to the title). The menu's PLAY row, shown to a signed-in account with no fleet, is kept with the id 'play' and opens afterGate (the intro, or the fleets) instead of the link screen.

## What it costs to change later

A constant: the keys in ArcadeApp's outsider case and the row in menuItems.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks only that the outsider screen point at /signup; it does not name the keys or the menu row (author)

```

<!-- /omni-outbox-settled: s3-02-outsider-keys-and-play-row -->

<!-- omni-outbox-settled: s4-01-request-waits-on-every-org -->

## s4-01-request-waits-on-every-org — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-request-waits-on-every-org
prd: 359
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When someone who is not their org's admin asks for Omni Loop, GitHub does not tell us which org they asked for. Which org should they be told they are waiting on?

## The decision, in plain words

They are recorded as waiting on every GitHub org of theirs that does not have Omni Loop yet, and the waiting screen names them all. Whichever of those orgs gets Omni Loop first, their next sign-in puts them in its workspace.

## The intro, for fun

GitHub passes on the request but loses the envelope with the org's name on it.

## The punchline, for fun

So the visitor waits politely at every door they have a key to.

## The options, in plain words

A. A: record a request for every org of theirs without the App (built)
B. B: ask the visitor on the waiting screen which org they asked for, and record only that one
C. C: have /signup ask for the org first and send it through GitHub's state parameter

## What I had to decide

Which org a sign-up request is recorded for, when GitHub's setup address carries no installation and no org.

## What I did meanwhile

On setup_action=request, finishSetup() reads the visitor's orgs with a fresh GitHub token, keeps those the App reports no installation for (GET /orgs/{org}/installation answering 404), and records one signup_requests row for each; /signup?waiting=<orgs> names them. At a later sign-in, completeRequests() only acts on an org the person still belongs to, so a request never outlives the membership.

## What it costs to change later

A constant: the set of orgs recorded is chosen in one loop; the table and the completion rule stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the request is recorded with its org, but GitHub's setup redirect for a request names no org, and the plan does not say how to learn it

```

<!-- /omni-outbox-settled: s4-01-request-waits-on-every-org -->

<!-- omni-outbox-settled: s4-02-setup-signs-in-again -->

## s4-02-setup-signs-in-again — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-setup-signs-in-again
prd: 359
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

After someone installs Omni Loop, we must check they really belong to the org they installed it on, and that needs a fresh look at their GitHub account. How do we get that look, since we never keep their GitHub key?

## The decision, in plain words

Coming back from the install, the visitor is quietly signed in with GitHub once more, which takes a blink and asks nothing since they already agreed. That fresh sign-in is what proves who they are before any workspace is made.

## The intro, for fun

The bouncer forgot your face between the coat check and the dance floor.

## The punchline, for fun

So you flash your badge again, and he pretends he knew it was you.

## The options, in plain words

A. A: sign the visitor in with GitHub again on the way back, silently (built)
B. B: keep the visitor's org list from their last sign-in, briefly, and check against it
C. C: add the members read permission to the App and ask GitHub with the App's own key

## What I had to decide

How /signup/installed learns the visitor's GitHub login and orgs, given the provider token is never stored and the App has no members permission.

## What I did meanwhile

/signup/installed validates the address, then starts GitHub's sign-in from the server (signInWithOAuth with skipBrowserRedirect, read:org) coming back to /signup/installed/callback with the setup in its query; the callback exchanges the code, reads the account once, joins by org, checks the installation, makes the workspace and links GitHub. It also signs in a visitor who arrives straight from GitHub. Supabase's redirect allow-list must accept that callback (the README's '/**' entries do). setup_action=update is read as an install, since making the workspace is idempotent.

## What it costs to change later

A constant: the check could read orgs kept from the last sign-in instead, in the one route that starts the sign-in.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says to check the visitor against the installation's account but not where their orgs come from at that moment; the App's permissions exclude reading org members
- (author) Not proven live: that GitHub skips its consent screen on the second sign-in, and that the session cookie set in the route survives the redirect (the auth callback relies on the same)

```

<!-- /omni-outbox-settled: s4-02-setup-signs-in-again -->

<!-- omni-outbox-settled: s4-03-no-workspace-lands-on-play -->

## s4-03-no-workspace-lands-on-play — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-no-workspace-lands-on-play
prd: 359
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The design says a person who signs in and belongs to no workspace goes straight to the sign-up page. Should the sign-in itself send them there, or should the game's own screen point them to it?

## The decision, in plain words

The sign-in still sends everyone to the game. A person with no workspace sees the game's 'wrong cartridge' screen, which points them to the sign-up page, one click away.

## The intro, for fun

The front door opens onto the arcade even for people who have no ticket yet.

## The punchline, for fun

The machine they reach kindly tells them where the ticket booth is.

## The options, in plain words

A. A: keep landing on the game, whose outsider screen points at sign-up (built)
B. B: have the sign-in send a person in no workspace to the sign-up page directly, in a rework slice

## What I had to decide

Whether the arcade sign-in callback redirects a person in no workspace to /signup, as the spec's diagram shows.

## What I did meanwhile

apps/galaxy/app/auth/callback (s2's territory, not s4's) still redirects every arcade sign-in to /play; s3's outsider screen links to /signup. This slice's afterSignIn completes requests but does not choose the redirect.

## What it costs to change later

A constant: one membership read and one branch in the callback's redirect.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives the callback route to s2 and the outsider screen to s3, and names no slice for the redirect the spec's diagram draws

```

<!-- /omni-outbox-settled: s4-03-no-workspace-lands-on-play -->

<!-- omni-outbox-settled: s5-01-fine-print-still-invite-only -->

## s5-01-fine-print-still-invite-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-fine-print-still-invite-only
prd: 359
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The front page's order form still says Omni Loop is invite-only while in beta, but the sign-up button now lets anyone with GitHub in. Should the fine print change?

## The decision, in plain words

The fine print was left as it is: the spec asks only for the button to work, and nobody has said what the new line should be.

## The intro, for fun

The door now opens for anyone, and the sign beside it still says members only.

## The punchline, for fun

The sign stays until someone picks the new words.

## The options, in plain words

A. A: keep 'Invite-only while in beta.' (built)
B. B: drop the invite-only clause, keeping 'Omni Loop runs on Claude Code.'
C. C: replace it with a line about installing Omni Loop on your GitHub org

## What I had to decide

Whether to change the order form's fine print, which says invite-only, now that sign-up is open.

## What I did meanwhile

Kept 'Omni Loop runs on Claude Code. Invite-only while in beta.' under the enabled button in apps/galaxy/src/home/spreads/OrderForm.tsx; its test still pins that line.

## What it costs to change later

A constant: one sentence and the test line that pins it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the plan do not mention the fine print; whether the beta is still meant to feel invite-only is a product call

```

<!-- /omni-outbox-settled: s5-01-fine-print-still-invite-only -->

<!-- omni-outbox-settled: s5-02-sign-up-without-a-database -->

## s5-02-sign-up-without-a-database — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-sign-up-without-a-database
prd: 359
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When the front page runs without its database, as in the demo, there is nobody to sign up with. What should the sign-up button do there?

## The decision, in plain words

It opens the game, just like the start button, instead of showing an error.

## The intro, for fun

A sign-up desk with no guest book behind it.

## The punchline, for fun

So the clerk just waves you through to the arcade.

## The options, in plain words

A. A: open the game at /play (built)
B. B: keep the button disabled on the demo
C. C: show a message that sign-up needs the real deployment

## What I had to decide

What SIGN UP WITH GITHUB does when the build has no Supabase configured.

## What I did meanwhile

signUp() in apps/galaxy/src/home/sign-up.ts goes to /play when the browser has no Supabase URL and key; with them, it starts the GitHub sign-in back to /auth/callback.

## What it costs to change later

A constant: one branch in signUp() and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec describes the button only on a deployment with Supabase

```

<!-- /omni-outbox-settled: s5-02-sign-up-without-a-database -->
