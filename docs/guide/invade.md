---
title: Invade
description: Letting the loop read your repository and write down what it learned.
---

The loop builds well only in a repository it understands: where code may go, how to run the tests,
what must stay true about your product. **Invading** is how it learns that. `/omni:invade` reads
your repository, asks you one round of questions, and writes what it learned in a pull request you
review and merge. It changes no code.

Do this once, after the kit is merged into your default branch ([Install](/docs/install)).

## Run it

Start Claude Code at the root of your repository, on your default branch and up to date, and type:

```text agent
/omni:invade
```

It works on its own branch, `docs/omni-invade`, in a separate folder under `.claude/worktrees/`, so
your checkout is left as it is. It first reads the whole repository, and changes nothing while it
reads: your packages and folders, the pages that state how the product must behave (READMEs, specs,
rule pages), what the code and its tests enforce, your decision records, your CI, and your pull
request template. It may run your install, build and test commands to check them; it never runs one
that deploys or publishes.

## What it asks you

Once it has read everything, it shows you **one map** of what it found, and asks a numbered list of
questions, each with a default:

- **Each domain** it found (a part of your product, like billing or quotes): keep it, rename it, or
  drop it. The default is to keep it.
- **Each page that states rules:** index it, so the loop can cite each rule by an id, or use it only
  as context. The default is to index it.
- **Your decision records**, when you keep them somewhere of your own: point at that folder, or copy
  them into `.omni-loop/knowledge/adr/`. The default is to point at them.
- **Drafting from code:** whether to also write down the rules your code enforces that no page
  states. The default is on.

Under each default it says what it would write, such as "index: 12 entries". Answer all of them in
**one message**: "all defaults" is an answer, and so is "drop the legacy domain, the rest as
proposed". Nothing is written before you answer. This is the only time it asks.

## What it writes

Everything it writes is under `.omni-loop/knowledge/`, plus a proposed change to
`.omni-loop/config.yml`:

- **The registers:** what is true about your product, in `product/` and one `domains/<domain>/`
  folder per domain you kept. Each holds `principles.md`, `rules.md` and `invariants.md`: every
  principle, business rule and invariant it found, one entry each, with an id like `BR-QUOTE-1` and
  the file it came from. A domain folder also has a `README.md`.
- **The playbook:** one form per question an agent asks while it builds (how to set up and test,
  what must pass before a pull request, how CI works, what a pull request looks like), in
  `playbook/`. It fills a section only from what a file in your repository shows, and every command
  it writes there ran green first. A form that one of your pages already answers points at that page
  instead of copying it.
- **Questions for you:** where your repository could not prove something, it writes a
  `TODO(human):` line with a question you can answer in one line, instead of a guess.
- **The config:** a separate commit proposing what it learned, such as the test commands that
  really run here, or turning the knowledge registers on as the loop's laws.

Every entry it writes carries a `Proposed:` line. **A proposed entry is not a law yet:** the loop
reads it to understand your product, but it never stops the loop's work. It becomes a law when a
person deletes its `Proposed:` line. Merging the pull request confirms nothing.

## The pull request it opens

It ends by opening one pull request, docs only, from `docs/omni-invade` into your default branch,
titled `docs(knowledge): invade — set up the knowledge base`. Its description holds:

- **Map, as answered:** your answers to its questions.
- **Proposed entries:** how many entries each register file got.
- **Forms:** which forms are filled, pointed or still blank.
- **Open questions:** a checkbox per `TODO(human):` line it left.
- **Config:** each setting it proposes to change, and the file that shows why.

It never merges it. **You do.**

## Review it and merge it

1. Read the proposed entries: a rule stated wrong now is a rule the loop follows wrong later.
   Change or delete any entry in the pull request; it is only a proposal.
2. Answer the open questions you can: replace the `TODO(human):` line with the answer, add
   ` · by: human` to the end of that section's `<!-- slot: … -->` line, and tick its box. An
   unanswered question never blocks the loop: until you answer it, the kit's default applies.
3. Keep or drop the config commit.
4. When the pull request is green, merge it on GitHub, then bring your checkout up to date:

```bash terminal agent
git pull
```

From now on, every agent that builds in your repository reads what you merged. To read one form as
the agents see it:

```bash terminal agent
omni kb show testing
```

and to read one entry of the registers, by an id from your own registers:

```bash terminal agent
omni knowledge BR-QUOTE-1
```

When your repository changes a lot, run `/omni:invade --refresh`: it redoes only what went stale,
and never rewrites what a person wrote.

## A plan repository

When one feature lands in several repositories (the screen in one, the business logic in another),
you can keep its plan in one place: a **plan repository**. It holds no product code; it carries the
PRDs, while the code's pull requests open in its **target repositories**. Install the loop in it
like any other repository, then, at its root, type:

```text agent
/omni:mega-invade
```

It reads the page of your plan repository that says which repository does what (a guide with one
`## <name>` heading per repository), and the targets its config already lists. It reads each of
them through GitHub, without cloning it, and shows you **one map**: whether each has the loop, its
version, and whether it has a knowledge base of its own. Then it asks, in one list, for each one:

- **target or not**, and its **role**: one word such as `back-end`, `front-end` or `legacy`;
- for a target without a knowledge base of its own, **import one or not**. Import reads a shallow
  copy of that repository, never runs anything in it, and writes a draft of its knowledge base in
  your plan repository, under `.omni-loop/knowledge/repos/<name>/`. A target that has its own is
  read where it lives, never copied.

It writes only in your plan repository, never in a target. It ends with one docs-only pull request:
the imported drafts, the `plan` section of `.omni-loop/config.yml` in a commit of its own, a table of
where each target stands, and, for each gap, the step to take in that repository:
`npx omni-loop init`, then `/omni:invade` there. You merge it.

From then on, to see where each target stands:

```bash terminal agent
omni targets
```

It prints one row per target: its role, where its knowledge lives, the loop's version, and its
state: `ok`; `stale` when an imported draft was read before a change to a file it was drawn from;
`drifted` when the config no longer says what the repository has; `unreachable` when GitHub will not
show it to you. It reads and never changes anything. To refresh the stale drafts, type:

```text agent
/omni:mega-invade --sync
```

It redraws only what changed, never rewrites what a person wrote, proposes to drop the draft of a
target that now has its own knowledge base, and opens one pull request, or none when there is
nothing to do.

[Next → How the loop works](/docs/loop)
