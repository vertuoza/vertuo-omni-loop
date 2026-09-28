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
