# Settled outbox items — PRD 1646

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-inputs-in-typescript -->

## s1-01-inputs-in-typescript — adopted

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
id: s1-01-inputs-in-typescript
prd: 1646
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The plan asked for the build rules to be written in plain JavaScript so any server could run them. This repository refuses plain JavaScript files, so which should give way?

## The decision, in plain words

The rules are written in TypeScript, which the build servers already run for the existing skip step. If a build server ever cannot run it, the step builds anyway, so nothing is skipped by mistake.

## The intro, for fun

The plan said JavaScript; the house rules said no JavaScript, thank you.

## The punchline, for fun

The house won, as houses tend to do.

## The options, in plain words

A. TypeScript, run by Node's own type stripping (what was built)
B. Plain JavaScript, with an exception added to the TypeScript guard

## What I had to decide

Keep the rules in TypeScript, or carve an exception into the repository's no-JavaScript rule.

## What I did meanwhile

The rules run as TypeScript on Vercel, the same way the existing skip step already runs the kit's TypeScript.

## What it costs to change later

Switching later is a file rename and a guard exception: an hour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which Node version Vercel's build image runs was not read from the dashboard; the repository requires 22.18 or later, which strips types by default (author)

```

<!-- /omni-outbox-settled: s1-01-inputs-in-typescript -->

<!-- omni-outbox-settled: s2-01-galaxy-ignores-version-stamp -->

## s2-01-galaxy-ignores-version-stamp — adopted

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
id: s2-01-galaxy-ignores-version-stamp
prd: 1646
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Every release stamps a new version number that the arcade shows in its sidebar. Should that number alone be worth rebuilding the arcade?

## The decision, in plain words

No: a release that only stamps the version does not rebuild the arcade, so a merge of documents builds nothing. The sidebar shows the previous number until the next merge that changes the arcade, as agreed in the design.

## The intro, for fun

One digit changed, and a whole arcade wanted to be rebuilt for it.

## The punchline, for fun

The digit can wait for the next real change.

## The options, in plain words

A. Version-only stamps never rebuild the arcade (what was built)
B. Every release rebuilds the arcade for its version number

## What I had to decide

Keep the version stamp out of the arcade's inputs, or let every release rebuild the arcade.

## What I did meanwhile

The arcade rebuilds only when something it serves changed; the version it shows can lag behind by a release or two.

## What it costs to change later

One line in the rules to switch back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's project rules said the root package.json stays a galaxy input; the approved design's accepted cost (the version lags after a docs-only merge) needs it out, and acceptance criterion 2 cannot hold otherwise (author)

```

<!-- /omni-outbox-settled: s2-01-galaxy-ignores-version-stamp -->

<!-- omni-outbox-settled: s2-02-omni-app-declares-yaml -->

## s2-02-omni-app-declares-yaml — adopted

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
id: s2-02-omni-app-declares-yaml
prd: 1646
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The GitHub App now installs only what it needs to run, but one library it uses was only ever installed for the whole workspace. How should it get it?

## The decision, in plain words

The GitHub App now lists that library as its own dependency, so its smaller install includes it. A test checks that every library its functions use is listed.

## The intro, for fun

The app had been borrowing a library from the neighbours without asking.

## The punchline, for fun

Now it has its own copy, with its name on it.

## The options, in plain words

A. List the library on the GitHub App (what was built)
B. Install the whole workspace for the GitHub App, as before

## What I had to decide

Keep the library listed by the GitHub App, or drop the smaller install for the GitHub App.

## What I did meanwhile

The GitHub App's install skips the workspace's development tools and still has every library its functions load.

## What it costs to change later

Removing the line and the install filter undoes it: minutes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Checked by running the filtered install in a throwaway checkout and loading each library; the first real Vercel build is the final proof (author)

```

<!-- /omni-outbox-settled: s2-02-omni-app-declares-yaml -->
