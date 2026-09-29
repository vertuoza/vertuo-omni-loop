---
title: Several repositories
description: One feature across several repositories — a plan repository, its targets, and the mega and ultra skills, in three drawings.
---

Some features land in more than one repository: the business logic in the back-end, the screen
that shows it in the front-end. The loop can plan and build such a feature from one place. This page
shows how, in three drawings: the repositories, the pull requests over time, and the skills. Learn
the loop on one repository first ([How the loop works](/docs/loop)); everything here builds on it.

## What it is

A **plan repository** holds the PRDs of such features, and no product code. Its **target
repositories** hold the code: each PRD's plan says, for every slice, the target it lands in. The
mode has one rule: **one plan, one phase-0, one gate**. You approve the whole feature once, in the
plan repository, and you answer every decision the agents took once, in the plan repository, while
the code's pull requests open in each target.

The example on this page is the same throughout: PRD 600 lives in `vertuo-automation-plan`; its
slice s1 lands in `vertuo-backend-php`, and s2 and s3 in `vertuo-apps`.

## The repositories

![A plan repository in the middle and its targets around it, each with its role and where its knowledge lives: imported, its own, or none](diagrams/repositories.svg)

Each target has a **role**, one word such as `back-end`, `front-end` or `legacy`, and its knowledge
lives in one of three places: **own**, a knowledge base in the target itself, read where it lives;
**imported**, a draft of one written in the plan repository, under
`.omni-loop/knowledge/repos/<name>/`; or **none**.

### Set it up

Install the loop in the plan repository like any other repository ([Install](/docs/install)), then,
at its root, type:

```text agent
/omni:mega-invade
```

It reads the page of your plan repository that says which repository does what (a guide with one
`## <name>` heading per repository), and the targets its config already lists. It reads each of
them through GitHub, without cloning it, and shows you **one map**: whether each has the loop, its
version, and whether it has a knowledge base of its own. Then it asks, in one list, for each one:

- **target or not**, and its **role**;
- for a target without a knowledge base of its own, **import one or not**. Import reads a shallow
  copy of that repository, never runs anything in it, and writes the draft in your plan repository.
  A target that has its own is read where it lives, never copied.

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

## Plan across them

Once the targets are set, plan a feature across them. In the plan repository, type:

```text agent
/omni:mega-brainstorm
```

It is `/omni:brainstorm` for several repositories: it talks the idea through with you, asks which
repository does what (it never assumes it), and reads each one it touches from a copy that nothing
runs in. It writes one PRD whose plan has a `repo` column: the repository of every slice. The spec,
the plan, the draft feature pull request and **one phase-0 pull request** all open in the plan
repository; nothing is written in a target, and no target gets a phase-0 pull request.

The phase-0 pull request adds a **What lands where** table, so each team finds its part: one row per
repository, with its role, its slices and the waves they sit in. Every team reads the whole feature
side by side before any code exists. A person reviews it and merges it, which puts the PRD in the
plan repository's inbox.

## The pull requests over time

![The pull requests of PRD 600 over time: the one phase-0 pull request and the plan pull request with the one outbox in the plan repository, a feature pull request and its sub-pull requests wave by wave in each target, each slice's decisions carried into the outbox, and the merge order with the plan pull request last](diagrams/pull-requests-repositories.svg)

Time runs left to right, as in the [single-repository drawing](/docs/loop#the-pull-requests-you-will-see).
The plan repository gets two pull requests: the one phase-0, and the **plan pull request**, its
feature pull request, which holds the one outbox and closes the PRD. Each target gets one **target
pull request**, built slice by slice through sub-pull requests the agents merge into it, wave by
wave. Every decision an agent takes alone in a target comes back to the plan repository's outbox.
The numbers are the order you merge in: each target pull request first, the plan pull request last.

## Build

Once the phase-0 pull request is merged, build the feature. In the plan repository, type:

```text agent
/omni:ultra-yolo 600
```

with your PRD's number. It is `/omni:yolo` for several repositories:

- it opens **one feature pull request in each target**, and builds every slice there as a sub-pull
  request into it, wave by wave;
- it **relays every decision** the agents took in a target into the one outbox of the plan
  repository, where you answer them all in one place;
- in a target it runs **nothing but that repository's own committed checks**, the ones its config
  names;
- it marks each target pull request ready once its CI is green, and the **plan pull request ready
  last**, after all of them;
- it tells you the **order to merge in**: each target's pull request first, in the order of their
  earliest wave, then the plan repository's, which closes the PRD.

It never merges into any repository's default branch. You do.

## Which skill runs which

![Which skill runs which across repositories: you type /omni:mega-invade, /omni:mega-brainstorm, /omni:ultra-yolo and /omni:ultra-yolo-fix; ultra-yolo runs /omni:ultra-wave, which runs /omni:do-work in each target; /omni:do-work and /omni:pr are shared with the single-repository loop](diagrams/skills-repositories.svg)

| Skill | Type it when | It ends with |
|---|---|---|
| `/omni:mega-invade` | once, in the plan repository; with `--sync` when an imported draft went stale | one docs pull request: the map and the imported drafts |
| `/omni:mega-brainstorm` | you have an idea that spans several repositories | the PRD issue, the draft plan pull request and one phase-0 pull request; its last line is the `/omni:ultra-yolo` line |
| `/omni:ultra-yolo <n>` | the phase-0 pull request is merged | a target pull request per target, ready; the plan pull request ready, or questions for you |
| `/omni:ultra-yolo-fix <n>` | you answered the questions on the plan pull request | each rework built in its own target, and the plan pull request ready |
| `/omni:ultra-wave <n>` | you want one wave at a time; `/omni:ultra-yolo` runs it for you | the wave's slices merged into their targets' feature branches |

`/omni:do-work` and `/omni:pr` are the same skills the single-repository loop runs: `--target`
builds a slice in its target repository, and `--repo` opens and follows its pull request there. You
never type either flag.

## A red gate

When the agents met questions, the plan pull request stays a draft, with the questions posted on it.
Answer them there, in one comment, as you would on one repository, then, in the plan repository,
type:

```text agent
/omni:ultra-yolo-fix 600
```

It reads your answers on the plan pull request and reworks each decision you changed **in the
repository it was taken in**: a sub-pull request into that target's feature branch. Then it runs the
same gate again, and marks the plan pull request ready once no question is left.

[Next → Use cases](/docs/use-cases)
