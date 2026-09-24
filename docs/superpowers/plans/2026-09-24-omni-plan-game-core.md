# OMNI PLAN Game Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A removable, read-only game projection of PRD delivery: GitHub history → append-only ledger → points and rankings → a text banner, run by a scheduled GitHub Action in `vertuo-omni-plan`.

**Architecture:** Five pure modules with one direction of dependency: `calendar` (working hours) → `events`/`ledger` (schema, deterministic ids, idempotent append) → `planet-state` (a world snapshot → planet, zone and wound states) → `projector` (snapshot → events) → `economy` (events + rulebook → credits, decay, clawback, rankings). One impure module, `sources/github.mjs`, builds the snapshot through the `gh` CLI via an injected `exec`, so every test runs on fixtures. Three CLIs and one workflow wire them together.

**Tech Stack:** Node 22 ESM (`.mjs`), pnpm, `zod` for schemas, `yaml` for `projects.yml`, `vitest` for tests, `gh` CLI for GitHub reads. No database.

**Spec:** `docs/superpowers/specs/2026-09-24-omni-plan-game-design.md`

**Scope of this plan:** spec §10 steps 2, 3 and the ledger of §7. Step 1 (claim-first in `vertuo-parallel-wave`, `/omni-yolo`) changes the delivery layer in `vertuo-ai-domain` and gets its own plan there, under that repository's process. Step 4 (galaxy page) is a later plan; it reads the `game/season/<yyyy-mm>.json` this plan produces. Until step 1 lands, two concurrent runs can still race on a zone; the projector already handles it (earlier sub-PR wins).

## Global Constraints

- The game never writes to the delivery layer: no labels, comments, files or issues in engineering repositories. The only writes are files under `game/ledger/`, `game/season/` and one weekly comment on a pinned issue in `vertuo-omni-plan` (spec §2, §10).
- No delivery file carries game vocabulary. Game words live only in `game/` (spec §2.1).
- Every number the economy uses is a fact of the delivery layer or a constant in `game/rulebook.mjs` (spec §2.2).
- Event ids are deterministic, `source:identity:state`; replaying the same history appends nothing (spec §7.1).
- Working calendar: Monday to Friday, 09:00 to 18:00, `Europe/Brussels` (spec §4).
- Seasons are calendar months (spec §6.4).
- Team membership comes from GitHub teams in the `vertuoza` organisation named `beaver`, `octopod`, `picsou`, `cia`, `invincible-team` (spec §4).
- `projects.yml` holds sectors and teams' home sectors; it is an org fact, not a game file (spec §4).

## Review Focus

1. A wound opened on a Friday at 17:00 and closed Monday at 10:00 must decay exactly 0 tranches (1 h + 1 h = 2 working hours < 4); pinned in Task 2's calendar tests and Task 6's decay test.
2. A sub-PR merged then reverted before terraform must net 0 for its author, not −10 on a fresh season; pinned in Task 6.
3. A settle whose verdict is `drifted` must score 0 for the settler and open a fault-line wound that decays the owning team; pinned in Task 4 (the fault line opens at the settle time) and Task 6 (the drifted settle scores 0; decay is table-driven by kind).
4. A PRD closed with no zone ever claimed is a decommission, never a loss; pinned in Task 5.
5. Replaying the projector over an unchanged snapshot appends nothing to the ledger; pinned in Task 3 and Task 5.

---

## File structure

```
package.json                     pnpm, scripts: test, game:project, game:score, game:banner
projects.yml                     sectors and teams (placeholders to fill)
vitest.config.mjs
game/
  calendar.mjs                   working-hours arithmetic
  events.mjs                     zod schemas, EVENT_TYPES, WOUND_KINDS, eventId()
  ledger.mjs                     readLedger(dir), appendEvents(dir, events)
  rulebook.mjs                   every constant
  planet-state.mjs               derivePlanet(planet, config, now) → state, zones, wounds, class, threat
  projector.mjs                  projectEvents(snapshot, config, now) → events[]
  economy.mjs                    score(events, { config, season, now }) → { credits, individuals, teams, planets }
  config.mjs                     loadProjects(path) → { sectors, teams, repos, sectorOf(repo), homeOf(team) }
  sources/github.mjs             buildSnapshot({ config, exec, now })
  render/banner.mjs              renderBanner(planetState, season) → string
  render/rankings.mjs            renderRankings(seasonJson) → markdown
  cli/project.mjs                snapshot → ledger append
  cli/score.mjs                  ledger → game/season/<yyyy-mm>.json + rankings.md
  cli/banner.mjs <prd>           prints the banner
  *.test.mjs                     beside each module
  ledger/                        <yyyy-mm>.jsonl (committed by the Action)
  season/                        <yyyy-mm>.json, rankings.md (committed by the Action)
.github/workflows/game.yml       poll every 15 min; weekly rankings comment
```

---

### Task 1: Scaffold the package

**Files:**
- Create: `package.json`, `vitest.config.mjs`, `projects.yml`, `.gitignore`, `game/rulebook.mjs`, `game/rulebook.test.mjs`

**Interfaces:**
- Produces: `RULEBOOK` object (below), imported by Tasks 4, 6, 8 by these exact keys.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "vertuo-omni-plan",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "vitest run",
    "game:project": "node game/cli/project.mjs",
    "game:score": "node game/cli/score.mjs",
    "game:banner": "node game/cli/banner.mjs"
  },
  "dependencies": {
    "yaml": "^2.5.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write vitest.config.mjs and .gitignore**

```js
// vitest.config.mjs
export default { test: { include: ['game/**/*.test.mjs'] } };
```

```
# .gitignore
node_modules/
```

- [ ] **Step 3: Write projects.yml with placeholders**

```yaml
# Org facts OmniMan needs to dispatch. Not a game file.
# Fill <sector-*> and <repo-*> with the real values (spec §4, §11).
sectors:
  <sector-a>: { repos: [<repo-1>, <repo-2>] }
  <sector-b>: { repos: [<repo-3>, <repo-4>, <repo-5>] }
teams:
  beaver: { home: <sector-a> }
  octopod: { home: <sector-b> }
  picsou: { home: <sector-a> }
  cia: { home: <sector-b> }
  invincible-team: { home: <sector-a> }
```

- [ ] **Step 4: Write the failing rulebook test**

```js
// game/rulebook.test.mjs
import { describe, it, expect } from 'vitest';
import { RULEBOOK } from './rulebook.mjs';

describe('rulebook', () => {
  it('holds every constant the spec names', () => {
    expect(RULEBOOK.zoneSecured).toBe(10);
    expect(RULEBOOK.woundClose).toEqual({
      transmission: 5, 'unconfirmed-ground': 15, beacon: 25,
      'fault-line': 20, 'under-fire': 10, aftershock: 20,
    });
    expect(RULEBOOK.decayPerTranche).toEqual({
      transmission: 1, 'unconfirmed-ground': 3, beacon: 5,
      'fault-line': 3, 'under-fire': 3, aftershock: 5,
    });
    expect(RULEBOOK.classMultiplier(1)).toBe(1);
    expect(RULEBOOK.classMultiplier(4)).toBe(2.5);
    expect(RULEBOOK.classMultiplier(7)).toBe(2.5);
    expect(RULEBOOK.crossSectorMultiplier).toBe(1.25);
    expect(RULEBOOK.terraformOwner).toBe(100);
    expect(RULEBOOK.terraformExpedition).toBe(50);
    expect(RULEBOOK.terraformCloser).toBe(25);
    expect(RULEBOOK.streakStep).toBe(0.1);
    expect(RULEBOOK.streakCap).toBe(0.5);
    expect(RULEBOOK.crossTeamMultiplier).toBe(1.5);
    expect(RULEBOOK.nightShiftMultiplier).toBe(1.5);
    expect(RULEBOOK.rescue).toBe(20);
    expect(RULEBOOK.trancheMinutes).toBe(240);
    expect(RULEBOOK.distressAfterWorkingMinutes).toBe(480);
    expect(RULEBOOK.lostAfterWorkingMinutes).toBe(10 * 9 * 60);
    expect(RULEBOOK.aftershockWindowDays).toBe(14);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `pnpm install && pnpm test`
Expected: FAIL, `Cannot find module './rulebook.mjs'`

- [ ] **Step 6: Write the rulebook**

```js
// game/rulebook.mjs
// Every number the economy uses that is not a fact of the delivery layer (spec §6).
export const RULEBOOK = Object.freeze({
  zoneSecured: 10,
  woundClose: Object.freeze({
    transmission: 5, 'unconfirmed-ground': 15, beacon: 25,
    'fault-line': 20, 'under-fire': 10, aftershock: 20,
  }),
  decayPerTranche: Object.freeze({
    transmission: 1, 'unconfirmed-ground': 3, beacon: 5,
    'fault-line': 3, 'under-fire': 3, aftershock: 5,
  }),
  classMultiplier: (regions) => regions >= 4 ? 2.5 : regions === 3 ? 2 : regions === 2 ? 1.5 : 1,
  crossSectorMultiplier: 1.25,
  terraformOwner: 100,
  terraformExpedition: 50,
  terraformCloser: 25,
  streakStep: 0.1,
  streakCap: 0.5,
  crossTeamMultiplier: 1.5,
  nightShiftMultiplier: 1.5,
  rescue: 20,
  trancheMinutes: 240,
  distressAfterWorkingMinutes: 480,      // 8 working hours
  lostAfterWorkingMinutes: 10 * 9 * 60,  // 10 working days
  aftershockWindowDays: 14,
  threatWeights: Object.freeze({
    transmission: 1, 'unconfirmed-ground': 3, beacon: 5,
    'fault-line': 3, 'under-fire': 2, aftershock: 5, distress: 4,
  }),
  threatBands: Object.freeze([0, 3, 8, 15, 25]), // score ≥ band[i] → threat i+1 (I..V)
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS (1 test)

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.mjs .gitignore projects.yml game/rulebook.mjs game/rulebook.test.mjs
git commit -m "chore(game): scaffold the package and the rulebook"
```

---

### Task 2: Working calendar

**Files:**
- Create: `game/calendar.mjs`, `game/calendar.test.mjs`

**Interfaces:**
- Produces: `isWorkingTime(date: Date): boolean`, `workingMinutesBetween(from: Date, to: Date): number`, `addWorkingMinutes(from: Date, minutes: number): Date`, `tranchesBetween(from: Date, to: Date, trancheMinutes: number): number`. All step on a 15-minute grid from `from`; every timestamp the projector emits is taken from GitHub, minute precision, so the grid error is at most 14 minutes and never crosses a tranche boundary in tests.

- [ ] **Step 1: Write the failing tests**

```js
// game/calendar.test.mjs
import { describe, it, expect } from 'vitest';
import { isWorkingTime, workingMinutesBetween, addWorkingMinutes, tranchesBetween } from './calendar.mjs';

// September 2026: Brussels is CEST, UTC+2. Wed 2026-09-23.
const d = (s) => new Date(s);

describe('calendar', () => {
  it('knows a Wednesday noon is working time and a Saturday is not', () => {
    expect(isWorkingTime(d('2026-09-23T10:00:00Z'))).toBe(true);   // 12:00 local
    expect(isWorkingTime(d('2026-09-26T10:00:00Z'))).toBe(false);  // Saturday
    expect(isWorkingTime(d('2026-09-23T06:59:00Z'))).toBe(false);  // 08:59 local
    expect(isWorkingTime(d('2026-09-23T07:00:00Z'))).toBe(true);   // 09:00 local
    expect(isWorkingTime(d('2026-09-23T16:00:00Z'))).toBe(false);  // 18:00 local
  });

  it('counts working minutes across a night', () => {
    // Wed 12:00 → Thu 12:00 local: 6h + 3h
    expect(workingMinutesBetween(d('2026-09-23T10:00:00Z'), d('2026-09-24T10:00:00Z'))).toBe(540);
  });

  it('counts a weekend as zero', () => {
    // Fri 17:00 → Mon 10:00 local: 1h + 1h
    expect(workingMinutesBetween(d('2026-09-25T15:00:00Z'), d('2026-09-28T08:00:00Z'))).toBe(120);
    expect(tranchesBetween(d('2026-09-25T15:00:00Z'), d('2026-09-28T08:00:00Z'), 240)).toBe(0);
  });

  it('returns zero when to is before from', () => {
    expect(workingMinutesBetween(d('2026-09-24T10:00:00Z'), d('2026-09-23T10:00:00Z'))).toBe(0);
  });

  it('adds working minutes across a weekend', () => {
    // Fri 17:00 local + 480 working min = Mon 16:00 local (1h Fri, 7h Mon)
    expect(addWorkingMinutes(d('2026-09-25T15:00:00Z'), 480).toISOString()).toBe('2026-09-28T14:00:00.000Z');
  });

  it('adds zero minutes as identity', () => {
    expect(addWorkingMinutes(d('2026-09-23T10:00:00Z'), 0).toISOString()).toBe('2026-09-23T10:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test game/calendar.test.mjs`
Expected: FAIL, `Cannot find module './calendar.mjs'`

- [ ] **Step 3: Implement the calendar**

```js
// game/calendar.mjs
// Working calendar: Monday–Friday, 09:00–18:00, Europe/Brussels (spec §4).
export const CALENDAR = Object.freeze({ tz: 'Europe/Brussels', startHour: 9, endHour: 18, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] });

const STEP_MS = 15 * 60 * 1000;
const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: CALENDAR.tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
});

function localParts(date) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { weekday: p.weekday, hour: Number(p.hour) % 24, minute: Number(p.minute) };
}

export function isWorkingTime(date) {
  const { weekday, hour } = localParts(date);
  return CALENDAR.days.includes(weekday) && hour >= CALENDAR.startHour && hour < CALENDAR.endHour;
}

export function workingMinutesBetween(from, to) {
  let minutes = 0;
  for (let t = from.getTime(); t < to.getTime(); t += STEP_MS) {
    if (isWorkingTime(new Date(t))) minutes += 15;
  }
  return minutes;
}

export function addWorkingMinutes(from, minutes) {
  let t = from.getTime();
  let left = minutes;
  while (left > 0) {
    if (isWorkingTime(new Date(t))) left -= 15;
    t += STEP_MS;
  }
  return new Date(t);
}

export function tranchesBetween(from, to, trancheMinutes) {
  return Math.floor(workingMinutesBetween(from, to) / trancheMinutes);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test game/calendar.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add game/calendar.mjs game/calendar.test.mjs
git commit -m "feat(game): the working calendar"
```

---

### Task 3: Events and the ledger

**Files:**
- Create: `game/events.mjs`, `game/events.test.mjs`, `game/ledger.mjs`, `game/ledger.test.mjs`

**Interfaces:**
- Produces:
  - `EVENT_TYPES` (array), `WOUND_KINDS` (array), `EventSchema` (zod), `eventId(source, identity, state): string`, `makeEvent(fields): Event` (validates).
  - `Event = { id, at (ISO string), type, planet (number), region?: string, contributor?: string, team?: string, data: object }`.
  - `readLedger(dir): Event[]` sorted by `at` then `id`; `appendEvents(dir, events): Event[]` writes unknown ids to `<dir>/<yyyy-mm>.jsonl` by the event's `at` month and returns what it appended.

- [ ] **Step 1: Write the failing events test**

```js
// game/events.test.mjs
import { describe, it, expect } from 'vitest';
import { EVENT_TYPES, WOUND_KINDS, eventId, makeEvent } from './events.mjs';

describe('events', () => {
  it('builds a deterministic id', () => {
    expect(eventId('pr', 'vertuo-ai-domain#1042', 'merged')).toBe('pr:vertuo-ai-domain#1042:merged');
  });

  it('names every type and wound kind the spec lists', () => {
    expect(EVENT_TYPES).toEqual([
      'PLANET_CHARTED', 'REGION_SURVEYED', 'PLANET_LOCKED', 'PLANET_UNLOCKED',
      'ZONE_OPENED', 'ZONE_CLAIMED', 'ZONE_SECURED', 'ZONE_REVERTED',
      'WOUND_OPENED', 'WOUND_CLOSED', 'DISTRESS', 'RESCUE',
      'PLANET_READY', 'PLANET_TERRAFORMED', 'PLANET_LOST', 'PLANET_DECOMMISSIONED',
    ]);
    expect(WOUND_KINDS).toEqual(['transmission', 'unconfirmed-ground', 'beacon', 'fault-line', 'under-fire', 'aftershock']);
  });

  it('validates an event and defaults data', () => {
    const e = makeEvent({ id: 'planet:2332:charted', at: '2026-09-01T08:00:00Z', type: 'PLANET_CHARTED', planet: 2332 });
    expect(e.data).toEqual({});
  });

  it('refuses an unknown type', () => {
    expect(() => makeEvent({ id: 'x', at: '2026-09-01T08:00:00Z', type: 'NOPE', planet: 1 })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test game/events.test.mjs`
Expected: FAIL, module not found

- [ ] **Step 3: Implement events.mjs**

```js
// game/events.mjs
import { z } from 'zod';

export const EVENT_TYPES = Object.freeze([
  'PLANET_CHARTED', 'REGION_SURVEYED', 'PLANET_LOCKED', 'PLANET_UNLOCKED',
  'ZONE_OPENED', 'ZONE_CLAIMED', 'ZONE_SECURED', 'ZONE_REVERTED',
  'WOUND_OPENED', 'WOUND_CLOSED', 'DISTRESS', 'RESCUE',
  'PLANET_READY', 'PLANET_TERRAFORMED', 'PLANET_LOST', 'PLANET_DECOMMISSIONED',
]);

export const WOUND_KINDS = Object.freeze(['transmission', 'unconfirmed-ground', 'beacon', 'fault-line', 'under-fire', 'aftershock']);

export const EventSchema = z.object({
  id: z.string().min(1),
  at: z.string().datetime({ offset: true }),
  type: z.enum(EVENT_TYPES),
  planet: z.number().int().positive(),
  region: z.string().optional(),
  contributor: z.string().optional(),
  team: z.string().optional(),
  data: z.record(z.unknown()).default({}),
}).strict();

export function eventId(source, identity, state) {
  return `${source}:${identity}:${state}`;
}

export function makeEvent(fields) {
  return EventSchema.parse(fields);
}
```

- [ ] **Step 4: Run to verify pass, then write the failing ledger test**

Run: `pnpm test game/events.test.mjs` → PASS (4 tests)

```js
// game/ledger.test.mjs
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLedger, appendEvents } from './ledger.mjs';

const ev = (id, at, type = 'ZONE_SECURED') => ({ id, at, type, planet: 2332, data: {} });

describe('ledger', () => {
  it('appends only unknown ids, one file per month, and reads back sorted', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
    const first = appendEvents(dir, [ev('b', '2026-09-02T10:00:00Z'), ev('a', '2026-09-01T10:00:00Z')]);
    expect(first.map((e) => e.id)).toEqual(['b', 'a']);
    const second = appendEvents(dir, [ev('a', '2026-09-01T10:00:00Z'), ev('c', '2026-10-01T10:00:00Z')]);
    expect(second.map((e) => e.id)).toEqual(['c']);
    expect(existsSync(join(dir, '2026-09.jsonl'))).toBe(true);
    expect(existsSync(join(dir, '2026-10.jsonl'))).toBe(true);
    expect(readFileSync(join(dir, '2026-09.jsonl'), 'utf8').trim().split('\n')).toHaveLength(2);
    expect(readLedger(dir).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('reads an empty or missing directory as no events', () => {
    expect(readLedger(join(tmpdir(), 'does-not-exist-' + Date.now()))).toEqual([]);
  });

  it('refuses a malformed event instead of writing it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
    expect(() => appendEvents(dir, [{ id: 'x', at: 'nope', type: 'ZONE_SECURED', planet: 1 }])).toThrow();
    expect(readLedger(dir)).toEqual([]);
  });
});
```

- [ ] **Step 5: Run to verify failure**

Run: `pnpm test game/ledger.test.mjs`
Expected: FAIL, module not found

- [ ] **Step 6: Implement ledger.mjs**

```js
// game/ledger.mjs
// Append-only event log, one JSONL file per month, committed to git (spec §7.2).
import { existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeEvent } from './events.mjs';

const monthOf = (iso) => iso.slice(0, 7);

export function readLedger(dir) {
  if (!existsSync(dir)) return [];
  const events = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
    for (const line of readFileSync(join(dir, file), 'utf8').split('\n')) {
      if (line.trim()) events.push(makeEvent(JSON.parse(line)));
    }
  }
  return events.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

export function appendEvents(dir, events) {
  const valid = events.map(makeEvent); // throws before anything is written
  mkdirSync(dir, { recursive: true });
  const known = new Set(readLedger(dir).map((e) => e.id));
  const appended = [];
  for (const e of valid) {
    if (known.has(e.id)) continue;
    appendFileSync(join(dir, `${monthOf(e.at)}.jsonl`), JSON.stringify(e) + '\n');
    known.add(e.id);
    appended.push(e);
  }
  return appended;
}
```

- [ ] **Step 7: Run all tests**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add game/events.mjs game/events.test.mjs game/ledger.mjs game/ledger.test.mjs
git commit -m "feat(game): events with deterministic ids, and an append-only ledger"
```

---

### Task 4: Config and planet state

**Files:**
- Create: `game/config.mjs`, `game/config.test.mjs`, `game/planet-state.mjs`, `game/planet-state.test.mjs`

**Interfaces:**
- Produces:
  - `loadProjects(path): Config` and `parseProjects(yamlText): Config` where `Config = { sectors: {name: {repos}}, teams: {name: {home}}, repos: string[], sectorOf(repo): string|null, homeOf(team): string|null }`.
  - The **snapshot planet** shape (input, produced by Task 7):
    ```
    SnapshotPlanet = {
      prd: number, title: string, captain: string|null, ownerTeam: string|null,
      issue: { createdAt, closedAt: string|null },
      regions: [{ repo, blockedBy: number[], surveyedAt }],
      featurePr: null | { repo, number, createdAt, readyAt: string|null, mergedAt: string|null, lastActivityAt },
      zones: [{ id, repo, wave: number, blockedBy: string[], pr: null | { number, author, createdAt, labels: string[], mergedAt: string|null, revertedAt: string|null } }],
      outbox: [{ id, repo, rank: 'medium'|'high'|'human-action', raisedAt, settled: null | { verdict: 'agreed'|'drifted', at, by, reworkMergedAt: string|null } }],
      bugs: [{ repo, number, createdAt, closedAt: string|null, closedBy: string|null }],
    }
    ```
    A `terraformedPlanets: Set<number>` (PRDs whose feature PR is merged) is passed alongside for `blocked-by`.
  - `derivePlanet(planet, { config, terraformedPlanets, now }): PlanetState` with
    ```
    PlanetState = {
      prd, title, captain, ownerTeam, state, regions: string[], class: number, crossSector: boolean,
      zones: [{ id, repo, wave, state: 'open'|'sealed'|'claimed'|'under-fire'|'secured', openedAt: string|null, claimedAt, securedAt, revertedAt, author }],
      wounds: [{ id, kind, rank?: string, repo, openedAt, closedAt: string|null, closedBy: string|null, verdict?: string }],
      distressSince: string|null, lastActivityAt: string, threat: 1|2|3|4|5,
    }
    ```
    `state` ∈ `charted | locked | terraforming | distress | awaiting-command | terraformed | aftershock | lost | decommissioned`.
  - `WOUND_KIND_BY_RANK = { medium: 'transmission', high: 'unconfirmed-ground', 'human-action': 'beacon' }`.

- [ ] **Step 1: Write the failing config test**

```js
// game/config.test.mjs
import { describe, it, expect } from 'vitest';
import { parseProjects } from './config.mjs';

const text = `
sectors:
  ai: { repos: [vertuo-ai-domain, vertuo-mcp] }
  core: { repos: [vertuo-core] }
teams:
  beaver: { home: core }
  octopod: { home: ai }
`;

describe('config', () => {
  it('parses sectors and teams and answers lookups', () => {
    const c = parseProjects(text);
    expect(c.repos).toEqual(['vertuo-ai-domain', 'vertuo-mcp', 'vertuo-core']);
    expect(c.sectorOf('vertuo-mcp')).toBe('ai');
    expect(c.sectorOf('unknown')).toBeNull();
    expect(c.homeOf('beaver')).toBe('core');
    expect(c.homeOf('nobody')).toBeNull();
  });

  it('refuses a team whose home is not a sector', () => {
    expect(() => parseProjects('sectors: {}\nteams:\n  beaver: { home: nowhere }\n')).toThrow(/home/);
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement config.mjs**

Run: `pnpm test game/config.test.mjs` → FAIL, module not found

```js
// game/config.mjs
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';

const Schema = z.object({
  sectors: z.record(z.object({ repos: z.array(z.string().min(1)) })),
  teams: z.record(z.object({ home: z.string().min(1) })),
});

export function parseProjects(text) {
  const raw = Schema.parse(parse(text));
  for (const [team, { home }] of Object.entries(raw.teams)) {
    if (!raw.sectors[home]) throw new Error(`team ${team}: home sector "${home}" is not a sector`);
  }
  const repoSector = new Map();
  for (const [name, { repos }] of Object.entries(raw.sectors)) for (const r of repos) repoSector.set(r, name);
  return {
    sectors: raw.sectors,
    teams: raw.teams,
    repos: [...repoSector.keys()],
    sectorOf: (repo) => repoSector.get(repo) ?? null,
    homeOf: (team) => raw.teams[team]?.home ?? null,
  };
}

export function loadProjects(path = 'projects.yml') {
  return parseProjects(readFileSync(path, 'utf8'));
}
```

Run: `pnpm test game/config.test.mjs` → PASS (2 tests)

- [ ] **Step 3: Write the failing planet-state tests**

```js
// game/planet-state.test.mjs
import { describe, it, expect } from 'vitest';
import { parseProjects } from './config.mjs';
import { derivePlanet } from './planet-state.mjs';

const config = parseProjects(`
sectors:
  ai: { repos: [ai-repo] }
  core: { repos: [core-repo] }
teams:
  beaver: { home: core }
  octopod: { home: ai }
`);

// Wed 2026-09-23. Brussels = UTC+2.
const NOW = new Date('2026-09-23T14:00:00Z');
const ctx = (terraformed = []) => ({ config, terraformedPlanets: new Set(terraformed), now: NOW });

function planet(over = {}) {
  return {
    prd: 2332, title: 'Generic Import Engine', captain: 'pm', ownerTeam: 'beaver',
    issue: { createdAt: '2026-09-01T08:00:00Z', closedAt: null },
    regions: [{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z' }],
    featurePr: { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' },
    zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
    ],
    outbox: [], bugs: [],
    ...over,
  };
}

describe('derivePlanet', () => {
  it('is charted with no feature PR, and unsurveyed with no regions', () => {
    const p = derivePlanet(planet({ featurePr: null, regions: [], zones: [] }), ctx());
    expect(p.state).toBe('charted');
    expect(p.class).toBe(0);
  });

  it('is locked while a blocked-by planet is not terraformed', () => {
    const p = derivePlanet(planet({ regions: [{ repo: 'core-repo', blockedBy: [2300], surveyedAt: '2026-09-02T08:00:00Z' }] }), ctx());
    expect(p.state).toBe('locked');
    expect(derivePlanet(planet({ regions: [{ repo: 'core-repo', blockedBy: [2300], surveyedAt: '2026-09-02T08:00:00Z' }] }), ctx([2300])).state).toBe('terraforming');
  });

  it('derives zone states from blockers and labels', () => {
    const p = derivePlanet(planet(), ctx());
    expect(p.zones.map((z) => [z.id, z.state])).toEqual([['s1', 'secured'], ['s2', 'open']]);
    expect(p.zones[1].openedAt).toBe('2026-09-21T12:00:00Z'); // when s1 merged
    const sealed = derivePlanet(planet({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: null },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
    ] }), ctx());
    expect(sealed.zones.map((z) => z.state)).toEqual(['open', 'sealed']);
    expect(sealed.zones[0].openedAt).toBe('2026-09-21T08:00:00Z'); // feature PR created
  });

  it('marks a claimed zone, and an under-fire zone as a wound', () => {
    const p = derivePlanet(planet({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-22T09:00:00Z', labels: ['pr:sub', 'pr:in-progress'], mergedAt: null, revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 502, author: 'bob', createdAt: '2026-09-22T09:00:00Z', labels: ['pr:sub', 'pr:needs-fix'], mergedAt: null, revertedAt: null } },
    ] }), ctx());
    expect(p.zones.map((z) => z.state)).toEqual(['claimed', 'under-fire']);
    expect(p.wounds).toEqual([{ id: 'zone:core-repo:2332:s2', kind: 'under-fire', repo: 'core-repo', openedAt: '2026-09-22T09:00:00Z', closedAt: null, closedBy: null }]);
  });

  it('turns outbox items into wounds by rank, a drifted settle into a fault line', () => {
    const p = derivePlanet(planet({ outbox: [
      { id: 's1-01-a', repo: 'core-repo', rank: 'medium', raisedAt: '2026-09-21T10:00:00Z', settled: null },
      { id: 's1-02-b', repo: 'core-repo', rank: 'human-action', raisedAt: '2026-09-21T10:00:00Z', settled: { verdict: 'agreed', at: '2026-09-22T10:00:00Z', by: 'pm', reworkMergedAt: null } },
      { id: 's1-03-c', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: { verdict: 'drifted', at: '2026-09-22T11:00:00Z', by: 'pm', reworkMergedAt: null } },
    ] }), ctx());
    expect(p.wounds).toEqual([
      { id: 'outbox:core-repo:2332/s1-01-a', kind: 'transmission', rank: 'medium', repo: 'core-repo', openedAt: '2026-09-21T10:00:00Z', closedAt: null, closedBy: null },
      { id: 'outbox:core-repo:2332/s1-02-b', kind: 'beacon', rank: 'human-action', repo: 'core-repo', openedAt: '2026-09-21T10:00:00Z', closedAt: '2026-09-22T10:00:00Z', closedBy: 'pm', verdict: 'agreed' },
      { id: 'outbox:core-repo:2332/s1-03-c', kind: 'unconfirmed-ground', rank: 'high', repo: 'core-repo', openedAt: '2026-09-21T10:00:00Z', closedAt: '2026-09-22T11:00:00Z', closedBy: 'pm', verdict: 'drifted' },
      { id: 'fault:core-repo:2332/s1-03-c', kind: 'fault-line', repo: 'core-repo', openedAt: '2026-09-22T11:00:00Z', closedAt: null, closedBy: null },
    ]);
  });

  it('is in distress after 8 idle working hours on an open zone', () => {
    // s2 opened Mon 2026-09-21 12:00Z (14:00 local); 8 working hours later = Tue 13:00 local = 11:00Z
    const p = derivePlanet(planet(), ctx());
    expect(p.state).toBe('distress');
    expect(p.distressSince).toBe('2026-09-22T11:00:00Z');
    const early = derivePlanet(planet(), { ...ctx(), now: new Date('2026-09-22T10:00:00Z') });
    expect(early.state).toBe('terraforming');
  });

  it('awaits command when every zone is secured and the PR is ready', () => {
    const p = derivePlanet(planet({
      featurePr: { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: '2026-09-22T08:00:00Z', mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' },
      zones: [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } }],
    }), ctx());
    expect(p.state).toBe('awaiting-command');
  });

  it('is terraformed when the feature PR merged, aftershock with a bug inside 14 days', () => {
    const merged = { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: '2026-09-22T08:00:00Z', mergedAt: '2026-09-22T12:00:00Z', lastActivityAt: '2026-09-22T12:00:00Z' };
    expect(derivePlanet(planet({ featurePr: merged }), ctx()).state).toBe('terraformed');
    const shaken = derivePlanet(planet({ featurePr: merged, bugs: [{ repo: 'core-repo', number: 600, createdAt: '2026-09-23T09:00:00Z', closedAt: null, closedBy: null }] }), ctx());
    expect(shaken.state).toBe('aftershock');
    expect(shaken.wounds).toEqual([{ id: 'bug:core-repo#600', kind: 'aftershock', repo: 'core-repo', openedAt: '2026-09-23T09:00:00Z', closedAt: null, closedBy: null }]);
    const late = derivePlanet(planet({ featurePr: merged, bugs: [{ repo: 'core-repo', number: 601, createdAt: '2026-10-20T09:00:00Z', closedAt: null, closedBy: null }] }), { ...ctx(), now: new Date('2026-10-21T09:00:00Z') });
    expect(late.state).toBe('terraformed');
    expect(late.wounds).toEqual([]);
  });

  it('is lost when closed after a claim and unmerged, decommissioned when closed before any claim', () => {
    const closed = { createdAt: '2026-09-01T08:00:00Z', closedAt: '2026-09-23T10:00:00Z' };
    expect(derivePlanet(planet({ issue: closed }), ctx()).state).toBe('lost');
    expect(derivePlanet(planet({ issue: closed, zones: [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: null }] }), ctx()).state).toBe('decommissioned');
  });

  it('is lost after 10 working days of silence', () => {
    const p = derivePlanet(planet(), { ...ctx(), now: new Date('2026-10-20T10:00:00Z') });
    expect(p.state).toBe('lost');
  });

  it('computes class and cross-sector from regions', () => {
    const p = derivePlanet(planet({ regions: [
      { repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z' },
      { repo: 'ai-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z' },
    ] }), ctx());
    expect(p.class).toBe(2);
    expect(p.crossSector).toBe(true);
  });

  it('rates threat from open wounds', () => {
    expect(derivePlanet(planet({ zones: [] }), ctx()).threat).toBe(1);
    const p = derivePlanet(planet({ outbox: [
      { id: 'a', repo: 'core-repo', rank: 'human-action', raisedAt: '2026-09-21T10:00:00Z', settled: null },
      { id: 'b', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: null },
    ] }), ctx());
    expect(p.threat).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `pnpm test game/planet-state.test.mjs`
Expected: FAIL, module not found

- [ ] **Step 5: Implement planet-state.mjs**

```js
// game/planet-state.mjs
// A snapshot planet → derived state. Nothing here is stored; it is recomputed every time (spec §5).
import { RULEBOOK } from './rulebook.mjs';
import { addWorkingMinutes, tranchesBetween } from './calendar.mjs';

export const WOUND_KIND_BY_RANK = Object.freeze({ medium: 'transmission', high: 'unconfirmed-ground', 'human-action': 'beacon' });

const iso = (d) => d.toISOString().replace('.000Z', 'Z');
const maxIso = (...xs) => xs.filter(Boolean).sort().at(-1) ?? null;

export function deriveZones(planet) {
  const byId = new Map(planet.zones.map((z) => [z.id, z]));
  return planet.zones.map((z) => {
    const blockers = z.blockedBy.map((id) => byId.get(id)).filter(Boolean);
    const allMerged = blockers.every((b) => b.pr?.mergedAt);
    const openedAt = allMerged && planet.featurePr
      ? maxIso(planet.featurePr.createdAt, ...blockers.map((b) => b.pr.mergedAt))
      : null;
    let state = 'sealed';
    if (z.pr?.mergedAt && !z.pr.revertedAt) state = 'secured';
    else if (z.pr?.labels.includes('pr:needs-fix')) state = 'under-fire';
    else if (z.pr && !z.pr.mergedAt) state = 'claimed';
    else if (allMerged && planet.featurePr) state = 'open';
    return {
      id: z.id, repo: z.repo, wave: z.wave, state, openedAt,
      claimedAt: z.pr?.createdAt ?? null, securedAt: z.pr?.mergedAt ?? null,
      revertedAt: z.pr?.revertedAt ?? null, author: z.pr?.author ?? null,
    };
  });
}

export function deriveWounds(planet, now) {
  const wounds = [];
  for (const z of planet.zones) {
    if (z.pr?.labels.includes('pr:needs-fix')) {
      wounds.push({ id: `zone:${z.repo}:${planet.prd}:${z.id}`, kind: 'under-fire', repo: z.repo, openedAt: z.pr.createdAt, closedAt: z.pr.mergedAt ?? null, closedBy: z.pr.mergedAt ? z.pr.author : null });
    }
  }
  for (const item of planet.outbox) {
    const base = { id: `outbox:${item.repo}:${planet.prd}/${item.id}`, kind: WOUND_KIND_BY_RANK[item.rank], rank: item.rank, repo: item.repo, openedAt: item.raisedAt };
    if (!item.settled) wounds.push({ ...base, closedAt: null, closedBy: null });
    else {
      wounds.push({ ...base, closedAt: item.settled.at, closedBy: item.settled.by, verdict: item.settled.verdict });
      if (item.settled.verdict === 'drifted') {
        wounds.push({ id: `fault:${item.repo}:${planet.prd}/${item.id}`, kind: 'fault-line', repo: item.repo, openedAt: item.settled.at, closedAt: item.settled.reworkMergedAt ?? null, closedBy: null });
      }
    }
  }
  const mergedAt = planet.featurePr?.mergedAt;
  if (mergedAt) {
    const windowEnd = new Date(new Date(mergedAt).getTime() + RULEBOOK.aftershockWindowDays * 86400000);
    for (const b of planet.bugs) {
      if (new Date(b.createdAt) >= new Date(mergedAt) && new Date(b.createdAt) <= windowEnd) {
        wounds.push({ id: `bug:${b.repo}#${b.number}`, kind: 'aftershock', repo: b.repo, openedAt: b.createdAt, closedAt: b.closedAt, closedBy: b.closedBy });
      }
    }
  }
  return wounds;
}

function distressSince(zones, now) {
  const times = zones
    .filter((z) => z.state === 'open' && z.openedAt)
    .map((z) => addWorkingMinutes(new Date(z.openedAt), RULEBOOK.distressAfterWorkingMinutes))
    .filter((t) => t <= now);
  return times.length ? iso(new Date(Math.min(...times.map((t) => t.getTime())))) : null;
}

function lastActivity(planet) {
  return maxIso(
    planet.issue.createdAt, planet.featurePr?.createdAt, planet.featurePr?.lastActivityAt, planet.featurePr?.mergedAt,
    ...planet.zones.flatMap((z) => [z.pr?.createdAt, z.pr?.mergedAt]),
    ...planet.outbox.flatMap((i) => [i.raisedAt, i.settled?.at, i.settled?.reworkMergedAt]),
    ...planet.regions.map((r) => r.surveyedAt),
  );
}

function threatOf(wounds, inDistress, now) {
  let score = inDistress ? RULEBOOK.threatWeights.distress : 0;
  for (const w of wounds.filter((w) => !w.closedAt)) {
    const age = tranchesBetween(new Date(w.openedAt), now, RULEBOOK.trancheMinutes);
    score += RULEBOOK.threatWeights[w.kind] * (1 + age / 6);
  }
  let level = 1;
  RULEBOOK.threatBands.forEach((band, i) => { if (score >= band) level = i + 1; });
  return level;
}

export function derivePlanet(planet, { config, terraformedPlanets, now }) {
  const zones = deriveZones(planet);
  const wounds = deriveWounds(planet, now);
  const regions = planet.regions.map((r) => r.repo);
  const sectors = new Set(regions.map((r) => config.sectorOf(r)));
  const anyClaimed = planet.zones.some((z) => z.pr);
  const merged = Boolean(planet.featurePr?.mergedAt);
  const last = lastActivity(planet);
  const silentLost = !merged && anyClaimed && addWorkingMinutes(new Date(last), RULEBOOK.lostAfterWorkingMinutes) <= now;
  const distress = distressSince(zones, now);
  const blocked = planet.regions.some((r) => r.blockedBy.some((prd) => !terraformedPlanets.has(prd)));

  let state;
  if (planet.issue.closedAt && !merged) state = anyClaimed ? 'lost' : 'decommissioned';
  else if (silentLost) state = 'lost';
  else if (merged) state = wounds.some((w) => w.kind === 'aftershock' && !w.closedAt) ? 'aftershock' : 'terraformed';
  else if (!planet.featurePr) state = blocked ? 'locked' : 'charted';
  else if (blocked) state = 'locked';
  else if (zones.length && zones.every((z) => z.state === 'secured') && planet.featurePr.readyAt) state = 'awaiting-command';
  else if (distress) state = 'distress';
  else state = 'terraforming';

  return {
    prd: planet.prd, title: planet.title, captain: planet.captain, ownerTeam: planet.ownerTeam,
    state, regions, class: regions.length, crossSector: sectors.size > 1,
    zones, wounds, distressSince: distress, lastActivityAt: last,
    threat: threatOf(wounds, state === 'distress', now),
  };
}
```

- [ ] **Step 6: Run to verify pass**

Run: `pnpm test game/planet-state.test.mjs`
Expected: PASS (12 tests). If the distress timestamp is off by 15 minutes, check the zone's `openedAt` falls on the 15-minute grid in the fixture (it does: 12:00Z).

- [ ] **Step 7: Commit**

```bash
git add game/config.mjs game/config.test.mjs game/planet-state.mjs game/planet-state.test.mjs
git commit -m "feat(game): projects config, and a planet's state derived from its snapshot"
```

---

### Task 5: Projector

**Files:**
- Create: `game/projector.mjs`, `game/projector.test.mjs`

**Interfaces:**
- Consumes: `derivePlanet`, `deriveZones`, `deriveWounds` (Task 4); `eventId`, `makeEvent` (Task 3); `addWorkingMinutes` (Task 2).
- Produces: `projectEvents(snapshot, { config, now }): Event[]` where `snapshot = { at, teams: {login: team}, planets: SnapshotPlanet[] }`. Emits the **full** set of events the snapshot implies; the ledger's `appendEvents` drops the known ones. Event `team` is the contributor's team from `snapshot.teams`. Planet-level events carry `data.ownerTeam`, `data.captain`.

Event catalogue (id → when → fields):

| type | id | at | contributor | data |
|---|---|---|---|---|
| PLANET_CHARTED | `planet:<prd>:charted` | issue.createdAt | — | `{ captain, ownerTeam, title }` |
| REGION_SURVEYED | `region:<repo>:<prd>:surveyed` | region.surveyedAt | — | `{}` + `region` |
| ZONE_OPENED | `zone:<repo>:<prd>:<id>:opened` | zone.openedAt | — | `{ wave }` |
| ZONE_CLAIMED | `zone:<repo>:<prd>:<id>:claimed` | pr.createdAt | pr.author | `{ pr }` |
| ZONE_SECURED | `zone:<repo>:<prd>:<id>:secured` | pr.mergedAt | pr.author | `{ pr }` |
| ZONE_REVERTED | `zone:<repo>:<prd>:<id>:reverted` | pr.revertedAt | pr.author | `{ pr }` |
| WOUND_OPENED | `<wound.id>:opened` | wound.openedAt | — | `{ kind, rank? }` |
| WOUND_CLOSED | `<wound.id>:closed` | wound.closedAt | wound.closedBy | `{ kind, rank?, verdict? }` |
| DISTRESS | `zone:<repo>:<prd>:<id>:distress` | openedAt + 8 working h, if ≤ now and (no claim or claim after that) | — | `{}` |
| RESCUE | `zone:<repo>:<prd>:<id>:rescue` | pr.createdAt when a DISTRESS preceded it | pr.author | `{ pr }` |
| PLANET_READY | `planet:<prd>:ready` | featurePr.readyAt, when all zones secured | — | `{}` |
| PLANET_TERRAFORMED | `planet:<prd>:terraformed` | featurePr.mergedAt | — | `{ ownerTeam, class, crossSector }` |
| PLANET_LOST | `planet:<prd>:lost` | issue.closedAt, or lastActivity + 10 working days | — | `{ ownerTeam, reason: 'closed'\|'silence' }` |
| PLANET_DECOMMISSIONED | `planet:<prd>:decommissioned` | issue.closedAt | — | `{}` |
| PLANET_LOCKED / PLANET_UNLOCKED | `planet:<prd>:locked:<blocker>` / `...:unlocked:<blocker>` | region.surveyedAt / blocker's terraform time | — | `{ blocker }` |

- [ ] **Step 1: Write the failing tests**

```js
// game/projector.test.mjs
import { describe, it, expect } from 'vitest';
import { parseProjects } from './config.mjs';
import { projectEvents } from './projector.mjs';

const config = parseProjects(`
sectors:
  core: { repos: [core-repo] }
teams:
  beaver: { home: core }
  octopod: { home: core }
`);
const NOW = new Date('2026-09-23T14:00:00Z');

function snapshot(planetOver = {}) {
  return {
    at: NOW.toISOString(),
    teams: { alice: 'octopod', pm: 'beaver' },
    planets: [{
      prd: 2332, title: 'Generic Import Engine', captain: 'pm', ownerTeam: 'beaver',
      issue: { createdAt: '2026-09-01T08:00:00Z', closedAt: null },
      regions: [{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z' }],
      featurePr: { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' },
      zones: [
        { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
        { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
      ],
      outbox: [{ id: 's1-01-a', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: { verdict: 'agreed', at: '2026-09-22T10:00:00Z', by: 'pm', reworkMergedAt: null } }],
      bugs: [],
      ...planetOver,
    }],
  };
}

const ids = (events) => events.map((e) => e.id).sort();

describe('projectEvents', () => {
  it('emits the planet, region, zone and wound history with teams attached', () => {
    const events = projectEvents(snapshot(), { config, now: NOW });
    expect(ids(events)).toEqual([
      'outbox:core-repo:2332/s1-01-a:closed', 'outbox:core-repo:2332/s1-01-a:opened',
      'planet:2332:charted', 'region:core-repo:2332:surveyed',
      'zone:core-repo:2332:s1:claimed', 'zone:core-repo:2332:s1:opened', 'zone:core-repo:2332:s1:secured',
      'zone:core-repo:2332:s2:distress', 'zone:core-repo:2332:s2:opened',
    ]);
    const secured = events.find((e) => e.id === 'zone:core-repo:2332:s1:secured');
    expect(secured).toMatchObject({ type: 'ZONE_SECURED', at: '2026-09-21T12:00:00Z', planet: 2332, region: 'core-repo', contributor: 'alice', team: 'octopod' });
    const closed = events.find((e) => e.id === 'outbox:core-repo:2332/s1-01-a:closed');
    expect(closed).toMatchObject({ type: 'WOUND_CLOSED', contributor: 'pm', team: 'beaver', data: { kind: 'unconfirmed-ground', rank: 'high', verdict: 'agreed' } });
    expect(events.find((e) => e.type === 'DISTRESS').at).toBe('2026-09-22T11:00:00Z');
  });

  it('emits a rescue when a claim follows a distress', () => {
    const events = projectEvents(snapshot({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: { number: 502, author: 'alice', createdAt: '2026-09-23T09:00:00Z', labels: ['pr:sub', 'pr:in-progress'], mergedAt: null, revertedAt: null } },
    ] }), { config, now: NOW });
    expect(events.find((e) => e.type === 'RESCUE')).toMatchObject({ id: 'zone:core-repo:2332:s2:rescue', contributor: 'alice', at: '2026-09-23T09:00:00Z' });
    expect(events.find((e) => e.type === 'DISTRESS')).toBeTruthy();
  });

  it('emits no distress when the claim came within 8 working hours', () => {
    const events = projectEvents(snapshot({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: { number: 502, author: 'alice', createdAt: '2026-09-21T13:00:00Z', labels: ['pr:sub', 'pr:in-progress'], mergedAt: null, revertedAt: null } },
    ] }), { config, now: NOW });
    expect(events.some((e) => e.type === 'DISTRESS' || e.type === 'RESCUE')).toBe(false);
  });

  it('emits ready, terraformed, lost and decommissioned at the right times', () => {
    const merged = { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: '2026-09-22T08:00:00Z', mergedAt: '2026-09-22T12:00:00Z', lastActivityAt: '2026-09-22T12:00:00Z' };
    const oneZone = [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } }];
    const done = projectEvents(snapshot({ featurePr: merged, zones: oneZone }), { config, now: NOW });
    expect(done.find((e) => e.type === 'PLANET_READY')).toMatchObject({ at: '2026-09-22T08:00:00Z' });
    expect(done.find((e) => e.type === 'PLANET_TERRAFORMED')).toMatchObject({ at: '2026-09-22T12:00:00Z', data: { ownerTeam: 'beaver', class: 1, crossSector: false } });

    const closed = projectEvents(snapshot({ issue: { createdAt: '2026-09-01T08:00:00Z', closedAt: '2026-09-23T10:00:00Z' } }), { config, now: NOW });
    expect(closed.find((e) => e.type === 'PLANET_LOST')).toMatchObject({ at: '2026-09-23T10:00:00Z', data: { reason: 'closed' } });

    const silent = projectEvents(snapshot(), { config, now: new Date('2026-10-20T10:00:00Z') });
    expect(silent.find((e) => e.type === 'PLANET_LOST')).toMatchObject({ data: { reason: 'silence' } });

    const decom = projectEvents(snapshot({ issue: { createdAt: '2026-09-01T08:00:00Z', closedAt: '2026-09-23T10:00:00Z' }, zones: [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: null }] }), { config, now: NOW });
    expect(decom.some((e) => e.type === 'PLANET_DECOMMISSIONED')).toBe(true);
    expect(decom.some((e) => e.type === 'PLANET_LOST')).toBe(false);
  });

  it('emits locked and unlocked against a blocker planet', () => {
    const s = snapshot({ regions: [{ repo: 'core-repo', blockedBy: [2300], surveyedAt: '2026-09-02T08:00:00Z' }] });
    s.planets.push({
      prd: 2300, title: 'Blocker', captain: 'pm', ownerTeam: 'beaver',
      issue: { createdAt: '2026-08-01T08:00:00Z', closedAt: '2026-09-10T08:00:00Z' },
      regions: [{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-08-02T08:00:00Z' }],
      featurePr: { repo: 'core-repo', number: 400, createdAt: '2026-08-05T08:00:00Z', readyAt: '2026-09-09T08:00:00Z', mergedAt: '2026-09-10T08:00:00Z', lastActivityAt: '2026-09-10T08:00:00Z' },
      zones: [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 401, author: 'alice', createdAt: '2026-08-06T08:00:00Z', labels: ['pr:sub'], mergedAt: '2026-08-07T08:00:00Z', revertedAt: null } }],
      outbox: [], bugs: [],
    });
    const events = projectEvents(s, { config, now: NOW });
    expect(events.find((e) => e.id === 'planet:2332:locked:2300')).toMatchObject({ at: '2026-09-02T08:00:00Z' });
    expect(events.find((e) => e.id === 'planet:2332:unlocked:2300')).toMatchObject({ at: '2026-09-10T08:00:00Z' });
  });

  it('is idempotent: the same snapshot yields the same ids and timestamps', () => {
    const a = projectEvents(snapshot(), { config, now: NOW });
    const b = projectEvents(snapshot(), { config, now: NOW });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test game/projector.test.mjs`
Expected: FAIL, module not found

- [ ] **Step 3: Implement projector.mjs**

```js
// game/projector.mjs
// A world snapshot → the full set of game events it implies. The ledger keeps the new ones (spec §7.1).
import { RULEBOOK } from './rulebook.mjs';
import { addWorkingMinutes } from './calendar.mjs';
import { makeEvent } from './events.mjs';
import { derivePlanet } from './planet-state.mjs';

const iso = (d) => d.toISOString().replace('.000Z', 'Z');

export function projectEvents(snapshot, { config, now }) {
  const terraformedAt = new Map(snapshot.planets.filter((p) => p.featurePr?.mergedAt).map((p) => [p.prd, p.featurePr.mergedAt]));
  const terraformedPlanets = new Set(terraformedAt.keys());
  const events = [];
  const teamOf = (login) => snapshot.teams[login];
  const push = (fields) => events.push(makeEvent({
    ...fields,
    ...(fields.contributor && teamOf(fields.contributor) ? { team: teamOf(fields.contributor) } : {}),
  }));

  for (const planet of snapshot.planets) {
    const prd = planet.prd;
    const state = derivePlanet(planet, { config, terraformedPlanets, now });
    push({ id: `planet:${prd}:charted`, at: planet.issue.createdAt, type: 'PLANET_CHARTED', planet: prd, data: { captain: planet.captain, ownerTeam: planet.ownerTeam, title: planet.title } });

    for (const r of planet.regions) {
      push({ id: `region:${r.repo}:${prd}:surveyed`, at: r.surveyedAt, type: 'REGION_SURVEYED', planet: prd, region: r.repo });
      for (const blocker of r.blockedBy) {
        push({ id: `planet:${prd}:locked:${blocker}`, at: r.surveyedAt, type: 'PLANET_LOCKED', planet: prd, data: { blocker } });
        if (terraformedAt.has(blocker)) push({ id: `planet:${prd}:unlocked:${blocker}`, at: terraformedAt.get(blocker), type: 'PLANET_UNLOCKED', planet: prd, data: { blocker } });
      }
    }

    for (const z of state.zones) {
      const key = `zone:${z.repo}:${prd}:${z.id}`;
      const base = { planet: prd, region: z.repo };
      if (z.openedAt) push({ id: `${key}:opened`, at: z.openedAt, type: 'ZONE_OPENED', ...base, data: { wave: z.wave } });
      if (z.claimedAt) push({ id: `${key}:claimed`, at: z.claimedAt, type: 'ZONE_CLAIMED', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id) } });
      if (z.securedAt) push({ id: `${key}:secured`, at: z.securedAt, type: 'ZONE_SECURED', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id) } });
      if (z.revertedAt) push({ id: `${key}:reverted`, at: z.revertedAt, type: 'ZONE_REVERTED', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id) } });
      if (z.openedAt) {
        const distressAt = addWorkingMinutes(new Date(z.openedAt), RULEBOOK.distressAfterWorkingMinutes);
        const claimed = z.claimedAt ? new Date(z.claimedAt) : null;
        if (distressAt <= now && (!claimed || claimed > distressAt)) {
          push({ id: `${key}:distress`, at: iso(distressAt), type: 'DISTRESS', ...base });
          if (claimed) push({ id: `${key}:rescue`, at: z.claimedAt, type: 'RESCUE', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id) } });
        }
      }
    }

    for (const w of state.wounds) {
      const data = { kind: w.kind, ...(w.rank ? { rank: w.rank } : {}) };
      push({ id: `${w.id}:opened`, at: w.openedAt, type: 'WOUND_OPENED', planet: prd, region: w.repo, data });
      if (w.closedAt) push({ id: `${w.id}:closed`, at: w.closedAt, type: 'WOUND_CLOSED', planet: prd, region: w.repo, ...(w.closedBy ? { contributor: w.closedBy } : {}), data: { ...data, ...(w.verdict ? { verdict: w.verdict } : {}) } });
    }

    const fp = planet.featurePr;
    if (fp?.readyAt && state.zones.length && state.zones.every((z) => z.state === 'secured')) push({ id: `planet:${prd}:ready`, at: fp.readyAt, type: 'PLANET_READY', planet: prd });
    if (fp?.mergedAt) push({ id: `planet:${prd}:terraformed`, at: fp.mergedAt, type: 'PLANET_TERRAFORMED', planet: prd, data: { ownerTeam: planet.ownerTeam, class: state.class, crossSector: state.crossSector } });
    if (state.state === 'lost') {
      const at = planet.issue.closedAt ?? iso(addWorkingMinutes(new Date(state.lastActivityAt), RULEBOOK.lostAfterWorkingMinutes));
      push({ id: `planet:${prd}:lost`, at, type: 'PLANET_LOST', planet: prd, data: { ownerTeam: planet.ownerTeam, reason: planet.issue.closedAt ? 'closed' : 'silence' } });
    }
    if (state.state === 'decommissioned') push({ id: `planet:${prd}:decommissioned`, at: planet.issue.closedAt, type: 'PLANET_DECOMMISSIONED', planet: prd });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

function prNumber(planet, zoneId) {
  return planet.zones.find((z) => z.id === zoneId)?.pr?.number ?? null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test game/projector.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add game/projector.mjs game/projector.test.mjs
git commit -m "feat(game): the projector, a snapshot's full event history"
```

---

### Task 6: Economy

**Files:**
- Create: `game/economy.mjs`, `game/economy.test.mjs`

**Interfaces:**
- Consumes: `RULEBOOK` (Task 1), `isWorkingTime`, `tranchesBetween` (Task 2), `Event` (Task 3).
- Produces: `score(events, { season: 'YYYY-MM', now: Date }): Season` where
  ```
  Season = {
    season, generatedAt,
    credits: [{ at, to: login|null, team: string|null, planet, points, reason, clawed: boolean }],
    individuals: { [login]: points }, teams: { [team]: points },
    planets: { [prd]: { ownerTeam, terraformed: boolean, lost: boolean, earned: points } },
    streaks: { [team]: number },
  }
  ```
  Only credits whose `at` falls in the season month count; decay is clipped to the month. `PLANET_LOST` in the season claws back every credit on that planet in the season (marks `clawed: true`, excluded from sums).

Rules implemented, each pinned by a test:
- ZONE_SECURED: `zoneSecured`, ×`nightShiftMultiplier` when `!isWorkingTime(at)`; to contributor and their team.
- ZONE_REVERTED: −(the points that zone's ZONE_SECURED earned), to the same contributor and team.
- WOUND_CLOSED: `woundClose[kind]`; 0 when `data.verdict === 'drifted'`; ×`crossTeamMultiplier` when the contributor's team differs from the planet's ownerTeam; to contributor and team.
- RESCUE: `rescue` to contributor and team.
- PLANET_TERRAFORMED: `terraformOwner × classMultiplier(class) × (crossSector ? crossSectorMultiplier : 1) × (1 + min(streakCap, streakStep × priorStreak))` to the owner team (no individual); `terraformExpedition` to each distinct ZONE_SECURED contributor on that planet (any month); `terraformCloser` to each distinct WOUND_CLOSED contributor on that planet (any month) who is not already an expedition member for it. Team credit follows each person's team.
- Decay: for each WOUND_OPENED with no matching WOUND_CLOSED before `min(now, seasonEnd)`, tranches over `[max(openedAt, seasonStart), min(closedAt ?? now, seasonEnd)]` × `decayPerTranche[kind]`, negative, to the owner team.
- Streak: per owner team, `priorStreak` = number of consecutive PLANET_TERRAFORMED events for that team since the team's last PLANET_LOST, counting across the whole ledger, before this event.

- [ ] **Step 1: Write the failing tests**

```js
// game/economy.test.mjs
import { describe, it, expect } from 'vitest';
import { score } from './economy.mjs';

const NOW = new Date('2026-09-30T16:00:00Z');
const E = (id, at, type, over = {}) => ({ id, at, type, planet: 2332, data: {}, ...over });
const charted = E('planet:2332:charted', '2026-09-01T08:00:00Z', 'PLANET_CHARTED', { data: { ownerTeam: 'beaver', captain: 'pm' } });

describe('score', () => {
  it('credits a secured zone to its author and team, night shift ×1.5', () => {
    const s = score([
      charted,
      E('z1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }), // 14:00 local, working
      E('z2:secured', '2026-09-21T20:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }), // 22:00 local, night
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({ alice: 25 });
    expect(s.teams).toEqual({ octopod: 25 });
  });

  it('takes back a reverted zone', () => {
    const s = score([
      charted,
      E('zone:r:2332:s1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
      E('zone:r:2332:s1:reverted', '2026-09-22T12:00:00Z', 'ZONE_REVERTED', { contributor: 'alice', team: 'octopod' }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({ alice: 0 });
  });

  it('pays wound closure by kind, ×1.5 cross-team, 0 for a drifted settle', () => {
    const s = score([
      charted,
      E('w1:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', { data: { kind: 'beacon', rank: 'human-action' } }),
      E('w1:closed', '2026-09-21T11:00:00Z', 'WOUND_CLOSED', { contributor: 'pm', team: 'beaver', data: { kind: 'beacon', rank: 'human-action', verdict: 'agreed' } }),
      E('w2:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', { data: { kind: 'unconfirmed-ground', rank: 'high' } }),
      E('w2:closed', '2026-09-21T11:00:00Z', 'WOUND_CLOSED', { contributor: 'eve', team: 'octopod', data: { kind: 'unconfirmed-ground', rank: 'high', verdict: 'agreed' } }),
      E('w3:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', { data: { kind: 'unconfirmed-ground', rank: 'high' } }),
      E('w3:closed', '2026-09-21T11:00:00Z', 'WOUND_CLOSED', { contributor: 'pm', team: 'beaver', data: { kind: 'unconfirmed-ground', rank: 'high', verdict: 'drifted' } }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({ pm: 25, eve: 22.5 });
    expect(s.teams).toEqual({ beaver: 25, octopod: 22.5 });
  });

  it('decays the owner team per 4 working hours, clipped to the season, and not over a weekend', () => {
    const s = score([
      charted,
      // Fri 2026-09-25 17:00 local → Mon 10:00 local: 2 working hours → 0 tranches
      E('w1:opened', '2026-09-25T15:00:00Z', 'WOUND_OPENED', { data: { kind: 'beacon', rank: 'human-action' } }),
      E('w1:closed', '2026-09-28T08:00:00Z', 'WOUND_CLOSED', { contributor: 'pm', team: 'beaver', data: { kind: 'beacon', rank: 'human-action', verdict: 'agreed' } }),
      // Mon 2026-09-21 09:00 local, still open at NOW (Wed 30th 18:00 local): 8 working days × 9h = 72h → 18 tranches × 5
      E('w2:opened', '2026-09-21T07:00:00Z', 'WOUND_OPENED', { data: { kind: 'beacon', rank: 'human-action' } }),
    ], { season: '2026-09', now: NOW });
    expect(s.teams).toEqual({ beaver: 25 - 90 });
  });

  it('pays the terraform bonus with class, cross-sector and streak, to owner, expedition and closers', () => {
    const s = score([
      charted,
      E('zone:r:2332:s1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
      E('w1:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', { data: { kind: 'transmission', rank: 'medium' } }),
      E('w1:closed', '2026-09-21T11:00:00Z', 'WOUND_CLOSED', { contributor: 'pm', team: 'beaver', data: { kind: 'transmission', rank: 'medium', verdict: 'agreed' } }),
      E('planet:2332:terraformed', '2026-09-22T12:00:00Z', 'PLANET_TERRAFORMED', { data: { ownerTeam: 'beaver', class: 2, crossSector: true } }),
    ], { season: '2026-09', now: NOW });
    // owner: 100 × 1.5 × 1.25 = 187.5 ; alice: 10 + 50 ; pm: 5 + 25
    expect(s.teams).toEqual({ beaver: 187.5 + 30, octopod: 60 });
    expect(s.individuals).toEqual({ alice: 60, pm: 30 });
    expect(s.planets[2332]).toMatchObject({ ownerTeam: 'beaver', terraformed: true, lost: false });
  });

  it('raises the streak by 10% per consecutive terraform and resets it on a loss', () => {
    const t = (prd, at) => E(`planet:${prd}:terraformed`, at, 'PLANET_TERRAFORMED', { planet: prd, data: { ownerTeam: 'beaver', class: 1, crossSector: false } });
    const c = (prd) => E(`planet:${prd}:charted`, '2026-08-01T08:00:00Z', 'PLANET_CHARTED', { planet: prd, data: { ownerTeam: 'beaver' } });
    const s = score([
      c(1), c(2), c(3), c(4),
      t(1, '2026-08-20T10:00:00Z'), // previous season, still counts for the streak
      t(2, '2026-09-10T10:00:00Z'), // prior streak 1 → 110
      E('planet:3:lost', '2026-09-15T10:00:00Z', 'PLANET_LOST', { planet: 3, data: { ownerTeam: 'beaver', reason: 'closed' } }),
      t(4, '2026-09-20T10:00:00Z'), // prior streak 0 → 100
    ], { season: '2026-09', now: NOW });
    expect(s.teams).toEqual({ beaver: 210 });
    expect(s.streaks).toEqual({ beaver: 1 });
  });

  it('claws back everything earned on a lost planet in the season', () => {
    const s = score([
      charted,
      E('zone:r:2332:s1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
      E('zone:r:2332:s2:rescue', '2026-09-22T12:00:00Z', 'RESCUE', { contributor: 'bob', team: 'cia' }),
      E('planet:2332:lost', '2026-09-25T12:00:00Z', 'PLANET_LOST', { data: { ownerTeam: 'beaver', reason: 'closed' } }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({ alice: 0, bob: 0 });
    expect(s.teams).toEqual({ octopod: 0, cia: 0 });
    expect(s.credits.filter((c) => c.clawed)).toHaveLength(2);
    expect(s.planets[2332].lost).toBe(true);
  });

  it('ignores credits outside the season month', () => {
    const s = score([
      charted,
      E('z1:secured', '2026-08-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test game/economy.test.mjs`
Expected: FAIL, module not found

- [ ] **Step 3: Implement economy.mjs**

```js
// game/economy.mjs
// Ledger events + rulebook + calendar + season → credits and rankings (spec §6). Pure.
import { RULEBOOK } from './rulebook.mjs';
import { isWorkingTime, tranchesBetween } from './calendar.mjs';

function seasonBounds(season) {
  const [y, m] = season.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function score(events, { season, now }) {
  const { start, end } = seasonBounds(season);
  const inSeason = (at) => at.slice(0, 7) === season;
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const ownerOf = new Map();
  for (const e of sorted) if (e.type === 'PLANET_CHARTED') ownerOf.set(e.planet, e.data.ownerTeam ?? null);
  const ownerFor = (e) => e.data.ownerTeam ?? ownerOf.get(e.planet) ?? null;

  const credits = [];
  const credit = (e, points, reason, to = e.contributor ?? null, team = e.team ?? null) => {
    if (points === 0 || !inSeason(e.at)) return;
    credits.push({ at: e.at, to, team, planet: e.planet, points, reason, clawed: false });
  };

  const securedPoints = new Map(); // zone key → points given
  const streak = new Map();        // team → consecutive terraforms
  const expeditions = new Map();   // planet → Set(login)
  const closers = new Map();       // planet → Set(login)
  const teamOfLogin = new Map();
  const planets = {};
  const planetOf = (prd) => (planets[prd] ??= { ownerTeam: ownerOf.get(prd) ?? null, terraformed: false, lost: false, earned: 0 });

  for (const e of sorted) {
    if (e.contributor && e.team) teamOfLogin.set(e.contributor, e.team);
    planetOf(e.planet);
    switch (e.type) {
      case 'ZONE_SECURED': {
        const points = RULEBOOK.zoneSecured * (isWorkingTime(new Date(e.at)) ? 1 : RULEBOOK.nightShiftMultiplier);
        securedPoints.set(e.id.replace(/:secured$/, ''), points);
        if (e.contributor) (expeditions.get(e.planet) ?? expeditions.set(e.planet, new Set()).get(e.planet)).add(e.contributor);
        credit(e, points, 'zone secured');
        break;
      }
      case 'ZONE_REVERTED': {
        const points = securedPoints.get(e.id.replace(/:reverted$/, '')) ?? RULEBOOK.zoneSecured;
        credit(e, -points, 'zone reverted');
        break;
      }
      case 'WOUND_CLOSED': {
        if (e.data.verdict === 'drifted') break;
        const base = RULEBOOK.woundClose[e.data.kind] ?? 0;
        const cross = e.team && ownerFor(e) && e.team !== ownerFor(e) ? RULEBOOK.crossTeamMultiplier : 1;
        if (e.contributor) (closers.get(e.planet) ?? closers.set(e.planet, new Set()).get(e.planet)).add(e.contributor);
        credit(e, base * cross, `wound closed: ${e.data.kind}`);
        break;
      }
      case 'RESCUE':
        credit(e, RULEBOOK.rescue, 'rescue');
        break;
      case 'PLANET_TERRAFORMED': {
        const team = ownerFor(e);
        const prior = streak.get(team) ?? 0;
        const mult = RULEBOOK.classMultiplier(e.data.class ?? 1)
          * (e.data.crossSector ? RULEBOOK.crossSectorMultiplier : 1)
          * (1 + Math.min(RULEBOOK.streakCap, RULEBOOK.streakStep * prior));
        if (team) {
          credit(e, RULEBOOK.terraformOwner * mult, 'planet terraformed', null, team);
          streak.set(team, prior + 1);
        }
        planetOf(e.planet).terraformed = true;
        const crew = expeditions.get(e.planet) ?? new Set();
        for (const login of crew) credit(e, RULEBOOK.terraformExpedition, 'expedition bonus', login, teamOfLogin.get(login) ?? null);
        for (const login of closers.get(e.planet) ?? []) if (!crew.has(login)) credit(e, RULEBOOK.terraformCloser, 'closer bonus', login, teamOfLogin.get(login) ?? null);
        break;
      }
      case 'PLANET_LOST': {
        if (ownerFor(e)) streak.set(ownerFor(e), 0);
        planetOf(e.planet).lost = true;
        for (const c of credits) if (c.planet === e.planet) c.clawed = true;
        break;
      }
      default:
        break;
    }
  }

  // Decay: owner team, per tranche a wound stays open, clipped to the season.
  const closedAt = new Map(sorted.filter((e) => e.type === 'WOUND_CLOSED').map((e) => [e.id.replace(/:closed$/, ''), e.at]));
  for (const e of sorted.filter((e) => e.type === 'WOUND_OPENED')) {
    const team = ownerFor(e);
    if (!team) continue;
    const from = new Date(Math.max(new Date(e.at), start));
    const closed = closedAt.get(e.id.replace(/:opened$/, ''));
    const to = new Date(Math.min(closed ? new Date(closed) : now, end, now));
    const tranches = tranchesBetween(from, to, RULEBOOK.trancheMinutes);
    const points = -tranches * (RULEBOOK.decayPerTranche[e.data.kind] ?? 0);
    if (points !== 0) credits.push({ at: from.toISOString(), to: null, team, planet: e.planet, points, reason: `decay: ${e.data.kind}`, clawed: false });
  }

  const individuals = {};
  const teams = {};
  for (const c of credits) {
    const p = c.clawed ? 0 : c.points;
    if (c.to) individuals[c.to] = (individuals[c.to] ?? 0) + p;
    if (c.team) teams[c.team] = (teams[c.team] ?? 0) + p;
    if (!c.clawed) planetOf(c.planet).earned += c.points;
  }
  return { season, generatedAt: now.toISOString(), credits, individuals, teams, planets, streaks: Object.fromEntries(streak) };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test game/economy.test.mjs`
Expected: PASS (8 tests). If the decay test is off, recount: Mon 21 09:00 → Wed 30 18:00 local is 8 full working days (21, 22, 23, 24, 25, 28, 29, 30) × 9 h = 72 h = 18 tranches × 5 = 90.

- [ ] **Step 5: Commit**

```bash
git add game/economy.mjs game/economy.test.mjs
git commit -m "feat(game): the economy, credits and decay over a season"
```

---

### Task 7: GitHub source

**Files:**
- Create: `game/sources/github.mjs`, `game/sources/github.test.mjs`, `game/sources/parsers.mjs`, `game/sources/parsers.test.mjs`

**Interfaces:**
- Consumes: `Config` (Task 4).
- Produces:
  - `parsers.mjs`: `parseFrontMatter(text): Record<string,string>`, `parseInbox(text): { prd, title, blockedBy: number[] }`, `parseOutboxItem(text): { id, rank }`, `parseSettled(text): Map<id, { verdict, at, by }>`, `parsePlanSlices(text): [{ id, blockedBy: string[], wave }]`.
  - `github.mjs`: `buildSnapshot({ config, exec, now, org = 'vertuoza', planRepo = 'vertuo-omni-plan' }): Promise<Snapshot>` where `exec(args: string[]): Promise<string>` runs `gh` with those args and returns stdout. `ghExec` is the default, `(args) => execFile('gh', args)`.

Reads, in order (every call through `exec`, so the test fakes them by argument prefix):

1. `gh api graphql` is avoided; plain REST via `gh api` only.
2. PRD issues: `gh issue list -R vertuoza/vertuo-omni-plan --label prd --state all --limit 500 --json number,title,assignees,createdAt,closedAt`.
3. Teams: for each team in `config.teams`: `gh api orgs/vertuoza/teams/<team>/members --paginate --jq .[].login`.
4. Per repo in `config.repos`:
   - inbox listing: `gh api repos/vertuoza/<repo>/contents/docs/inbox --jq .[].name`; each file: `gh api repos/vertuoza/<repo>/contents/docs/inbox/<file> -H "Accept: application/vnd.github.raw"`; its first commit: `gh api "repos/vertuoza/<repo>/commits?path=docs/inbox/<file>&per_page=1&page=1" --jq .[-1].commit.committer.date` (surveyedAt; the API returns newest first, so the plan takes the last page — simplified here to the oldest of the first page, which is exact when the file has one commit, and documented).
   - feature PR: `gh pr list -R vertuoza/<repo> --search "Closes #<prd> in:body" --base main --state all --json number,headRefName,createdAt,isDraft,mergedAt,updatedAt`; `readyAt` = `createdAt` when never draft, else the `ready_for_review` timeline event: `gh api repos/vertuoza/<repo>/issues/<n>/timeline --paginate --jq '[.[] | select(.event=="ready_for_review")][0].created_at'`.
   - plan: `gh api repos/vertuoza/<repo>/contents/<plan path from inbox> -H "Accept: application/vnd.github.raw"` with `?ref=<headRefName>` (the plan lives on the feature branch).
   - sub-PRs: `gh pr list -R vertuoza/<repo> --base <headRefName> --state all --label pr:sub --limit 200 --json number,title,headRefName,author,createdAt,labels,mergedAt`; zone id = `headRefName` after `--`; a sub-PR titled `Revert` whose body names `#<n>` sets that zone's `revertedAt` to its `mergedAt`.
   - outbox: `gh api "repos/vertuoza/<repo>/contents/docs/outbox/<prd>?ref=<headRefName>" --jq .[].name` (empty on 404); each open item raw; `raisedAt` = first commit date of the file; `settled.md` raw when present.
   - bugs: `gh issue list -R vertuoza/<repo> --label bug --state all --search "#<prd>" --json number,createdAt,closedAt,closedBy` → `closedBy` login.

- [ ] **Step 1: Write the failing parsers tests**

```js
// game/sources/parsers.test.mjs
import { describe, it, expect } from 'vitest';
import { parseFrontMatter, parseInbox, parseOutboxItem, parseSettled, parsePlanSlices } from './parsers.mjs';

describe('parsers', () => {
  it('reads plain key: value front matter', () => {
    expect(parseFrontMatter('---\nprd: 1015\ntitle: The inbox\n---\nbody')).toEqual({ prd: '1015', title: 'The inbox' });
  });

  it('reads an inbox file', () => {
    expect(parseInbox('---\nprd: 1015\ntitle: The inbox\nblocked-by: [966, 985]\nplan: docs/superpowers/plans/x.md\nspec: file\n---\n'))
      .toEqual({ prd: 1015, title: 'The inbox', blockedBy: [966, 985], plan: 'docs/superpowers/plans/x.md' });
    expect(parseInbox('---\nprd: 1\ntitle: t\nblocked-by: none\nplan: none\nspec: issue\n---\n').blockedBy).toEqual([]);
  });

  it('reads an outbox item', () => {
    expect(parseOutboxItem('---\nid: s7-01-default-country\nprd: 985\nslice: s7\nrank: high\nbears-on: none\nraised: 2026-09-22\nwave: 4\n---\n## What I had to decide\n'))
      .toEqual({ id: 's7-01-default-country', rank: 'high', raised: '2026-09-22' });
  });

  it('reads the settled ledger', () => {
    const text = `# Settled outbox items — PRD 1007

<!-- vertuo-outbox-settled: s1-01-customer-door -->

## s1-01-customer-door — agreed

- Verdict: agreed
- Approved by: claude-code-session (asked of clement.noterdaem inline, /vertuo-deliver)
- Approved at: 2026-09-23T07:25:59Z
- Channel: feature pull request #1021
- Rank: high

<!-- vertuo-outbox-settled: s2-01-other -->

## s2-01-other — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-09-24T09:00:00Z
`;
    const m = parseSettled(text);
    expect(m.get('s1-01-customer-door')).toEqual({ verdict: 'agreed', at: '2026-09-23T07:25:59Z', by: 'clement.noterdaem', rank: 'high' });
    expect(m.get('s2-01-other')).toEqual({ verdict: 'drifted', at: '2026-09-24T09:00:00Z', by: 'pierrederval', rank: null });
  });

  it('reads the slice table of a plan', () => {
    const text = `## Slices

| id  | slice | scenarios | territory | blocked by | wave | tier |
| --- | ----- | --------- | --------- | ---------- | ---- | ---- |
| s1  | A     | —         | \`a/\`    | —          | 1    | mid  |
| s4  | D     | —         | \`d/\`    | s1, s2, s3 | 2    | top  |
`;
    expect(parsePlanSlices(text)).toEqual([
      { id: 's1', blockedBy: [], wave: 1 },
      { id: 's4', blockedBy: ['s1', 's2', 's3'], wave: 2 },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement parsers.mjs**

Run: `pnpm test game/sources/parsers.test.mjs` → FAIL, module not found

```js
// game/sources/parsers.mjs
// Readers for the delivery layer's file formats. They read; they never grade — the guards in the
// engineering repositories do that (spec §8).

export function parseFrontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function numberList(value) {
  if (!value || value === 'none') return [];
  return value.replace(/[[\]]/g, '').split(',').map((s) => Number(s.trim())).filter(Number.isInteger);
}

export function parseInbox(text) {
  const fm = parseFrontMatter(text);
  return { prd: Number(fm.prd), title: fm.title ?? '', blockedBy: numberList(fm['blocked-by']), plan: fm.plan && fm.plan !== 'none' ? fm.plan : null };
}

export function parseOutboxItem(text) {
  const fm = parseFrontMatter(text);
  return { id: fm.id, rank: fm.rank, raised: fm.raised };
}

export function parseSettled(text) {
  const entries = new Map();
  const parts = text.split(/<!-- vertuo-outbox-settled: ([^\s]+) -->/);
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const body = parts[i + 1] ?? '';
    const field = (name) => body.match(new RegExp(`^- ${name}: (.+)$`, 'm'))?.[1]?.trim() ?? null;
    const approvedBy = field('Approved by') ?? '';
    const asked = approvedBy.match(/asked of ([^\s)]+)/);
    entries.set(id, { verdict: field('Verdict'), at: field('Approved at'), by: asked ? asked[1] : approvedBy.split(' ')[0], rank: field('Rank') });
  }
  return entries;
}

export function parsePlanSlices(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 8 || !/^s\d+$/.test(cells[1])) continue;
    const blocked = cells[5] === '—' || cells[5] === '' ? [] : cells[5].split(',').map((s) => s.trim());
    rows.push({ id: cells[1], blockedBy: blocked, wave: Number(cells[6]) });
  }
  return rows;
}
```

Run: `pnpm test game/sources/parsers.test.mjs` → PASS (5 tests)

- [ ] **Step 3: Write the failing github source test**

```js
// game/sources/github.test.mjs
import { describe, it, expect } from 'vitest';
import { parseProjects } from '../config.mjs';
import { buildSnapshot } from './github.mjs';

const config = parseProjects('sectors:\n  core: { repos: [core-repo] }\nteams:\n  beaver: { home: core }\n');

const INBOX = '---\nprd: 2332\ntitle: Generic Import Engine\nblocked-by: none\nplan: docs/superpowers/plans/p.md\nspec: file\n---\n';
const PLAN = '| id | slice | scenarios | territory | blocked by | wave | tier |\n|---|---|---|---|---|---|---|\n| s1 | A | — | `a/` | — | 1 | mid |\n| s2 | B | — | `b/` | s1 | 2 | mid |\n';
const ITEM = '---\nid: s1-01-a\nprd: 2332\nslice: s1\nrank: high\nbears-on: none\nraised: 2026-09-21\nwave: 1\n---\n';

// A fake gh: matched on the joined argument string.
function fakeExec(calls) {
  return async (args) => {
    const key = args.join(' ');
    for (const [prefix, out] of calls) if (key.startsWith(prefix)) return typeof out === 'string' ? out : JSON.stringify(out);
    throw new Error(`unexpected gh call: ${key}`);
  };
}

describe('buildSnapshot', () => {
  it('assembles a planet from issues, inbox, plan, sub-PRs, outbox and bugs', async () => {
    const exec = fakeExec([
      ['issue list -R vertuoza/vertuo-omni-plan --label prd', [{ number: 2332, title: 'Generic Import Engine', assignees: [{ login: 'pm' }], createdAt: '2026-09-01T08:00:00Z', closedAt: null }]],
      ['api orgs/vertuoza/teams/beaver/members', 'pm\nalice\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox --jq', '2332-generic-import.md\nREADME.md\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox/2332-generic-import.md', INBOX],
      ['api repos/vertuoza/core-repo/commits?path=docs/inbox/2332-generic-import.md', '2026-09-02T08:00:00Z\n'],
      ['pr list -R vertuoza/core-repo --search', [{ number: 500, headRefName: 'feat/generic-import', createdAt: '2026-09-21T08:00:00Z', isDraft: true, mergedAt: null, updatedAt: '2026-09-23T08:00:00Z' }]],
      ['api repos/vertuoza/core-repo/contents/docs/superpowers/plans/p.md?ref=feat/generic-import', PLAN],
      ['pr list -R vertuoza/core-repo --base feat/generic-import', [
        { number: 501, title: 'feat: a', headRefName: 'feat/generic-import--s1', author: { login: 'alice' }, createdAt: '2026-09-21T09:00:00Z', labels: [{ name: 'pr:sub' }], mergedAt: '2026-09-21T12:00:00Z', body: 'Part of #2332' },
      ]],
      ['api repos/vertuoza/core-repo/contents/docs/outbox/2332?ref=feat/generic-import --jq', 's1-01-a.md\n'],
      ['api repos/vertuoza/core-repo/contents/docs/outbox/2332/s1-01-a.md?ref=feat/generic-import', ITEM],
      ['api repos/vertuoza/core-repo/commits?path=docs/outbox/2332/s1-01-a.md', '2026-09-21T10:00:00Z\n'],
      ['issue list -R vertuoza/core-repo --label bug', []],
    ]);
    const snap = await buildSnapshot({ config, exec, now: new Date('2026-09-23T14:00:00Z') });
    expect(snap.teams).toEqual({ pm: 'beaver', alice: 'beaver' });
    expect(snap.planets).toHaveLength(1);
    const p = snap.planets[0];
    expect(p).toMatchObject({ prd: 2332, title: 'Generic Import Engine', captain: 'pm', ownerTeam: 'beaver' });
    expect(p.regions).toEqual([{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z' }]);
    expect(p.featurePr).toEqual({ repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' });
    expect(p.zones).toEqual([
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
    ]);
    expect(p.outbox).toEqual([{ id: 's1-01-a', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: null }]);
    expect(p.bugs).toEqual([]);
  });

  it('keeps a planet charted and unsurveyed when no repo carries an inbox file', async () => {
    const exec = fakeExec([
      ['issue list -R vertuoza/vertuo-omni-plan --label prd', [{ number: 2400, title: 'New', assignees: [], createdAt: '2026-09-20T08:00:00Z', closedAt: null }]],
      ['api orgs/vertuoza/teams/beaver/members', ''],
      ['api repos/vertuoza/core-repo/contents/docs/inbox --jq', ''],
    ]);
    const snap = await buildSnapshot({ config, exec, now: new Date('2026-09-23T14:00:00Z') });
    expect(snap.planets[0]).toMatchObject({ prd: 2400, captain: null, ownerTeam: null, regions: [], featurePr: null, zones: [], outbox: [], bugs: [] });
  });
});
```

- [ ] **Step 4: Run to verify failure, then implement github.mjs**

Run: `pnpm test game/sources/github.test.mjs` → FAIL, module not found

```js
// game/sources/github.mjs
// The one impure module: builds a world snapshot from GitHub through the gh CLI (spec §7.3).
// Every call goes through `exec` so tests run on fixtures. Reads only.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseInbox, parseOutboxItem, parseSettled, parsePlanSlices } from './parsers.mjs';

const run = promisify(execFile);
export const ghExec = async (args) => (await run('gh', args, { maxBuffer: 64 * 1024 * 1024 })).stdout;

const RAW = ['-H', 'Accept: application/vnd.github.raw'];
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const json = (s) => (s.trim() ? JSON.parse(s) : []);
const soft = (p) => p.catch(() => ''); // a 404 (no outbox dir yet, no plan yet) is an empty read

export async function buildSnapshot({ config, exec = ghExec, now = new Date(), org = 'vertuoza', planRepo = 'vertuo-omni-plan' }) {
  const issues = json(await exec(['issue', 'list', '-R', `${org}/${planRepo}`, '--label', 'prd', '--state', 'all', '--limit', '500', '--json', 'number,title,assignees,createdAt,closedAt']));

  const teams = {};
  for (const team of Object.keys(config.teams)) {
    for (const login of lines(await soft(exec(['api', `orgs/${org}/teams/${team}/members`, '--paginate', '--jq', '.[].login'])))) teams[login] = team;
  }

  const inboxByPrd = new Map(); // prd → [{ repo, file, inbox, surveyedAt }]
  for (const repo of config.repos) {
    const files = lines(await soft(exec(['api', `repos/${org}/${repo}/contents/docs/inbox`, '--jq', '.[].name']))).filter((f) => f !== 'README.md' && f.endsWith('.md'));
    for (const file of files) {
      const inbox = parseInbox(await exec(['api', `repos/${org}/${repo}/contents/docs/inbox/${file}`, ...RAW]));
      const surveyedAt = lines(await exec(['api', `repos/${org}/${repo}/commits?path=docs/inbox/${file}&per_page=100`, '--jq', '.[-1].commit.committer.date']))[0] ?? null;
      (inboxByPrd.get(inbox.prd) ?? inboxByPrd.set(inbox.prd, []).get(inbox.prd)).push({ repo, file, inbox, surveyedAt });
    }
  }

  const planets = [];
  for (const issue of issues) {
    const captain = issue.assignees?.[0]?.login ?? null;
    const planet = {
      prd: issue.number, title: issue.title, captain, ownerTeam: captain ? teams[captain] ?? null : null,
      issue: { createdAt: issue.createdAt, closedAt: issue.closedAt ?? null },
      regions: [], featurePr: null, zones: [], outbox: [], bugs: [],
    };
    for (const { repo, inbox, surveyedAt } of inboxByPrd.get(issue.number) ?? []) {
      planet.regions.push({ repo, blockedBy: inbox.blockedBy, surveyedAt });
      const prs = json(await exec(['pr', 'list', '-R', `${org}/${repo}`, '--search', `"Closes #${issue.number}" in:body`, '--base', 'main', '--state', 'all', '--json', 'number,headRefName,createdAt,isDraft,mergedAt,updatedAt']));
      const fp = prs.sort((a, b) => a.number - b.number)[0];
      if (!fp) continue;
      const readyAt = fp.isDraft ? null : (lines(await soft(exec(['api', `repos/${org}/${repo}/issues/${fp.number}/timeline`, '--paginate', '--jq', '[.[] | select(.event=="ready_for_review")][0].created_at'])))[0] ?? fp.createdAt);
      planet.featurePr ??= { repo, number: fp.number, createdAt: fp.createdAt, readyAt, mergedAt: fp.mergedAt ?? null, lastActivityAt: fp.updatedAt };

      const slices = inbox.plan ? parsePlanSlices(await soft(exec(['api', `repos/${org}/${repo}/contents/${inbox.plan}?ref=${fp.headRefName}`, ...RAW]))) : [];
      const subs = json(await exec(['pr', 'list', '-R', `${org}/${repo}`, '--base', fp.headRefName, '--state', 'all', '--label', 'pr:sub', '--limit', '200', '--json', 'number,title,headRefName,author,createdAt,labels,mergedAt,body']));
      const reverts = new Map(subs.filter((s) => /^revert/i.test(s.title) && s.mergedAt).flatMap((s) => [...s.body.matchAll(/#(\d+)/g)].map((m) => [Number(m[1]), s.mergedAt])));
      for (const slice of slices) {
        const sub = subs.filter((s) => !/^revert/i.test(s.title) && s.headRefName.endsWith(`--${slice.id}`)).sort((a, b) => a.number - b.number)[0];
        planet.zones.push({
          id: slice.id, repo, wave: slice.wave, blockedBy: slice.blockedBy,
          pr: sub ? { number: sub.number, author: sub.author?.login ?? null, createdAt: sub.createdAt, labels: sub.labels.map((l) => l.name), mergedAt: sub.mergedAt ?? null, revertedAt: reverts.get(sub.number) ?? null } : null,
        });
      }

      const dir = `docs/outbox/${issue.number}`;
      const names = lines(await soft(exec(['api', `repos/${org}/${repo}/contents/${dir}?ref=${fp.headRefName}`, '--jq', '.[].name'])));
      const settled = names.includes('settled.md') ? parseSettled(await exec(['api', `repos/${org}/${repo}/contents/${dir}/settled.md?ref=${fp.headRefName}`, ...RAW])) : new Map();
      for (const name of names.filter((n) => n.endsWith('.md') && n !== 'settled.md')) {
        const item = parseOutboxItem(await exec(['api', `repos/${org}/${repo}/contents/${dir}/${name}?ref=${fp.headRefName}`, ...RAW]));
        const raisedAt = lines(await soft(exec(['api', `repos/${org}/${repo}/commits?path=${dir}/${name}&sha=${fp.headRefName}&per_page=100`, '--jq', '.[-1].commit.committer.date'])))[0] ?? `${item.raised}T07:00:00Z`;
        planet.outbox.push({ id: item.id, repo, rank: item.rank, raisedAt, settled: null });
      }
      for (const [id, s] of settled) {
        const rework = s.verdict === 'drifted' ? subs.find((x) => x.mergedAt && new RegExp(`\\b${id}\\b`).test(x.body ?? ''))?.mergedAt ?? null : null;
        planet.outbox.push({ id, repo, rank: s.rank ?? 'medium', raisedAt: s.at, settled: { verdict: s.verdict, at: s.at, by: s.by, reworkMergedAt: rework } });
      }

      const bugs = json(await soft(exec(['issue', 'list', '-R', `${org}/${repo}`, '--label', 'bug', '--state', 'all', '--search', `#${issue.number}`, '--json', 'number,createdAt,closedAt,closedBy'])));
      for (const b of bugs) planet.bugs.push({ repo, number: b.number, createdAt: b.createdAt, closedAt: b.closedAt ?? null, closedBy: b.closedBy?.login ?? null });
    }
    planets.push(planet);
  }
  return { at: now.toISOString(), teams, planets };
}
```

A settled entry's `- Rank:` line is what `parseSettled` reads; an entry without one (an older ledger) floors to `medium`, the lowest, so nothing is over-credited.

- [ ] **Step 5: Run all tests to verify pass**

Run: `pnpm test`
Expected: PASS. A settled outbox item's `raisedAt` is its settle time in this source (the open file is gone once settled, so its first commit is not on the branch any more); decay for a settled item is therefore zero, which under-counts a slow answer that was eventually given. Document this in the module header as a known simplification; the open-item path is exact.

- [ ] **Step 6: Commit**

```bash
git add game/sources
git commit -m "feat(game): the GitHub source, a world snapshot through gh"
```

---

### Task 8: Renderers and CLIs

**Files:**
- Create: `game/render/banner.mjs`, `game/render/banner.test.mjs`, `game/render/rankings.mjs`, `game/render/rankings.test.mjs`, `game/cli/project.mjs`, `game/cli/score.mjs`, `game/cli/banner.mjs`

**Interfaces:**
- Consumes: `PlanetState` (Task 4), `Season` (Task 6), `buildSnapshot` (Task 7), `projectEvents` (Task 5), `readLedger`/`appendEvents` (Task 3), `loadProjects` (Task 4).
- Produces: `renderBanner(planetState, { season, now }): string`; `renderRankings(season): string` (markdown); CLIs below.

- [ ] **Step 1: Write the failing banner test**

```js
// game/render/banner.test.mjs
import { describe, it, expect } from 'vitest';
import { renderBanner } from './banner.mjs';

const NOW = new Date('2026-09-23T14:00:00Z');
const planet = {
  prd: 2332, title: 'Generic Import Engine', captain: 'pm', ownerTeam: 'beaver', state: 'distress',
  regions: ['core-repo', 'ai-repo'], class: 2, crossSector: true, threat: 3, distressSince: '2026-09-22T11:00:00Z',
  zones: [
    { id: 's1', repo: 'core-repo', wave: 1, state: 'secured', author: 'alice' },
    { id: 's2', repo: 'core-repo', wave: 2, state: 'open', author: null },
    { id: 's3', repo: 'ai-repo', wave: 1, state: 'claimed', author: 'bob' },
  ],
  wounds: [
    { id: 'a', kind: 'unconfirmed-ground', repo: 'core-repo', openedAt: '2026-09-22T10:00:00Z', closedAt: null },
    { id: 'b', kind: 'transmission', repo: 'core-repo', openedAt: '2026-09-23T12:00:00Z', closedAt: null },
    { id: 'c', kind: 'beacon', repo: 'core-repo', openedAt: '2026-09-20T10:00:00Z', closedAt: '2026-09-21T10:00:00Z' },
  ],
};
const season = { individuals: { alice: 60 }, teams: { beaver: 10, octopod: 60 }, planets: {}, streaks: { beaver: 2 }, credits: [] };

describe('renderBanner', () => {
  it('prints the planet block', () => {
    expect(renderBanner(planet, { season, now: NOW })).toBe([
      'OMNI PLAN // PLANET 2332 — Generic Import Engine',
      'Class II ★ cross-sector · Threat III · 📡 DISTRESS · phase 1/2 · zones 1/3 secured (core-repo 1/2 · ai-repo 0/1)',
      // 🟧 opened Tue 12:00 local → Wed 16:00 local = 6h + 7h; 📡 opened Wed 14:00 local → 16:00
      'Wounds: 1 🟧 (13h) · 1 📡 (2h)',
      'Captain: @pm · Crew: beaver 🔥2 · Expeditions: 2 (alice, bob) · Rescuers: 0',
      'Open zones: s2 (core-repo, phase 2)',
    ].join('\n'));
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement banner.mjs**

Run: `pnpm test game/render/banner.test.mjs` → FAIL

```js
// game/render/banner.mjs
// The text block /omni-yolo prints (spec §7.4). Reads state; decides nothing.
import { tranchesBetween } from '../calendar.mjs';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const ICON = { transmission: '📡', 'unconfirmed-ground': '🟧', beacon: '🟥', 'fault-line': '⚡', 'under-fire': '🔥', aftershock: '⚡' };
const STATE = { distress: '📡 DISTRESS', 'awaiting-command': '🛡 AWAITING COMMAND', terraformed: '✅ TERRAFORMED', aftershock: '⚡ AFTERSHOCK', lost: '💀 LOST', locked: '🌑 LOCKED', charted: '🪐 CHARTED', decommissioned: '⚪ DECOMMISSIONED' };

function workingHours(fromIso, now) {
  return tranchesBetween(new Date(fromIso), now, 60);
}

export function renderBanner(p, { season, now }) {
  const secured = p.zones.filter((z) => z.state === 'secured').length;
  const phases = Math.max(0, ...p.zones.map((z) => z.wave));
  // The phase is one past the highest wave whose every zone is secured, capped at the last wave.
  const wavesDone = [...new Set(p.zones.map((z) => z.wave))].filter((w) => p.zones.filter((z) => z.wave === w).every((z) => z.state === 'secured'));
  const phase = Math.min(phases, 1 + (wavesDone.length ? Math.max(...wavesDone) : 0));
  const perRegion = p.regions.map((r) => `${r} ${p.zones.filter((z) => z.repo === r && z.state === 'secured').length}/${p.zones.filter((z) => z.repo === r).length}`).join(' · ');
  const open = p.wounds.filter((w) => !w.closedAt);
  const byKind = [...new Set(open.map((w) => w.kind))].map((k) => {
    const ws = open.filter((w) => w.kind === k);
    const oldest = ws.map((w) => w.openedAt).sort()[0];
    return `${ws.length} ${ICON[k]} (${workingHours(oldest, now)}h)`;
  });
  const expedition = [...new Set(p.zones.map((z) => z.author).filter(Boolean))];
  // Rescues are ledger facts; the banner reads them from the season, never re-derives them.
  const rescuers = new Set((season.credits ?? []).filter((c) => c.planet === p.prd && c.reason === 'rescue').map((c) => c.to)).size;
  const streak = season.streaks?.[p.ownerTeam] ? ` 🔥${season.streaks[p.ownerTeam]}` : '';
  const stateTag = STATE[p.state] ? ` · ${STATE[p.state]}` : '';
  const openZones = p.zones.filter((z) => z.state === 'open').map((z) => `${z.id} (${z.repo}, phase ${z.wave})`);
  return [
    `OMNI PLAN // PLANET ${p.prd} — ${p.title}`,
    `Class ${ROMAN[Math.min(p.class, 4)] || '?'}${p.crossSector ? ' ★ cross-sector' : ''} · Threat ${ROMAN[p.threat]}${stateTag} · phase ${phase}/${phases} · zones ${secured}/${p.zones.length} secured${perRegion ? ` (${perRegion})` : ''}`,
    `Wounds: ${byKind.length ? byKind.join(' · ') : 'none'}`,
    `Captain: ${p.captain ? '@' + p.captain : 'none (uncrewed)'} · Crew: ${p.ownerTeam ?? 'none'}${streak} · Expeditions: ${expedition.length}${expedition.length ? ` (${expedition.join(', ')})` : ''} · Rescuers: ${rescuers}`,
    `Open zones: ${openZones.length ? openZones.join(', ') : 'none'}`,
  ].join('\n');
}
```

- [ ] **Step 3: Run to verify pass**

Run: `pnpm test game/render/banner.test.mjs` → PASS (1 test). With s1 secured and s3 only claimed, wave 1 is not done, so the phase reads `1/2`.

- [ ] **Step 4: Write the failing rankings test, then implement**

```js
// game/render/rankings.test.mjs
import { describe, it, expect } from 'vitest';
import { renderRankings } from './rankings.mjs';

describe('renderRankings', () => {
  it('lists teams then individuals, highest first', () => {
    const md = renderRankings({ season: '2026-09', generatedAt: '2026-09-28T07:00:00Z', individuals: { alice: 60, pm: 30 }, teams: { octopod: 60, beaver: 127.5 }, streaks: { beaver: 2 }, planets: { 2332: { ownerTeam: 'beaver', terraformed: true, lost: false, earned: 217.5 } } });
    expect(md).toBe([
      '## OMNI PLAN — season 2026-09',
      '',
      '_as of 2026-09-28T07:00:00Z_',
      '',
      '### Fleets',
      '| # | team | points | streak |',
      '|---|------|-------:|-------:|',
      '| 1 | beaver | 127.5 | 🔥2 |',
      '| 2 | octopod | 60 | — |',
      '',
      '### Heroes',
      '| # | hero | points |',
      '|---|------|-------:|',
      '| 1 | @alice | 60 |',
      '| 2 | @pm | 30 |',
      '',
      '### Planets',
      '| planet | crew | state | points on it |',
      '|--------|------|-------|-------------:|',
      '| #2332 | beaver | ✅ terraformed | 217.5 |',
    ].join('\n'));
  });
});
```

```js
// game/render/rankings.mjs
export function renderRankings(s) {
  const desc = (o) => Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const teams = desc(s.teams).map(([t, p], i) => `| ${i + 1} | ${t} | ${p} | ${s.streaks?.[t] ? '🔥' + s.streaks[t] : '—'} |`);
  const heroes = desc(s.individuals).map(([h, p], i) => `| ${i + 1} | @${h} | ${p} |`);
  const planets = Object.entries(s.planets).map(([prd, p]) => `| #${prd} | ${p.ownerTeam ?? '—'} | ${p.lost ? '💀 lost' : p.terraformed ? '✅ terraformed' : '🌍 terraforming'} | ${p.earned} |`);
  return [
    `## OMNI PLAN — season ${s.season}`, '', `_as of ${s.generatedAt}_`, '',
    '### Fleets', '| # | team | points | streak |', '|---|------|-------:|-------:|', ...teams, '',
    '### Heroes', '| # | hero | points |', '|---|------|-------:|', ...heroes, '',
    '### Planets', '| planet | crew | state | points on it |', '|--------|------|-------|-------------:|', ...planets,
  ].join('\n');
}
```

Run: `pnpm test game/render/rankings.test.mjs` → PASS

- [ ] **Step 5: Write the three CLIs**

```js
// game/cli/project.mjs — snapshot GitHub, append new events to the ledger.
import { loadProjects } from '../config.mjs';
import { buildSnapshot } from '../sources/github.mjs';
import { projectEvents } from '../projector.mjs';
import { appendEvents } from '../ledger.mjs';

const now = new Date();
const config = loadProjects();
const snapshot = await buildSnapshot({ config, now });
const events = projectEvents(snapshot, { config, now });
const appended = appendEvents('game/ledger', events);
console.log(`planets: ${snapshot.planets.length} · events implied: ${events.length} · appended: ${appended.length}`);
for (const e of appended) console.log(`  + ${e.at} ${e.type} #${e.planet}${e.contributor ? ' @' + e.contributor : ''}`);
```

```js
// game/cli/score.mjs — fold the ledger into the season snapshot and the rankings page.
import { mkdirSync, writeFileSync } from 'node:fs';
import { readLedger } from '../ledger.mjs';
import { score } from '../economy.mjs';
import { renderRankings } from '../render/rankings.mjs';

const now = new Date();
const season = process.argv[2] ?? now.toISOString().slice(0, 7);
const result = score(readLedger('game/ledger'), { season, now });
mkdirSync('game/season', { recursive: true });
writeFileSync(`game/season/${season}.json`, JSON.stringify(result, null, 2) + '\n');
writeFileSync('game/season/rankings.md', renderRankings(result) + '\n');
console.log(`season ${season}: ${Object.keys(result.individuals).length} heroes · ${Object.keys(result.teams).length} fleets · ${result.credits.length} credits`);
```

```js
// game/cli/banner.mjs <prd> — print one planet's banner from live GitHub and the season snapshot.
import { existsSync, readFileSync } from 'node:fs';
import { loadProjects } from '../config.mjs';
import { buildSnapshot } from '../sources/github.mjs';
import { derivePlanet } from '../planet-state.mjs';
import { renderBanner } from '../render/banner.mjs';

const prd = Number(process.argv[2]);
if (!Number.isInteger(prd)) { console.error('usage: game:banner <prd>'); process.exit(2); }
const now = new Date();
const config = loadProjects();
const snapshot = await buildSnapshot({ config, now });
const planet = snapshot.planets.find((p) => p.prd === prd);
if (!planet) { console.error(`no PRD #${prd} in the planning repository`); process.exit(1); }
const terraformedPlanets = new Set(snapshot.planets.filter((p) => p.featurePr?.mergedAt).map((p) => p.prd));
const seasonPath = `game/season/${now.toISOString().slice(0, 7)}.json`;
const season = existsSync(seasonPath) ? JSON.parse(readFileSync(seasonPath, 'utf8')) : { individuals: {}, teams: {}, planets: {}, streaks: {}, credits: [] };
console.log(renderBanner(derivePlanet(planet, { config, terraformedPlanets, now }), { season, now }));
```

- [ ] **Step 6: Smoke the CLIs against fixtures**

Run: `pnpm test` → PASS. Then, with `gh auth status` green and `projects.yml` filled in, run `pnpm game:project` once by hand and inspect `game/ledger/<yyyy-mm>.jsonl`; then `pnpm game:score` and read `game/season/rankings.md`. If `projects.yml` still holds placeholders, skip the live run and say so in the commit body.

- [ ] **Step 7: Commit**

```bash
git add game/render game/cli
git commit -m "feat(game): the banner, the rankings page, and the three commands"
```

---

### Task 9: The scheduled workflow

**Files:**
- Create: `.github/workflows/game.yml`, `game/README.md`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/game.yml
# The game layer's only writer: polls the delivery layer, appends to the ledger, folds the season,
# and once a week posts the rankings. Delete this file and game/ to remove the game (spec §2).
name: game
on:
  schedule:
    - cron: '*/15 * * * *'     # poll
    - cron: '0 7 * * 1'        # Monday 09:00 Brussels (07:00 UTC in summer; 08:00 in winter is fine)
  workflow_dispatch:
concurrency:
  group: game-ledger
  cancel-in-progress: false
permissions:
  contents: write
  issues: write
jobs:
  ledger:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm game:project
        env: { GH_TOKEN: '${{ secrets.OMNI_GAME_TOKEN }}' }   # a fine-grained token: read on the engineering repos, read org members
      - run: pnpm game:score
      - name: Commit the ledger and the season
        run: |
          git config user.name 'omni-game[bot]'
          git config user.email 'omni-game@users.noreply.github.com'
          git add game/ledger game/season
          git diff --cached --quiet || git commit -m 'chore(game): ledger and season [skip ci]'
          git push
      - name: Post the weekly rankings
        if: github.event.schedule == '0 7 * * 1'
        env: { GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }
        run: gh issue comment "$RANKINGS_ISSUE" --body-file game/season/rankings.md
```

Add at the top of `jobs.ledger`:

```yaml
    env:
      RANKINGS_ISSUE: 1   # the pinned "Hall of Heroes" issue in this repository; create it once by hand
```

- [ ] **Step 2: Write game/README.md**

```markdown
# The game layer

A read-only projection of PRD delivery as a planet-terraforming game. Design:
`docs/superpowers/specs/2026-09-24-omni-plan-game-design.md`.

It never writes to an engineering repository. Its only outputs are `game/ledger/*.jsonl`
(append-only events), `game/season/*.json` + `rankings.md` (derived, regenerable) and one weekly
comment on the pinned Hall of Heroes issue. Delete `game/` and `.github/workflows/game.yml` to
remove it.

- `pnpm game:project` — snapshot GitHub, append new events to the ledger
- `pnpm game:score [YYYY-MM]` — fold the ledger into a season
- `pnpm game:banner <prd>` — print one planet's banner
- `pnpm test` — every module is tested on fixtures; nothing touches GitHub in tests

Constants live in `game/rulebook.mjs`. Org facts (sectors, teams) live in `projects.yml`.
```

- [ ] **Step 3: Validate the workflow file parses**

Run: `node -e "import('yaml').then(y => { y.parse(require('fs').readFileSync('.github/workflows/game.yml','utf8')); console.log('ok') })"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/game.yml game/README.md
git commit -m "ci(game): poll the delivery layer every 15 minutes, post rankings weekly"
```

---

## Self-review

**Spec coverage.** §2 principles → Global Constraints, Task 9 README. §3.1–3.2 → out of scope here (own plan in `vertuo-ai-domain`), stated in the header. §4 → Task 1 `projects.yml`, Task 4 config, Task 2 calendar, Task 7 teams. §5.1–5.5 states → Task 4; §5.6 roles → Task 8 banner; §5.7 Entropy → naming only, no code needed. §6.1–6.4 → Task 1 constants, Task 6 rules; §6.5 audit → pinned by Task 6 tests (drifted = 0, revert nets 0, clawback). §7 architecture and events → Tasks 3, 5; §7.2 storage → Tasks 3, 9; §7.3 sources → Task 7; §7.4 banner → Task 8. §8 error handling → Task 7 `soft()` reads, Task 4 uncrewed planet (null owner → no decay, no team bonus, banner says uncrewed), Task 7 concurrent claim (lowest sub-PR number wins). §9 testing → each task. §10 steps 2–3 → Tasks 5–9.

**Deviations from the spec, deliberate:** `PLAN_CHANGED` is not emitted; the spec itself says a plan change is just new zones, and a `ZONE_OPENED` covers it. Distress and rescue are per zone, which is the precise form of "first claim after 8 idle working hours". A settled item's `raisedAt` is its settle time in the GitHub source (Task 7 step 5), so decay is only exact for still-open items; the spec's ledger will carry the exact opening once the item's first commit is read from the settled entry's verbatim block, a follow-up.

**Placeholder scan.** `projects.yml` values are placeholders by design (spec §11) and the CLI smoke step says what to do when they are unfilled. No "TBD" elsewhere.

**Type consistency.** `SnapshotPlanet` fields in Task 4 match what Task 7 builds and Tasks 5/8 read (`issue.createdAt/closedAt`, `regions[].surveyedAt`, `featurePr.readyAt/mergedAt/lastActivityAt`, `zones[].pr.labels/mergedAt/revertedAt/author`, `outbox[].settled.verdict/at/by/reworkMergedAt`, `bugs[].closedBy`). Wound ids `zone:…`, `outbox:…`, `fault:…`, `bug:…` are built in Task 4 and suffixed `:opened`/`:closed` in Task 5; Task 6 strips those suffixes. `Season.credits[].reason === 'rescue'` is what Task 8's banner counts.

**Review Focus.** Each of the five lines names its task; the tests are in those tasks.
