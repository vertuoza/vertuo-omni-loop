# Settled outbox items — PRD 675

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s3-01-vercel-ignore-bundle-fallback -->

## s3-01-vercel-ignore-bundle-fallback — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-vercel-ignore-bundle-fallback
prd: 675
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Vercel decides whether to skip a preview before it installs anything, and this repository's own omni tool needs its installed packages to run. How should the skip step read the branch rule then?

## The decision, in plain words

The skip step tries the repository's own omni first and, when that cannot run, falls back to the ready-made single-file copy of the kit kept in the repository. If neither can read the rule, the preview is built as usual.

## The intro, for fun

The bouncer checks the guest list before the lights are even on.

## The punchline, for fun

So it keeps a pocket copy of the list, just in case.

## The options, in plain words

A. Try the repository's omni, then the kit's single-file copy; build when both fail
B. Use the repository's omni only; previews are built whenever it cannot run before install
C. Hard-code the phase-0 branch prefix in the script, as the test workflow does

## What I had to decide

Whether the skip step may read the branch rule through the kit's single-file copy when the repository's own omni cannot run before install.

## What I did meanwhile

scripts/vercel-ignore.sh tries .omni-loop/bin/omni.mjs, then kit/dist/omni.mjs; if both fail it builds.

## What it costs to change later

One line in the script: drop the fallback, or replace it with a literal branch prefix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Not yet seen on a real Vercel build whether node_modules is ever restored from the build cache before the ignore step (author)

```

<!-- /omni-outbox-settled: s3-01-vercel-ignore-bundle-fallback -->

<!-- omni-outbox-settled: s2-01-inbox-check-shares-outbox-event -->

## s2-01-inbox-check-shares-outbox-event — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-inbox-check-shares-outbox-event
prd: 675
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The plan said the app's front door should send a separate inbox signal beside the outbox one for every pull request change. Should it, or may the inbox check simply listen to the signal the outbox check already gets?

## The decision, in plain words

The inbox check listens to the outbox check's existing signal, so every pull request change starts both checks with nothing new sent. Pressing Re-run on the inbox check sends a signal of its own that starts only the inbox check.

## The intro, for fun

Two checks, one doorbell: why ring twice?

## The punchline, for fun

The inbox check just listens for the same ring.

## The options, in plain words

A. A. The inbox check listens to the outbox check's event; a Re-run of an inbox run sends the inbox event alone
B. B. The webhook sends both events for every pull request action, as the plan worded it
C. C. One event only, and the Re-run button of either check re-runs both

## What I had to decide

Whether the webhook sends a second, inbox-specific event for every pull request action, or the inbox-check function also triggers on the outbox check's existing event.

## What I did meanwhile

inbox-check triggers on omni-loop/outbox.check.requested and on omni-loop/inbox.check.requested. The webhook is unchanged for pull request actions; a check_run.rerequested whose external_id is omni-loop/inbox (every inbox check run carries it) becomes the inbox event alone. Sending a second event per action would have made the outbox check's own end-to-end test, outside this slice's territory, run the outbox function on the inbox event too.

## What it costs to change later

A constant: add the inbox event to toCheckRequests for pull request actions, drop OUTBOX_CHECK_EVENT from inbox-check's triggers, and make the outbox end-to-end test run only the outbox events it receives.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Not yet seen live whether Inngest fans one event out to both functions with each function's own debounce, as its documentation says

```

<!-- /omni-outbox-settled: s2-01-inbox-check-shares-outbox-event -->
