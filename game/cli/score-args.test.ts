import { describe, it, expect } from 'vitest';
import { scoreArgs } from './score-args.ts';

describe('game:score arguments', () => {
  it('reads a season and a rankings file, in either order, or neither', () => {
    expect(scoreArgs([])).toEqual({ season: null, rankings: null });
    expect(scoreArgs(['2026-08'])).toEqual({ season: '2026-08', rankings: null });
    expect(scoreArgs(['--rankings', 'out.md'])).toEqual({ season: null, rankings: 'out.md' });
    expect(scoreArgs(['2026-08', '--rankings', 'out.md'])).toEqual({ season: '2026-08', rankings: 'out.md' });
    expect(scoreArgs(['--rankings', 'out.md', '2026-08'])).toEqual({ season: '2026-08', rankings: 'out.md' });
  });

  it('refuses what it does not understand rather than scoring the wrong season', () => {
    expect(() => scoreArgs(['--rankings'])).toThrow(/needs a file/);
    expect(() => scoreArgs(['august'])).toThrow(/unexpected argument "august"/);
    expect(() => scoreArgs(['2026-08', '2026-09'])).toThrow(/unexpected/);
  });
});
