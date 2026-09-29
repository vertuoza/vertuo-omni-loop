# Settled outbox items — PRD 612

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-checks-and-tests-outside-territory -->

## s1-01-checks-and-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-checks-and-tests-outside-territory
prd: 612
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Adding the new settings page meant touching files the plan did not list: the database check list run on every pull request, and three tests that count the sidebar's entries. Is that all right?

## The decision, in plain words

We added the new database check to the list that runs on every pull request, and taught the three sidebar tests about the new Repositories entry. Nothing else outside the plan was changed.

## The intro, for fun

The plan drew a fence, and the sidebar tests lived just over it.

## The punchline, for fun

We stepped over, fixed the count, and stepped back.

## The options, in plain words

A. Keep the four edits, the option built.
B. Move the workflow step to a separate pull request, and keep the three test edits, which the sidebar change forces.

## What I had to decide

Whether slice s1 may change .github/workflows/supabase.yml (one step running supabase/checks/repositories.sql) and three sidebar tests outside its territory (apps/galaxy/src/nav/Sidebar.render.test.ts, apps/galaxy/src/switch/headers.test.ts, apps/galaxy/src/switch/switch.test.ts).

## What I did meanwhile

The four edits are made: one workflow step, and the Repositories entry added to the three tests' expected lists. The plan's done-when asks for the check to pass in the supabase workflow, which needs the step.

## What it costs to change later

Reverting is removing one workflow step and three list entries; the check then never runs in CI and the sidebar tests go red.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant apps/galaxy/src/nav/sidebar to cover Sidebar.render.test.ts, whose name differs only in case (author)

```

<!-- /omni-outbox-settled: s1-01-checks-and-tests-outside-territory -->

<!-- omni-outbox-settled: s1-03-no-access-read-from-the-app -->

## s1-03-no-access-read-from-the-app — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-no-access-read-from-the-app
prd: 612
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

How does the Repositories page know the Omni App cannot read a repository, before the collector has even tried?

## The decision, in plain words

Each time the page opens, it asks GitHub which repositories the Omni App can see; a listed repository missing from that answer shows that the App has no access. When GitHub cannot be asked, the page shows the list without those marks.

## The intro, for fun

The page knocks on GitHub's door before the collector does.

## The punchline, for fun

Whoever does not answer gets a polite sticky note.

## The options, in plain words

A. The App's live listing on each page load, the option built.
B. Only the collector's recorded error, so the page calls GitHub only for Add repository.

## What I had to decide

Where the no-access mark on Settings → Repositories comes from: the App's live listing of its installation's repositories, read on each page load, or the collector's recorded error.

## What I did meanwhile

The live listing, read server side with galaxy's App credentials. The collector's error shows separately as a failed collection being retried. A workspace with no installation shows the install link above its list, which stays visible.

## What it costs to change later

A second source is a few lines in the page's read; meanwhile one more GitHub call per page load.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether one GitHub call per page load matters at the workspace's scale (author)

```

<!-- /omni-outbox-settled: s1-03-no-access-read-from-the-app -->
