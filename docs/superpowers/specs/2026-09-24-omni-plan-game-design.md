# OMNI PLAN — the game layer

**Date:** 2026-09-24
**Status:** design, awaiting review
**Scope:** the mechanics and architecture of a gamified projection of PRD delivery. Not the visual universe, not the pixel-art UI; those come after the mechanics have run on real data.

## 1. Purpose

OMNI PLAN turns PRDs into executable plans that coding agents deliver across several engineering repositories. The game layer exists to, in this order:

1. **Recruit compute.** Anyone with a coding-agent slot can run `/omni-yolo <prd>` and lend that slot to a PRD they do not own.
2. **Make delivery state visible** across repositories, to engineers and leadership alike.
3. **Pull humans into the bottleneck.** Agents build fast; what stalls a PRD is an unanswered question, a stuck slice, a shipped bug. The game makes those cost something.
4. **Make shipping a shared event.**

The central object is the planet (the PRD), and the goal is to terraform it together. Individual recognition exists, and teams compete, but every point is earned by something the planet needed.

## 2. Principles

1. **The game is a removable projection.** It reads the delivery layer; it never writes to it. Plans, slices, inbox and outbox files carry no game vocabulary and no game-only fields. Delete `game/` and delivery does not notice.
2. **Nothing is invented.** Every number the economy uses is a fact of the delivery layer (a merge, a settle, a rank set by the register floor, a count of repositories) or a constant in one rulebook file. A person never types a difficulty, a value or a status into the game. This mirrors the inbox rule that a planner may never invent a business-value number.
3. **Recomputable.** Scores are a fold over an append-only ledger. The ledger can be rebuilt from GitHub history; the rankings can be rebuilt from the ledger.
4. **Playful surface, serious core.** Every mechanic must still be operationally true with the sprites turned off.

## 3. The delivery layer (what exists, and two changes)

The delivery machinery lives in each engineering repository today (`vertuo-ai-domain` is the reference):

- `docs/inbox/<prd>-<topic>.md`: the PRD's charter. Front matter only: `prd`, `title`, `blocked-by`, `plan`, `spec`. No status, priority or value field, ever.
- A plan splits the PRD into **waves** of **slices**; each slice is a sub-PR into `feat/<topic>`; one feature PR goes into `main`.
- `docs/outbox/<prd>/<slice>-<nn>-<slug>.md`: a decision an agent took and kept building on. Ranks `human-action`, `high`, `medium`; items bearing on an invariant or business rule floor at `high`. Settling yields `agreed` (closed) or `drifted` (build is wrong; a rework sub-PR closes it).
- `/vertuo-yolo #<prd>` runs every wave, asks nothing, ends with the feature PR ready and `ci/outbox` red, which is the expected end state. The board is rebuilt from GitHub each run; re-running resumes.

Two changes, both justified without the game:

**3.1 `/omni-yolo <prd>`** is `/vertuo-yolo` moved to `vertuo-omni-plan`, so it can dispatch to whichever engineering repository carries an inbox file for the PRD. Same behaviour, same guardrails (never asks, never merges `main`, never labels `outbox:go`).

**3.2 Claim first.** Today a slice is runnable when every blocker is merged and no sub-PR is open, and the sub-PR is opened after the build. Two concurrent runs therefore build the same slices. The slice subagent will open its draft sub-PR (`pr:sub`, `pr:in-progress`, one empty commit) **before** building. A second run excludes claimed slices. A claim whose status comment is older than an hour and whose branch has no new commits is stale and may be taken over, which is the existing "in flight" rule.

## 4. Teams and sectors

`projects.yml` at the root of `vertuo-omni-plan` is a plain org fact OmniMan needs to dispatch, not a game file:

```yaml
# placeholders: fill with the real repositories and home sectors
sectors:
  <sector-a>: { repos: [<repo-1>, <repo-2>] }
  <sector-b>: { repos: [<repo-3>, <repo-4>, <repo-5>] }
teams:
  beaver:          { home: <sector-a> }
  octopod:         { home: <sector-b> }
  picsou:          { home: <sector-a> }
  cia:             { home: <sector-b> }
  invincible-team: { home: <sector-a> }
```

Team membership comes from GitHub teams in the `vertuoza` organisation, with the same names. A person in no team scores individually only.

Working calendar: Monday to Friday, 09:00 to 18:00, `Europe/Brussels`. One constant. Decay ticks only inside it; the night-shift bonus applies only outside it.

## 5. Game model

### 5.1 Planet = PRD

A planet is born when an issue labelled `prd` is opened in `vertuo-omni-plan`. Its **regions** are the engineering repositories carrying an inbox file for that `prd` number. Its **captain** is the PRD's assignee (the PM); its **owning team** is the captain's team.

| State | Derived from |
|---|---|
| 🪐 Charted | PRD issue open; no feature PR yet. *Unsurveyed* until the first inbox file exists |
| 🌑 Locked | `blocked-by` names a planet not yet terraformed |
| 🌍 Terraforming | a feature PR is open |
| 📡 Distress | terraforming, at least one open zone, no claim for 8 working hours |
| 🛡 Awaiting command | every zone secured, feature PR ready, `ci/outbox` red |
| ✅ Terraformed | feature PR merged into `main` |
| ⚡ Aftershock | terraformed, and an open bug issue references the PRD within 14 days of the merge |
| 💀 Lost | see 5.5 |
| ⚪ Decommissioned | PRD closed while charted, before any zone was claimed. No penalty |

### 5.2 Zones and phases

A **zone** is a slice; a **phase** is a wave. Zone states, from the sub-PR into `feat/<topic>`:

| Zone | Derived from |
|---|---|
| open | runnable: blockers merged, no sub-PR |
| sealed | a blocker is not merged |
| claimed | draft sub-PR with `pr:in-progress` |
| under fire | sub-PR carries `pr:needs-fix` |
| secured | sub-PR merged into the feature branch |

A zone belongs to the region (repository) its sub-PR lives in. A plan edit that adds slices makes new zones appear; that is scope, not a fault, and costs nothing.

### 5.3 Wounds

A wound is anything only a human can close. Six sources, one decay rule (6.2).

| Wound | Source | Closed by |
|---|---|---|
| 📡 Transmission | open outbox item, `medium` | settle |
| 🟧 Unconfirmed ground | open outbox item, `high` | settle |
| 🟥 Beacon | open outbox item, `human-action` | settle |
| ⚡ Fault line | settled `drifted` | rework sub-PR merged |
| 🔥 Zone under fire | `pr:needs-fix` on a sub-PR | sub-PR green again, or merged |
| ⚡ Aftershock | bug issue referencing a terraformed PRD, within 14 days of merge | issue closed |

### 5.4 Threat

Threat I to V is a function of open wounds weighted by rank and age, plus the planet being in distress. Weights are rulebook constants; age is real. Threat is display only; it changes no points.

### 5.5 Lost and abandoned

A planet is **lost** when either:

- the PRD issue is closed while terraforming (at least one zone claimed) and the feature PR is not merged, or
- no delivery event of any kind (claim, merge, settle, comment on the feature PR) happens for 10 working days.

Every point earned on that planet, by anyone, is clawed back. The owning team's streak resets. Nothing else: no standing penalty.

### 5.6 Roles, descriptive only

Roles are read from behaviour, never assigned:

- **Captain**: the PM who owns the planet.
- **Crew**: the owning team's engineers.
- **Expedition**: anyone who ran `/omni-yolo` on the planet.
- **Rescuer**: someone from another team who closed a wound on it, or an expedition that answered a distress call.

### 5.7 Entropy

The enemy faction. Every wound is an Entropy unit on the planet's surface. OmniMan is the commander and never an enemy. Naming and visuals are for the later visual spec; the model only needs "a wound is an enemy".

## 6. Economy

All numbers live in `game/economy/rulebook.ts`. Every event names a **contributor** and a **planet**. Points go to the contributor and to the contributor's own team. The delivery bonus and all decay go to the planet's owning team.

### 6.1 Earning

| Event | Points | Note |
|---|---|---|
| Zone secured by your run | +10 | flat, so splitting a plan finer does not pay |
| Close 📡 / 🟧 / 🟥 | +5 / +15 / +25 | rank comes from the register floor, not the answerer |
| Rework a ⚡ fault line (rework sub-PR merged) | +20 | |
| Fix 🔥 (sub-PR back to green) | +10 | |
| Fix an aftershock (bug issue closed by a merged PR) | +20 | |
| Cross-team wound closure | ×1.5 | rescuer |
| Answer a distress call (first claim after 8 idle working hours) | +20 | rescuer |
| Night shift: zone secured by a run outside working hours | ×1.5 on that zone | rewards idle compute, not late humans; settling has no hour bonus |
| Planet terraformed | owning team +100 × class; every expedition member +50; every wound-closer +25 | class from 6.3 |
| Season streak (owning team) | +10% on the terraform bonus per consecutive planet, cap +50% | resets on a lost planet |

### 6.2 Decay (owning team, working hours only)

Per 4-working-hour tranche a wound stays open:

| Wound | Per tranche |
|---|---|
| 📡 | −1 |
| 🟧 | −3 |
| 🟥 | −5 |
| ⚡ fault line, 🔥 under fire | −3 |
| ⚡ aftershock | −5 |

Decay is never multiplied by class: a beacon ignored costs the same on every planet. A planet in **distress** decays nothing; it broadcasts, and the rescue bonus is the pull.

### 6.3 Difficulty, derived

Class = number of regions (repositories with an inbox file for the PRD).

| Regions | Class | Terraform multiplier |
|---|---|---|
| 1 | I | ×1 |
| 2 | II | ×1.5 |
| 3 | III | ×2 |
| 4+ | IV | ×2.5 |

A planet whose regions span more than one sector is **cross-sector**: a further ×1.25 on the terraform bonus. Slice and wave counts never enter difficulty; they are the one thing a plan author controls.

### 6.4 Brakes

- A settle whose item is later reopened or reworked claws back the settle points.
- An `undetermined` answer settles nothing and scores nothing.
- A zone secured then reverted before terraform scores 0.
- Running `/omni-yolo` earns nothing by itself; only what it secures does.
- A lost planet claws back everything earned on it (5.5).
- Seasons are monthly. Counters reset; a Hall of Fame keeps each season's top individuals and team.

### 6.5 Incentive audit

| Someone could | Why it does not pay |
|---|---|
| Answer every item "agreed" in seconds | rework claws the points back and the drift decays their team as fault lines |
| Split the plan into more slices | zone points are small and flat; the terraform bonus does not grow with slices |
| Raise items to farm settles | items are raised by agents; the raiser earns nothing |
| Keep runs on their own team's planets | cross-team ×1.5 and the rescue bonus pay more |
| Run at night for the multiplier | intended; the slot was idle |
| Merge early to stop decay | an aftershock decays more than the item did |
| Close a bug issue without fixing it | the fix bonus needs a merged PR that closes the issue |

## 7. Architecture

```
DELIVERY LAYER (GitHub: omni-plan issues, engineering repos, PRs, labels, inbox, outbox, CI)
      │  read only
      ▼
game/projector   GitHub → game events, appended to the ledger (idempotent)
      ▼
game/ledger/<yyyy-mm>.jsonl    append-only, committed; the one stored artefact
      ▼
game/economy     ledger + rulebook + calendar + season → points, rankings, threat
      ▼
game/season/<yyyy-mm>.json     derived snapshot, regenerable
      ▼
game/render      text banner for /omni-yolo; later the galaxy page
```

Dependencies point one way. `economy/` never touches GitHub; `render/` never touches the rulebook.

### 7.1 Events

Each event: `{ id, at, type, planet, region?, contributor?, team?, data }`. `id` is deterministic, `source:identity:state` (e.g. `pr:vertuo-ai-domain#1042:merged`, `outbox:985/s7-01-default-country:settled`), so replaying history appends nothing new.

Types: `PLANET_CHARTED`, `REGION_SURVEYED`, `PLANET_LOCKED`, `PLANET_UNLOCKED`, `ZONE_OPENED`, `ZONE_CLAIMED`, `ZONE_SECURED`, `ZONE_REVERTED`, `WOUND_OPENED`, `WOUND_CLOSED`, `DISTRESS`, `RESCUE`, `PLANET_READY`, `PLANET_TERRAFORMED`, `PLANET_LOST`, `PLANET_DECOMMISSIONED`, `PLAN_CHANGED`.

A wound event carries its kind (5.3) and, for outbox items, the rank. Decay is not an event; the economy computes it from `WOUND_OPENED`/`WOUND_CLOSED` timestamps and the calendar.

### 7.2 Storage

Option A now: the ledger lives in git, in `vertuo-omni-plan` under `game/ledger/`, one file per month. A GitHub Action polls every 15 minutes, with a `concurrency` group so two polls never append together, and commits with `[skip ci]`. The projector also runs on demand (`node game/projector.mjs --once`).

The event format is the contract. When a live galaxy page needs it, the ledger is imported into a database (Supabase) behind a web UI (Vercel); nothing upstream changes.

### 7.3 Sources

| Need | Read from |
|---|---|
| Planets, captain, owning team | `vertuo-omni-plan` issues labelled `prd`, assignee, GitHub teams |
| Regions, `blocked-by` | `docs/inbox/*.md` in each repository named in `projects.yml` |
| Zones, phases, claims | sub-PRs into `feat/<topic>`: labels `pr:sub`, `pr:in-progress`, `pr:needs-fix`, `merged_at`, head branch |
| Outbox wounds | open `docs/outbox/<prd>/*.md` (rank from front matter); `settled.md` entries (verdict, `--at`, `--by`) |
| Aftershocks | issues labelled `bug` referencing `#<prd>` created within 14 days of the feature PR merge; closing PR |
| Terraformed | feature PR `merged_at` |
| Clock | the working calendar constant |

### 7.4 The banner

`/omni-yolo <prd>` prints the same block at the start and in its final report, from live GitHub for that planet plus the season snapshot for scores:

```
OMNI PLAN // PLANET 2332 — Generic Import Engine
Class II · Threat III · phase 2/4 · zones 5/9 secured (ai 3/4 · core 2/5)
Wounds: 1 🟧 (14h) · 1 📡 (2h)
Captain: @pm · Crew: beaver · Expeditions: 3 · Rescuers: 1 (octopod)
Your run: claiming s4, s6
```

## 8. Error handling

- A source that cannot be read (rate limit, missing repo) skips that poll; the ledger is append-only, so a missed poll is caught up by the next. The projector never deletes.
- A malformed inbox or outbox file is ignored by the projector; the delivery guards (`check:inbox`, `check:outbox`) are where it fails, not here.
- An event whose contributor is in no GitHub team scores the individual only.
- A planet whose captain has no team has no owning team: it can be terraformed and scores expeditions and closers, but takes no decay and pays no team bonus. The banner flags it as *uncrewed*.
- Two runs claiming the same zone in the same minute: the earlier sub-PR number wins; the later run drops the zone. `ZONE_CLAIMED` is emitted once.

## 9. Testing

- `economy/` is pure: fixture ledgers cover a beacon ignored for a week, a night shift, a cross-team rescue, an abandonment with clawback, a season boundary, a streak reset. Each fixture asserts the exact points per person and team.
- `projector/` runs against recorded GitHub JSON fixtures; replaying the same fixtures twice must append nothing (idempotency).
- `render/` is snapshot-tested on the banner.
- Claim-first is tested in the engineering repository's `vertuo-parallel-wave` tests: two boards built from the same fixtures, the second excluding the first's claims.

## 10. MVP, in order

1. **Claim first** in `vertuo-parallel-wave`, and `/omni-yolo` in `vertuo-omni-plan`. Usable without any game.
2. **Projector + ledger + banner.** `/omni-yolo` prints the planet. A donor feels they joined something.
3. **Economy + rankings.** The scheduled Action writes the season snapshot and posts a weekly rankings comment (individuals and teams) on a pinned issue in `vertuo-omni-plan`.
4. **Galaxy page**, static, from the season snapshot: sectors, planets as circles, threat as colour, wound counts, distress pulses.

Not in the MVP: animations, sprites, hero profiles, fleet screens, OmniMan recommending missions, Supabase/Vercel.

## 11. Open placeholders

- `projects.yml`: the real repositories per sector and each team's home sector.
- The rulebook constants are first guesses; a season of real data decides them.
