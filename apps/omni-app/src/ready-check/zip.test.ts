import { describe, expect, it } from 'vitest';
import { unzipText, UNZIPPED_MAX } from './zip.ts';
import { zipOf } from './zip.fake.ts';

describe('unzipText — one file of an artifact', () => {
  it('reads a file deflated or stored, by its path or its last segment', () => {
    const zip = zipOf({ 'README.md': 'no', '.acceptance/report.json': '{"a":1}' });
    expect(unzipText(zip, 'report.json')).toEqual({ ok: true, text: '{"a":1}' });
    expect(unzipText(zip, '.acceptance/report.json')).toEqual({ ok: true, text: '{"a":1}' });
    expect(unzipText(zipOf({ 'report.json': 'stored' }, { stored: true }), 'report.json')).toEqual({ ok: true, text: 'stored' });
  });

  it('refuses what is no archive, a file it does not hold, and one over its bound', () => {
    expect(unzipText(Buffer.from('not a zip at all, but long enough to scan'), 'report.json')).toEqual({ ok: false, why: 'the artifact is not a zip archive' });
    expect(unzipText(zipOf({ 'other.json': '{}' }), 'report.json')).toEqual({ ok: false, why: 'the artifact holds no report.json' });
    expect(unzipText(zipOf({ 'report.json': 'x'.repeat(UNZIPPED_MAX + 1) }), 'report.json')).toEqual({ ok: false, why: `report.json is over ${String(UNZIPPED_MAX)} bytes` });
  });
});
