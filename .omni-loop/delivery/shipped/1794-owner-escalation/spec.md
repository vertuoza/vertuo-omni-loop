---
prd: 1794
title: An unanswered owner escalates to a delegate, never to an auto-approve
blocked-by: none
spec: file
---

## Problem

PRD 1726 made a law belong to people. A change to a locked law stays red (`law-locked`) until a
person CODEOWNERS lists for every file that fired it approves the pull request on GitHub
(`apps/omni-app/src/outbox-check/law-locked.ts`). The owners come from `laws.owners`, a flat list of
logins and teams (`kit/lib/config.ts:285`), and `omni kb owners` writes every one of them on every
line of its CODEOWNERS block (`ownersBlock`, `kit/lib/codeowners.ts:140`).

That is the right gate, and it has no plan B.

1. **One person away is a stuck pull request.** In this repository `laws.owners` is
   `[pierrederval]`. When he is on leave, a law-locked pull request waits, and nobody is told that it
   waits.
2. **High items wait the same way.** A `high` or `human-action` outbox item keeps the feature PR
   draft until a person answers it. The person who opened the PRD sees it in the bell on the Omni
   page (PRD 499), and nobody else does.
3. **Nothing measures the wait.** `limits.stallDays` only marks a slice whose sub-PR has had no
   commit (`kit/lib/next/decide.ts:85`). No code counts how long a person has not answered, and no
   code asks anyone else.
4. **The tempting fix is the wrong one.** A timeout that approves or adopts would break the
   principle P-PRODUCT-3: the outbox gate stays red until a person answers. The answer must come from
   a person, so the loop can only widen who is asked.

## Solution

### Who is asked, in three steps

`laws.owners` gains a delegate next to each owner, and `laws.leadership` names product leadership:

```yaml
laws:
  owners:
    - login: pierrederval
      delegate: jdoe
    - acme/platform          # a plain entry, as in PRD 1726: an owner with no delegate
  leadership: [cto-login]
limits:
  escalationWorkingDays: 2
```

- An entry of `laws.owners` is a plain owner (a login or `<org>/<team>`, as today) or an object
  `{ login, delegate }`. `delegate` is one GitHub login, never a team: a team never clears a law
  (`isPersonOwner`, `kit/lib/codeowners.ts`). A delegate equal to its own owner is refused.
- `laws.leadership` is a list of GitHub logins, empty by default.
- `limits.escalationWorkingDays` is a whole number from 1 to 10, default 2. It is its own setting;
  `limits.stallDays` is unchanged.
- A config with no delegate and no leadership escalates nothing: the repository behaves exactly as
  before.

A thing that waits on a person is a **held thing**: a locked law `law-locked` still holds on an open
pull request, or an open `high` or `human-action` item of an open feature PR.

| Step | When | Who is asked, for a held law | Who is asked, for a held item |
|---|---|---|---|
| 0 | from the moment it is first held | its CODEOWNERS, as today | the feature PR and the PRD's opener on the Omni page, as today |
| 1 | `escalationWorkingDays` working days later | each owner's delegate | each owner in `laws.owners` and each owner's delegate |
| 2 | `escalationWorkingDays` more working days later | + `laws.leadership` | + `laws.leadership` |

- **Working days** are Monday to Friday, counted in UTC, with no holidays. A wait that starts on a
  Saturday counts from Monday 00:00 UTC. Two working days after Friday 15:00 is Tuesday 15:00.
- **Asked** means two things. A new comment on the pull request mentions the people newly asked, so
  GitHub notifies them; an edited comment notifies nobody, so each step posts its own comment, once.
  And the held thing shows in the waiting-for-you list on the Omni page of each newly asked person
  whose GitHub login is known there.
- **Asking never decides.** No step approves a review, adopts or answers an item, applies a label,
  or changes the check's verdict. The outbox check and `law-locked` stay red until a person answers.
- **It ends when a person answers.** An item answered on the feature PR (`kit/lib/outbox/replies.ts`
  counts writers only), a CODEOWNER's approval that clears `law-locked`, or a closed pull request
  ends that held thing's escalation. Nobody more is asked about it.

### Where it is computed: the Omni GitHub App

The App already reads, from the base branch, the config and CODEOWNERS, and it already computes
`law-locked` and the open items in the outbox check (`apps/omni-app/src/outbox-check/outbox-check.ts:261`).
It already runs scheduled functions (`apps/omni-app/src/pr-stats/pr-stats.ts:35`) and edits one
comment per marker (`upsertComment`, `apps/omni-app/src/verdict-comment/verdict-comment.ts`).

1. **A pure kit module**, `kit/lib/escalation/escalation.ts`, decides who is asked: held things,
   the time each was first held, now, `laws.owners`, `laws.leadership` and `escalationWorkingDays`
   in; for each held thing its step, who is asked at that step, and when the next step falls due
   out. It reads no file and makes no request. It has no output that approves anything.
2. **The record.** After each outbox check run, the check hands what still holds to
   `apps/omni-app/src/escalation/record.ts`. It keeps one comment on the pull request, marked
   `<!-- omni:escalation -->` and edited in place: one line per held thing, when it was first held,
   who is asked now, and when the next step falls due. A held thing seen for the first time gets
   the time of that run. The comment is the only memory: deleting it restarts the count.
3. **The sweep.** A new scheduled function, `escalation`, runs every hour. For each open pull request
   carrying the escalation comment, it reads that comment, moves each held thing whose next step is
   due, posts one comment marked `<!-- omni:escalation-ask <thing> <step> -->` that mentions the
   newly asked people, and rewrites the record. A step already posted is never posted again.
4. **The Omni page reads the record.** Galaxy's stages sync already reads each PRD's feature PR
   (`apps/galaxy/src/stages/outbox/recount.ts`). It now reads the escalation comment too, as it reads
   the outbox comment, and stores in each waiting item of `prd_outbox` who is asked
   (`asked: [<login>…]`). A held law on a feature PR is stored as a waiting item ranked
   `human-action`, with the question `Approve the change to <law id> on GitHub, or ask for changes.`
   `GET /api/waiting/outbox` adds to the person's list every waiting item, in their workspaces,
   whose `asked` holds their GitHub login (`loginOf`, `apps/galaxy/src/nav/viewer.ts:49`). The bell
   shows it as it shows any outbox item today.

### CODEOWNERS: delegates are owners, leadership is not

PRD 1726's gate clears `law-locked` with an approval from a person CODEOWNERS lists, read from the
base branch. That rule stays as it is. For a delegate's approval to count, `omni kb owners` now
writes each owner and each delegate on every line of its block. Leadership is not written into the
block, so leadership's approval never clears `law-locked`.

- `omni check knowledge` goes red when the block is out of date, as today, now counting delegates.
- `omni kb laws` names the delegate beside each owner: `Changing it needs @pierrederval (or the
  delegate @jdoe) to approve the pull request.`

### What stays the same

The gate's verdicts, `law-locked` itself, the replies reader, the override label and `/omni:drive`.
`omni next` gains nothing. The outbox check's summary text is unchanged.

## Decisions

- **Q2 — recommended default, accepted when the phase-0 PR merges:** Locked-law approvals and high items; a delegate next to each owner in laws.owners. (What does escalation cover, and where is the delegate kept?)
- **Q3 — recommended default, accepted when the phase-0 PR merges:** 2 working days, a setting of its own. (How long before an unanswered item escalates?)
- **Escalation covers both laws and items.** A law-locked pull request waiting on a CODEOWNER's
  approval, and an open `high` or `human-action` outbox item (the person's decision).
- **The delegate is kept in `laws.owners`,** next to its owner, not in a new section (the person's
  decision).
- **The timeout is 2 working days, in a setting of its own,** `limits.escalationWorkingDays`, not
  `limits.stallDays` (the person's decision).
- **Escalation never auto-approves.** It only widens who is asked; no step approves, adopts,
  overrides or changes a verdict (the person's decision, and P-PRODUCT-3).
- **Escalation is computed by the Omni GitHub App, around a pure kit module.** `omni next` is local
  and read-only, and `/omni:drive` stops itself once every PRD is parked, which is exactly when a
  person is awaited; neither runs while nobody is at a terminal. The App always runs and already
  holds the gate's inputs. This is the most reversible place: no migration, no new table, no change
  to a verdict; removing the function stops all asking, and the comments it leaves are inert.
- **A delegate is a CODEOWNER from the start.** `omni kb owners` writes owners and delegates into
  the CODEOWNERS block, so a delegate's approval clears `law-locked`, consistent with PRD 1726's
  gate. Consequence, said plainly: GitHub may request the delegate's review as soon as a pull request
  is ready, before step 1. The loop's own asking (the mention and the Omni page) still waits for
  step 1.
- **Leadership is asked, not made an owner.** Leadership is not written into CODEOWNERS, so its
  approval never clears `law-locked`. At step 2 leadership is asked to reach an owner or a delegate,
  or to change `laws.owners` in a pull request of its own. For a held item, leadership answers like
  any writer of the repository.
- **For a held item, step 1 asks the owners and their delegates.** A high item has no CODEOWNER;
  the owners of the product's laws were never asked about it, so they are asked with their delegates.
- **The wait is counted from the first outbox check run that saw the thing held,** recorded in the
  escalation comment, not from an item's `raised` date: an item can be raised days before a person
  is shown it.
- **Working days are Monday to Friday in UTC, with no holidays.** A zone or holiday setting is left
  out: the simplest calendar that cannot be read two ways.
- **This repository names no delegate in this PRD.** Who stands in for @pierrederval is his to say.
  The slice that changes the config raises one `human-action` item asking him to name a delegate and
  product leadership.

## User stories

- As a **developer** whose pull request changes a locked law, I am not stuck for a week when the
  owner is away: after 2 working days the delegate is asked, and their approval clears the gate.
- As a **PM** whose feature PR waits on a high item, the owners and their delegates see it in their
  bell after 2 working days, and leadership after 4.
- As a **delegate**, I learn I am asked through a GitHub mention and the bell on the Omni page, and
  the comment says since when the thing has waited.
- As **product leadership**, I am asked only after the owner and the delegate stayed silent, and
  nothing I am shown has been decided for me.
- As an **owner**, I keep the last word: nothing is ever approved or adopted because I was slow.

## Scope

**In:**

- the config: `laws.owners` entries with a `delegate`, `laws.leadership`,
  `limits.escalationWorkingDays`, read by `kit/lib/config.ts`;
- `omni kb owners` writing owners and delegates, its staleness check in `omni check knowledge`, and
  the delegate named by `omni kb laws`;
- the pure module `kit/lib/escalation/escalation.ts`;
- the App: the record after each outbox check run, the hourly `escalation` function, the two comment
  markers;
- galaxy: the stages sync storing `asked` and held laws in `prd_outbox.waiting`, and
  `GET /api/waiting/outbox` listing what asks the signed-in person;
- `docs/guide/loop.md`, beside its `laws.owners` steps: delegates, leadership, the three steps;
- this repository's `human-action` item asking @pierrederval to name a delegate and leadership.

**Out:**

- The briefing's text: P1, #1793.
- Named owners of the product's legal pages and glossary on the Omni page: P3, #1795.
- Domain contracts: P4, #1796.
- The knowledge graph: P5, #1797, and P6, #1798.
- Escalating `medium` items: they are adopted when raised.
- A zone or holiday calendar.
- An Omni page notification for a pull request with no PRD dossier (a fix or a knowledge PR): it
  gets the GitHub mention only.
- Any change to who may answer an item (`replies.ts`) or to what clears `law-locked`.

## Test seams

Following `omni kb show testing`: tests sit beside the code, run on fixtures, and never call GitHub
or Supabase.

- `kit/lib/config.test.ts`: a plain owner and a `{ login, delegate }` entry both parse; a team
  delegate, a delegate equal to its owner and a team in `leadership` are refused, each naming the
  key; `escalationWorkingDays` defaults to 2 and refuses 0 and 11.
- `kit/lib/escalation/escalation.test.ts` (pure): step 0, 1 and 2 at the right instants; Friday
  15:00 to Tuesday 15:00; a Saturday start; an answered thing asks nobody; no delegate and no
  leadership asks nobody; the output has no field that approves or adopts.
- `kit/lib/codeowners.test.ts` and `kit/bin/kb.test.ts` through `makeRepo()`: the block carries
  owners and delegates, never leadership; adding a delegate makes `omni check knowledge` report the
  block stale; `kb laws` names the delegate.
- `apps/omni-app/src/escalation/escalation.test.ts`, against the stubbed GitHub:
  - a first held run creates the record and mentions nobody new;
  - 2 working days later the sweep posts one ask mentioning the delegate; a second sweep posts
    nothing;
  - 4 working days later it asks leadership;
  - the outbox check stays `failure` at every step;
  - a delegate's approval clears `law-locked` when the base CODEOWNERS lists the delegate, and
    leadership's approval leaves it red;
  - an answered item and a closed pull request are asked about no more.
- `apps/omni-app/src/outbox-check/end-to-end.test.ts`: the check's conclusion and summary are the
  same with and without the record.
- `apps/galaxy/src/stages/outbox/recount.test.ts` and `apps/galaxy/src/outbox-waiting/outbox.test.ts`:
  `asked` is stored from the record; a held law becomes a `human-action` waiting item; the route
  returns an item to the delegate's login and not to a stranger's.
- `pnpm mutation:changed`: `kit/lib/config.ts` is delivery core.

## Risks

- **What merging publishes.** The kit (`kit/dist/omni.mjs` and the plugin), the Omni GitHub App
  (`apps/omni-app`) and the Omni page (`apps/galaxy`). No migration: `asked` lives inside the
  existing `prd_outbox.waiting` JSON. A repository with no delegate and no leadership sees no change.
- **An asked person who cannot answer.** A high item's answer counts only from a writer of the
  repository (`replies.ts`), and a law's approval only from a login CODEOWNERS lists. A delegate or a
  leader who is neither is asked and still cannot clear anything. The ask comment says so in one line.
- **A person with no Omni account** gets the GitHub mention only.
- **Noise.** At most two ask comments per held thing; a pull request with many held items gets one
  ask comment per step, listing them all.
- **The locked laws it touches** (`omni kb laws --paths` on the files above):
  - Both laws below govern `apps/omni-app/src/outbox-check/`, where `outbox-check.ts` gains one
    call that hands what still holds to the record. It decides nothing new.
  - N-PRODUCT-4: any change could switch its own gate off, and every reviewer would trust a green
    check that means nothing. Changing it needs @pierrederval to approve the pull request on GitHub.
  - BR-PRODUCT-6: a risky change nobody explained reaches the main branch, and the reviewer is never
    told. Changing it needs @pierrederval to approve the pull request on GitHub.
  - The other 15 locked laws govern none of the files this PRD changes.
- **Rollback.** Revert the merge. Before that, rewrite any `{ login, delegate }` entry of
  `laws.owners` as a plain login, since the previous kit refuses the object form, and run
  `omni kb owners` again, since the previous kit reports a block that names delegates as stale. The
  escalation comments left on pull requests are inert, and the stored `asked` field is ignored.

## Acceptance criteria

1. A config with `laws.owners` entries of both forms, `laws.leadership` and
   `limits.escalationWorkingDays` parses; a team delegate, a delegate equal to its owner and a team
   in `laws.leadership` are refused with an error naming the key.
2. `omni kb owners` writes each owner and each delegate on every line of its block, and no leader;
   `omni check knowledge` reports the block stale after a delegate is added, until it runs again.
3. When `law-locked` has held on an open pull request for 2 working days, one new comment mentions
   each owner's delegate; after 2 more working days, one new comment mentions `laws.leadership`.
4. When a `high` or `human-action` item has been open on an open feature PR for 2 working days, one
   new comment mentions each owner in `laws.owners` and each delegate; after 2 more working days, one
   new comment mentions `laws.leadership`.
5. No step is announced twice: a sweep that finds nothing newly due posts nothing.
6. At every step the outbox check stays red and `law-locked` stays red; no review, answer, adoption,
   label or verdict is made by the escalation.
7. A delegate's approval of the head commit clears `law-locked` when the base branch's CODEOWNERS
   lists the delegate; leadership's approval leaves it red.
8. Once a person answers the item, a CODEOWNER clears the law, or the pull request closes, nobody
   more is asked about it.
9. On the Omni page, a person asked at step 1 or 2 whose GitHub login is known sees the held item,
   or the held law as a `human-action` item, in the waiting-for-you list, for a PRD they did not open.
10. A repository with no delegate and no `laws.leadership` gets no escalation comment and no change
    to its waiting list.
11. Working days skip Saturday and Sunday in UTC: a wait starting Friday 15:00 UTC reaches step 1 on
    Tuesday 15:00 UTC.
