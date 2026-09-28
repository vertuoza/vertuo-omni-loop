---
title: Your first PRD
description: From an idea to a merged feature and its release note.
---

This page takes one idea of yours all the way through the loop: from a conversation in Claude Code
to a feature merged into your default branch. You do four things along the way, and the loop does
the rest:

1. Describe the idea, with `/omni:brainstorm`.
2. Review and merge the **phase-0 pull request**: the written plan, before any code exists.
3. Run `/omni:yolo`, then read the questions the agents left you, and answer them.
4. Review and merge the **feature pull request**: the finished change.

Nothing reaches your default branch unless you merge it yourself.

## Before you start

Your repository has the loop installed and invaded: you followed [Install](/docs/install) and
[Invade](/docs/invade), and merged both pull requests. Bring your checkout up to date, then open
Claude Code at the root of the repository:

```bash terminal
git switch main
git pull
claude
```

Use your own default branch in place of `main` if it has another name. The checkout must have no
uncommitted changes: `/omni:yolo` refuses to start on one that has.

Pick a small idea for the first run: a change to something that already exists, which you could
explain to a colleague in two minutes. The loop copes with big ideas, but a small one lets you see
every step in an afternoon.

## 1. Describe the idea: `/omni:brainstorm`

In Claude Code, type `/omni:brainstorm`, followed by your idea in one sentence:

```text agent
/omni:brainstorm Let people export their invoices as a CSV file
```

What you see:

- **A link to follow along**, when your repository has dossiers switched on: a line starting with
  "follow along at", which opens a page where anyone in your workspace can read the PRD as it is
  written. With dossiers off, there is no link, and nothing else changes.
- **How big Claude thinks the idea is.** It says so out loud before its first question: a
  **spike** (a "can we…?" question, answered without building anything), **bounded** (a
  well-scoped change to something that exists) or **architectural** (something new, or a change to
  how parts fit together). If you disagree, say so: it takes the heavier one.
- **Questions, one at a time.** What you want, who it is for, what success looks like. Answer in
  plain words. For a bigger idea it proposes two or three approaches and recommends one.
- **The design, for your approval.** Nothing is written until you say yes. For an architectural
  idea it shows the design section by section, then asks you to review the written spec too.

A spike ends here, with an answer and no pull request. Anything else carries on by itself, and
Claude opens, in your repository:

- **The PRD issue**, titled `PRD: <your title>`, with the `omni:prd` label. Its number is the
  PRD's number: every later step uses it.
- **A feature branch**, `feat/<topic>`, holding the PRD's folder: `spec.md` (what changes, and
  why), `plan.md` (how it gets built, in thin slices) and `before-after.html` (the screen today
  beside the screen after, or the behaviour today beside after).
- **The feature pull request**, as a draft, with the `omni:feature` label. It stays a draft for now.
- **The phase-0 pull request**, with the `omni:phase-0` label: the same folder, and nothing else,
  going into your default branch.

The reply ends with three blocks: the PRD's folder, **Where it is** (the loop's six stages, with
"you are here" under PRD), and **What is next?**, whose last line is the command to run next,
`/omni:yolo` followed by the PRD's number.

If Claude stops with "needs clarification", the plan could not be written without a guess: it has
asked its question on the PRD issue. Answer it there, then tell Claude, in the same session, that
it is answered: it writes the plan and opens the phase-0 pull request.

## 2. Review and merge the phase-0 pull request

Open the phase-0 pull request from the link under **What is next?**. It holds only documents, no
code: this is the cheapest moment to change your mind.

- Read `spec.md`: is this what you asked for?
- Look at `before-after.html`: is the after the one you want? GitHub shows its source, so open it
  from the dossier link when you have one, or download the file from the pull request and open it
  in your browser.
- Skim `plan.md`: the slices, each with the files it may touch, and the waves they are built in.

Something wrong? Do not merge. Tell Claude what to change, in the same session, and ask it to
update the PRD on the feature branch and on the phase-0 pull request alike. When it is right,
**merge the phase-0 pull request** on GitHub. The PRD is now in the
**inbox**: approved, and ready to build.

## 3. Build it: `/clear`, then `/omni:yolo <n>`

Start from a clean session: type `/clear` (or open a new terminal and run `claude` again).
Everything the next step needs is in the repository and on GitHub, so nothing is lost. Then run
`/omni:yolo` with the PRD's number, for example:

```text agent
/omni:yolo 7
```

It asks you nothing. What you see on GitHub while it runs:

- The feature pull request gets the `omni:in-progress` label, and a status comment that says where
  it is ("merging slices", then how many slices are merged out of how many).
- One **sub-pull request** per slice, with the `omni:sub` label, opened into the feature branch
  (not into your default branch) and merged there by the loop, one at a time. Slices of the same
  wave are built side by side.
- Every decision an agent had to take without you becomes a question in the PRD's **outbox**,
  instead of a stop. You answer them all at once, at the end.

When it has finished, the reply ends with the same three blocks, the "you are here" marker now under
**outbox**, and one of three endings:

- **Nothing to run: merging the feature pull request is yours.** Every slice is merged, no question
  is waiting for you, and the feature pull request is marked **ready for review**. Go to step 5.
- **The last line is `/omni:yolo-fix` with the PRD's number.** Every slice is merged, but questions
  wait for you: the feature pull request stays a **draft**. Go to step 4.
- **The last line is `/omni:yolo` again.** Something holds it: a slice that could not be built, a
  check that stayed red, or something only a person can do (a secret, an access right). Step 1 of
  **What is next?** links the pull request that holds it, and step 2 says what to do. Do it, then
  run `/omni:yolo` again: it picks up where it stopped.

`/omni:yolo` leaves your checkout on a detached commit. To come back to your default branch:

```bash terminal agent
git switch main
```

## 4. Answer the outbox, then `/omni:yolo-fix <n>`

On the feature pull request, a comment lists every open question, each under a number: the
question in plain words, the options, and which one was built (always **A**, the recommended one).
Reply to it in a new comment on that pull request, one line per question:

```text github
1: A
2: B because the export must include cancelled invoices
```

- `1: A` keeps what was built.
- `2: B because …` chooses another option, and says why.
- `go with recommendation`, alone on a line, keeps what was built for every question.
- A question that asks something of a person (to add a secret, say) takes `3: ok` once it is done.

Only people with write access to the repository are read. A reply changes nothing on its own: once
you have answered, type `/clear`, then run:

```text agent
/omni:yolo-fix 7
```

It reads your replies and records them. Where you chose another option than the one built, it
rebuilds that part, one sub-pull request per question, never wider than the question said it could
go. It raises no question of its own. When nothing is left open, it marks the feature pull request
**ready for review**. A reply it could not read is asked again, in a new comment on the pull
request: answer that one, and run `/omni:yolo-fix` again.

## 5. Merge the feature pull request

The feature pull request is ready: review it like any other. Its description says what was built,
how it was checked, the risk and how to roll it back, and where to look first. The outbox comment
lists every decision the agents took, and your answers.

When the Omni Loop GitHub App is installed on the repository, it posts a check named `outbox` on
the feature pull request: green means no question is left open.

**Merge it.** The PRD is **shipped**: the change is on your default branch, and the PRD issue is
closed. Its folder moves from `.omni-loop/delivery/inbox/` to `.omni-loop/delivery/shipped/`, with
its outbox inside it.

With the GitHub App installed, two more pull requests open a little later: a **retro** (how the
delivery went, with the `omni:retro` label) and a **knowledge** pull request (the decisions you
settled, written back into what the loop knows about your repository, with the `omni:knowledge`
label). Review and merge each.

## 6. The release note

When release notes are switched on in your repository, the loop writes one before it marks the
feature pull request ready: `release.md`, in the PRD's folder beside `spec.md`, a title and one
short paragraph saying what shipped, for people outside the team. You review it with the rest of
the feature pull request, and once merged it sits in the shipped folder, at
`.omni-loop/delivery/shipped/<n>-<topic>/release.md`.

The **Release notes** page of the Omni Loop app lists the releases of Omni Loop itself for now;
the release notes of your own repository will be shown there in a later version.

## Two switches worth turning on

A fresh install leaves dossiers and release notes off. To turn both on, add these lines to
`.omni-loop/config.yml`, then commit and merge the change:

```yaml file=.omni-loop/config.yml
ask:
  url: https://vertuo-omni-loop-galaxy.vercel.app
dossier:
  enabled: true
releaseNotes:
  enabled: true
```

Dossiers need you signed in on this computer (see [Install](/docs/install)). To check what the loop
sees, at any time:

```bash terminal agent
omni status
omni status 7
```

The first lists your PRDs and where each one stands; the second says whether PRD 7 still has open
questions.

[Next → When something goes wrong](/docs/troubleshooting)
