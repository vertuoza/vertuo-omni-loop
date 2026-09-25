import { describe, expect, it } from 'vitest';
import { planCollisions, planFromMarkdown } from './collisions.mjs';

/**
 * A minimal plan in the shape `parsePlanSlices` reads (PRD #985): a slice table with a
 * `territory` column. Only the columns these fixtures need are filled in; the others are
 * irrelevant to a collision check.
 */
function plan(rows) {
  return `## Slices

| id  | slice | scenarios | territory | blocked by | wave | tier |
| --- | ----- | --------- | --------- | ---------- | ---- | ---- |
${rows.join('\n')}
`;
}

function row(id, territory) {
  return `| ${id}  | …     | …         | ${territory} | —          | 1    | mid  |`;
}

describe('planCollisions', () => {
  it('reports two plans declaring an overlapping path as colliding, naming the shared path', () => {
    const left = planFromMarkdown(1001, plan([row('s1', '`libs/vertuo-domain-tenant/`')]));
    const right = planFromMarkdown(1002, plan([row('s1', '`libs/vertuo-domain-tenant/`')]));

    expect(planCollisions([left, right])).toEqual([
      { left: 1001, right: 1002, shared: ['libs/vertuo-domain-tenant/'] },
    ]);
  });

  it('reports nothing for two plans whose declared territory is disjoint', () => {
    const left = planFromMarkdown(1001, plan([row('s1', '`libs/vertuo-domain-tenant/`')]));
    const right = planFromMarkdown(1002, plan([row('s1', '`libs/vertuo-domain-payment/`')]));

    expect(planCollisions([left, right])).toEqual([]);
  });

  it('does not invent a collision from a path only one plan declares', () => {
    // s1 of the left plan owns a path nobody else declares; s2 declares nothing at all (a dash,
    // same as an unwritten cell). Neither should leak into a collision report — only the path the
    // two plans actually share may appear, and only once.
    const left = planFromMarkdown(
      1001,
      plan([row('s1', '`docs/inbox/`, `scripts/inbox-collisions.mjs`'), row('s2', '—')]),
    );
    const right = planFromMarkdown(1002, plan([row('s1', '`docs/inbox/`')]));

    expect(planCollisions([left, right])).toEqual([
      { left: 1001, right: 1002, shared: ['docs/inbox/'] },
    ]);
  });

  it('pairs three or more plans rather than assuming exactly two', () => {
    // A-B share one path, B-C share a different path, A-C share nothing.
    const a = planFromMarkdown(1, plan([row('s1', '`scripts/inbox-collisions.mjs`')]));
    const b = planFromMarkdown(
      2,
      plan([row('s1', '`scripts/inbox-collisions.mjs`'), row('s2', '`docs/inbox/`')]),
    );
    const c = planFromMarkdown(3, plan([row('s1', '`docs/inbox/`')]));

    expect(planCollisions([a, b, c])).toEqual([
      { left: 1, right: 2, shared: ['scripts/inbox-collisions.mjs'] },
      { left: 2, right: 3, shared: ['docs/inbox/'] },
    ]);
  });

  it('takes already-parsed plan slices too, with no markdown or I/O involved', () => {
    const left = { prd: 7, slices: [{ id: 's1', territory: ['CLAUDE.md'] }] };
    const right = { prd: 8, slices: [{ id: 's1', territory: ['CLAUDE.md'] }] };

    expect(planCollisions([left, right])).toEqual([{ left: 7, right: 8, shared: ['CLAUDE.md'] }]);
  });

  it('reports rather than throwing or blocking when plans collide', () => {
    const left = planFromMarkdown(1, plan([row('s1', '`docs/inbox/`')]));
    const right = planFromMarkdown(2, plan([row('s1', '`docs/inbox/`')]));

    expect(() => planCollisions([left, right])).not.toThrow();
  });
});
