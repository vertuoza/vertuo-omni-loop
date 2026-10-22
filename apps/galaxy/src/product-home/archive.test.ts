import { describe, expect, it } from 'vitest';
import { ago, archiveConfirm, archivedLine } from './archive';

// The words of Archive (PRD 2232 s1): the confirm the browser asks, naming the repositories that stop
// reading the product, and the archived banner's line.

const NOW = Date.parse('2026-10-20T12:00:00Z');

describe('the confirm Archive asks', () => {
  it('says what archiving does, and names the repositories when the product has any', () => {
    expect(archiveConfirm('omni-loop', [])).toBe(
      'Archive omni-loop? It leaves every member\'s list, and its repositories stop reading its Legal entries and glossary.');
    expect(archiveConfirm('omni-loop', ['vertuoza/vertuo-omni-loop', 'demo-org/omni-docs'])).toBe(
      'Archive omni-loop? It leaves every member\'s list, and its repositories stop reading its Legal entries and glossary.'
      + '\n\nRepositories: vertuoza/vertuo-omni-loop, demo-org/omni-docs');
  });
});

describe('the archived banner', () => {
  it('says how long ago, in minutes, hours or days, one or many', () => {
    expect(ago('2026-10-20T11:59:30Z', NOW)).toBe('just now');
    expect(ago('2026-10-20T11:59:00Z', NOW)).toBe('1 minute ago');
    expect(ago('2026-10-20T11:15:00Z', NOW)).toBe('45 minutes ago');
    expect(ago('2026-10-20T11:00:00Z', NOW)).toBe('1 hour ago');
    expect(ago('2026-10-20T01:00:00Z', NOW)).toBe('11 hours ago');
    expect(ago('2026-10-19T12:00:00Z', NOW)).toBe('1 day ago');
    expect(ago('2026-10-18T09:00:00Z', NOW)).toBe('2 days ago');
  });

  it('reads a time in the future, or none, as just now', () => {
    expect(ago('2026-10-21T12:00:00Z', NOW)).toBe('just now');
    expect(ago('not a time', NOW)).toBe('just now');
  });

  it('names who archived it, and leaves the name out when none is known', () => {
    expect(archivedLine({ at: '2026-10-18T09:00:00Z', by: 'pierrederval' }, NOW)).toBe('Archived 2 days ago by pierrederval.');
    expect(archivedLine({ at: '2026-10-18T09:00:00Z', by: null }, NOW)).toBe('Archived 2 days ago.');
  });
});
