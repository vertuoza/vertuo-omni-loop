import { describe, expect, it } from 'vitest';
import {
  breaches,
  collisionRows,
  collisions,
  covers,
  parsePlanRepositories,
  parsePlanSlices,
  sameWaveCollisions,
  territoryPrefixes,
  territoryVerdict,
} from './territory.mjs';

/** A plan in the shape this slice introduces: a `territory` column beside the wave. */
const PLAN = `# Plan: a plan

## Slices

| id  | slice              | scenarios | territory                                            | blocked by | wave | tier |
| --- | ------------------ | --------- | ---------------------------------------------------- | ---------- | ---- | ---- |
| s1  | The registers      | …         | \`docs/knowledge/product/invariants.md\`, \`scripts/registers*\`, \`package.json\` | —          | 1    | mid  |
| s2  | The item           | …         | \`scripts/outbox.mjs\`, \`package.json\`                   | s1         | 2    | mid  |
| s6  | The territory      | …         | \`.claude/skills/vertuo-plan/\`, \`scripts/check-territory*\` | —          | 1    | top  |

### s1 — The registers

**Done when:** …
`;

/** The same plan with the `package.json` pair collapsed into one wave — the mistake s6 exists to catch. */
const COLLIDING_PLAN = PLAN.replace('| s1         | 2    | mid  |', '| —          | 1    | mid  |');

describe('territoryPrefixes', () => {
  it('reads the backticked paths out of a table cell', () => {
    expect(
      territoryPrefixes(
        '`docs/knowledge/product/invariants.md`, `scripts/registers*`, `package.json`',
      ),
    ).toEqual(['docs/knowledge/product/invariants.md', 'scripts/registers*', 'package.json']);
  });

  it('reads a cell that declares nothing as declaring nothing', () => {
    expect(territoryPrefixes('—')).toEqual([]);
    expect(territoryPrefixes('')).toEqual([]);
  });
});

describe('parsePlanSlices', () => {
  it('reads every slice with the ground it declares and the wave it runs in', () => {
    const slices = parsePlanSlices(PLAN);
    expect(slices.map((slice) => slice.id)).toEqual(['s1', 's2', 's6']);
    expect(slices[2]).toMatchObject({
      id: 's6',
      wave: 1,
      territory: ['.claude/skills/vertuo-plan/', 'scripts/check-territory*'],
    });
  });

  it('throws on a slice table with no territory column, rather than grading nothing', () => {
    // The failure mode a guard is least allowed to have: a plan written in the old shape must be
    // loud, not silently breach-free.
    const old = `## Slices

| id  | slice | scenarios | blocked by | wave | tier |
| --- | ----- | --------- | ---------- | ---- | ---- |
| s1  | …     | …         | —          | 1    | mid  |
`;
    expect(() => parsePlanSlices(old)).toThrow(/territory/);
  });

  it('throws when there is no slice table at all', () => {
    expect(() => parsePlanSlices('# Plan\n\nNo table here.\n')).toThrow(/slice table/);
  });

  it('reads the slice table even when an earlier id table lacks territory column', () => {
    // A plan with a decoy `id` table before its real slice table should read the slice table
    // (the one with `territory` column), not fail on the first `id` table.
    const planWithDecoyTable = `# Plan: a plan

## Some metadata

| id  | name        |
| --- | ----------- |
| 1   | Some entity |
| 2   | Another one |

## Slices

| id  | slice              | scenarios | territory                                            | blocked by | wave | tier |
| --- | ------------------ | --------- | ---------------------------------------------------- | ---------- | ---- | ---- |
| s1  | The registers      | …         | \`docs/knowledge/product/invariants.md\`, \`scripts/registers*\`, \`package.json\` | —          | 1    | mid  |
| s2  | The item           | …         | \`scripts/outbox.mjs\`, \`package.json\`                   | s1         | 2    | mid  |

### s1 — The registers

**Done when:** …
`;
    const slices = parsePlanSlices(planWithDecoyTable);
    expect(slices.map((slice) => slice.id)).toEqual(['s1', 's2']);
    expect(slices[0]).toMatchObject({
      id: 's1',
      title: 'The registers',
      wave: 1,
      territory: ['docs/knowledge/product/invariants.md', 'scripts/registers*', 'package.json'],
    });
  });

  it('still throws when there are id tables but none has territory column', () => {
    // Multiple `id` tables, none with `territory` column, should throw the existing message.
    const planWithMultipleIdTables = `# Plan: a plan

## Metadata

| id  | name        |
| --- | ----------- |
| 1   | Some entity |

## Slices

| id  | slice | scenarios | blocked by | wave | tier |
| --- | ----- | --------- | ---------- | ---- | ---- |
| s1  | …     | …         | —          | 1    | mid  |
`;
    expect(() => parsePlanSlices(planWithMultipleIdTables)).toThrow(
      /This plan's slice table has no `territory` column; it predates the territory discipline/,
    );
  });
});

describe('parsePlanSlices — blockedBy', () => {
  it('reads the blocked-by ids for each slice', () => {
    const slices = parsePlanSlices(PLAN);
    expect(slices.map((slice) => slice.blockedBy)).toEqual([[], ['s1'], []]);
  });

  it('reads a comma- or space-separated cell as more than one blocker', () => {
    const plan = `## Slices

| id  | slice | territory      | blocked by | wave |
| --- | ----- | -------------- | ---------- | ---- |
| s1  | A     | \`a/\`           | —          | 1    |
| s2  | B     | \`b/\`           | s1, s3     | 2    |
| s3  | C     | \`c/\`           | —          | 1    |
| s4  | D     | \`d/\`           | s1 s3      | 2    |
`;
    const slices = parsePlanSlices(plan);
    expect(slices.find((slice) => slice.id === 's2').blockedBy).toEqual(['s1', 's3']);
    expect(slices.find((slice) => slice.id === 's4').blockedBy).toEqual(['s1', 's3']);
  });

  it('reads a bare hyphen or an empty cell as no blockers', () => {
    const plan = `## Slices

| id  | slice | territory | blocked by | wave |
| --- | ----- | --------- | ---------- | ---- |
| s1  | A     | \`a/\`      | -          | 1    |
| s2  | B     | \`b/\`      |            | 1    |
`;
    const slices = parsePlanSlices(plan);
    expect(slices.map((slice) => slice.blockedBy)).toEqual([[], []]);
  });

  it('reads [] for every slice when the plan has no `blocked by` column at all', () => {
    const plan = `## Slices

| id  | slice | territory | wave |
| --- | ----- | --------- | ---- |
| s1  | A     | \`a/\`      | 1    |
`;
    const slices = parsePlanSlices(plan);
    expect(slices[0].blockedBy).toEqual([]);
  });

  it('reads a plan shaped like a real multi-wave slice table — a multi-blocker cell and a bare dash both come through', () => {
    // Same table shape as this repository's own PRD 7 plan (`id | slice | territory | blocked by |
    // wave`), inlined rather than read off disk: a live delivery plan moves from inbox/ to
    // shipped/ once its PRD ships, so a test that reads it by path goes red the moment that happens.
    const plan = `## Slices

| id  | slice              | territory   | blocked by  | wave |
| --- | ------------------ | ----------- | ----------- | ---- |
| s1  | Marketplace        | \`a/\`        | —           | 1    |
| s2  | Item and plan      | \`b/\`        | —           | 1    |
| s3  | Board              | \`c/\`        | s2          | 2    |
| s6  | Rework and phase0  | \`d/\`        | s3          | 3    |
| s7  | Plan skill         | \`e/\`        | s2, s4      | 3    |
| s9  | Yolo skill         | \`f/\`        | s7, s8      | 5    |
| s10 | Yolo-fix skill     | \`g/\`        | s6, s7, s9  | 6    |
`;
    const slices = parsePlanSlices(plan);
    const byId = (id) => slices.find((slice) => slice.id === id);
    expect(byId('s1').blockedBy).toEqual([]);
    expect(byId('s3').blockedBy).toEqual(['s2']);
    expect(byId('s10').blockedBy).toEqual(['s6', 's7', 's9']);
  });
});

describe('covers', () => {
  it('a declared directory covers what is under it', () => {
    expect(covers(['docs/knowledge/domains/'], 'docs/knowledge/domains/credits/rules.md')).toBe(
      true,
    );
  });

  it('a declared file covers itself', () => {
    expect(covers(['CLAUDE.md'], 'CLAUDE.md')).toBe(true);
  });

  it('a trailing star is a prefix, not a pattern language', () => {
    expect(covers(['scripts/registers*'], 'scripts/registers.test.mjs')).toBe(true);
    expect(covers(['scripts/registers*'], 'scripts/check-registers.mjs')).toBe(false);
  });

  it('a sibling directory whose name merely starts the same is not covered', () => {
    // Two sibling skill directories whose names merely start the same are two slices' ground in
    // the same wave; the trailing slash is what keeps them apart.
    expect(covers(['.claude/skills/vertuo-yolo/'], '.claude/skills/vertuo-yolo-fix/SKILL.md')).toBe(
      false,
    );
  });
});

describe('breaches', () => {
  const declared = ['.claude/skills/vertuo-plan/', 'scripts/check-territory*'];

  it('says nothing when every changed path is inside the declaration', () => {
    expect(
      breaches(['.claude/skills/vertuo-plan/SKILL.md', 'scripts/check-territory.mjs'], declared),
    ).toEqual([]);
  });

  it('names the path that reached outside', () => {
    expect(breaches(['.claude/skills/vertuo-plan/SKILL.md', 'package.json'], declared)).toEqual([
      'package.json',
    ]);
  });

  it('a declaration the slice never touched is not a breach', () => {
    // A slice may own ground it turns out not to need. Only reaching OUTSIDE is the signal.
    expect(breaches(['scripts/check-territory.mjs'], declared)).toEqual([]);
  });

  it('a slice that declares nothing breaches on everything it touched', () => {
    expect(breaches(['scripts/check-territory.mjs'], [])).toEqual(['scripts/check-territory.mjs']);
  });
});

describe('collisions', () => {
  it('finds the pairs whose declarations intersect, and the ground they share', () => {
    expect(collisions(parsePlanSlices(PLAN))).toEqual([
      { left: 's1', right: 's2', shared: ['package.json'] },
    ]);
  });

  it('renders the pairs as the plan is asked to print them', () => {
    expect(collisionRows(parsePlanSlices(PLAN))).toEqual([
      { pair: 's1 · s2', shared: '`package.json`', resolved: 's1 w1 · s2 w2' },
    ]);
  });
});

// Scenario: Waves come from the collision matrix
describe('Feature: Slices declare the ground they stand on — waves come from the collision matrix', () => {
  it('two slices that own an overlapping path may not share a wave', () => {
    // Given two slices that own an overlapping path, When the plan puts them in one wave…
    expect(sameWaveCollisions(parsePlanSlices(COLLIDING_PLAN))).toEqual([
      { left: 's1', right: 's2', shared: ['package.json'], wave: 1 },
    ]);
  });

  it('…and a plan that separates them by a wave is clean', () => {
    expect(sameWaveCollisions(parsePlanSlices(PLAN))).toEqual([]);
  });

  // Deleted (Task 12, per the brief): "the plan this slice is built from puts no intersecting
  // pair in one wave" — read THE_PLAN off the real upstream repository via readRepoFile. THE_PLAN
  // and its on-disk test are dropped for the kit; see kit/porting/inbox--territory.md.
});

// Scenario: A slice that reaches outside its territory is flagged
describe('Feature: Slices declare the ground they stand on — a slice that reaches outside is flagged', () => {
  const plan = parsePlanSlices(PLAN);

  it('flags the breach, names the path, and stays non-fatal so the merge proceeds', () => {
    const verdict = territoryVerdict(plan, 's6', [
      '.claude/skills/vertuo-plan/SKILL.md',
      'docs/glossary.md',
    ]);
    expect(verdict.breaches).toEqual(['docs/glossary.md']);
    expect(verdict.fatal).toBe(false);
    expect(verdict.lines.join('\n')).toContain('docs/glossary.md');
    expect(verdict.lines.join('\n')).toMatch(/s6/);
  });

  it('says so plainly when the slice stayed inside its ground', () => {
    const verdict = territoryVerdict(plan, 's6', ['scripts/check-territory.test.mjs']);
    expect(verdict.breaches).toEqual([]);
    expect(verdict.fatal).toBe(false);
    expect(verdict.lines.join('\n')).toMatch(/s6/);
  });

  it('reports a slice the plan does not hold rather than pretending it passed', () => {
    const verdict = territoryVerdict(plan, 's99', ['package.json']);
    expect(verdict.fatal).toBe(false);
    expect(verdict.lines.join('\n')).toMatch(/s99/);
    expect(verdict.unknownSlice).toBe(true);
  });
});

/** A plan repository's plan (PRD 549): a `## Repositories` table, and a `repo` column per slice. */
const MULTI_PLAN = `# Plan: across repositories

## Repositories

| repo | role | read at | knowledge |
| --- | --- | --- | --- |
| vertuo-backend-php | back-end | 3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4 | imported (stale) |
| \`vertuo-apps\` | front-end | 9b01e44c2d7a3f5e8b6c1d0a9f8e7d6c5b4a3921 | own |

## Slices

| id | repo | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- | --- |
| s1 | vertuo-backend-php | the quote total is served | \`src/\` | — | 1 |
| s2 | vertuo-apps | the quote screen shows the total | \`apps/quote/\` | s1 | 2 |
| s3 | \`vertuo-apps\` | the empty quote says why | \`src/\` | — | 1 |
`;

describe('PRD 549: a slice names its repository', () => {
  it("reads each slice's repo from a repo column, backticks stripped", () => {
    expect(parsePlanSlices(MULTI_PLAN).map((slice) => slice.repo)).toEqual([
      'vertuo-backend-php',
      'vertuo-apps',
      'vertuo-apps',
    ]);
  });

  it('reads repo: null on every slice of a table without a repo column', () => {
    expect(parsePlanSlices(PLAN).map((slice) => slice.repo)).toEqual([null, null, null]);
  });

  it('reads the ## Repositories rows in order', () => {
    expect(parsePlanRepositories(MULTI_PLAN)).toEqual([
      {
        repo: 'vertuo-backend-php',
        role: 'back-end',
        readAt: '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4',
        knowledge: 'imported (stale)',
      },
      { repo: 'vertuo-apps', role: 'front-end', readAt: '9b01e44c2d7a3f5e8b6c1d0a9f8e7d6c5b4a3921', knowledge: 'own' },
    ]);
  });

  it('reads [] for a plan with no ## Repositories table', () => {
    expect(parsePlanRepositories(PLAN)).toEqual([]);
  });

  it('the same territory in two repositories is no collision', () => {
    expect(collisions(parsePlanSlices(MULTI_PLAN))).toEqual([]);
  });

  it('the same territory twice in one repository and one wave is refused', () => {
    const same = MULTI_PLAN.replace(
      '| s2 | vertuo-apps | the quote screen shows the total | `apps/quote/` | s1 | 2 |',
      '| s2 | vertuo-apps | the quote screen shows the total | `src/quote/` | — | 1 |',
    );
    expect(sameWaveCollisions(parsePlanSlices(same))).toEqual([
      { left: 's2', right: 's3', shared: ['src/'], wave: 1 },
    ]);
  });
});
