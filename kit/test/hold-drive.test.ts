// PRD 2746, slice s4: `/omni:drive` and `/omni:mega-drive` park a PRD whose pull request `omni hold`
// reads as held, read it again each tick, mark it ready through `/omni:pr` once it is clear, and report a
// probe still on `wait` past `limits.stallDays` as stuck. The guide explains the hold and the point.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skill = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8');
const guide = (name: string) => readFileSync(new URL(`../../docs/guide/${name}.md`, import.meta.url), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');

describe.each(['drive', 'mega-drive'])('/omni:%s holds a PRD on its provider', (name) => {
  const text = flat(skill(name));

  it('reads the hold with omni hold, as json, each tick', () => {
    expect(text).toMatch(/omni\.mjs hold <[^>]+>#<[^>]+> --json/);
    expect(text).toContain('each tick');
  });

  it('parks a held PRD on the waiting line', () => {
    expect(text).toContain('waiting for <owner/repo>#<n> to be served: <why>');
    expect(text).toContain('parks it');
  });

  it('marks it ready through /omni:pr once it is clear', () => {
    expect(text).toContain('through `/omni:pr`');
    expect(text).toContain('clear');
  });

  it('reports a probe on wait past limits.stallDays as stuck, naming the provider and the last reason', () => {
    expect(text).toContain('limits.stallDays');
    expect(text).toContain('stuck');
    expect(text).toContain('the last reason');
  });

  it('notifies nobody beyond the status comment', () => {
    expect(text).toContain('Nothing else notifies anyone');
  });
});

describe('the guide explains the hold', () => {
  it('flow.md lists the point and its wait verdict', () => {
    const text = flat(guide('flow'));
    expect(text).toContain('`merge-after.served`');
    expect(text).toContain('wait <why>');
  });

  it('several-repositories.md explains the Merge after line and the hold with a fictional example', () => {
    const text = flat(guide('several-repositories'));
    expect(text).toContain('`Merge after <owner/repo>#<n>`');
    expect(text).toContain('omni hold demo-org/web#88');
    expect(text).toContain('demo-org/api#41');
  });
});
