import { describe, expect, it } from 'vitest';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { FixStampDataSchema, fixedRecordOf, fixStampId } from './fix-stamp.ts';

describe('fixedRecordOf — the bug record a fix pull request\'s body names (PRD 2011 s7)', () => {
  it('reads `Fixes <key>-B<n>` at the start of a line, the line /omni:mega-bug-fix --product writes', () => {
    expect(fixedRecordOf('Fixes mobile-B74 · https://omni.example/bugs/mobile-B74\n\nReproduction: …')).toBe('mobile-B74');
    expect(fixedRecordOf('The guard.\n\nFixes web-app-B3')).toBe('web-app-B3');
    expect(fixedRecordOf('   Fixes mobile-B1')).toBe('mobile-B1');
  });

  it('takes the first record a body names', () => {
    expect(fixedRecordOf('Fixes mobile-B74\nFixes mobile-B75')).toBe('mobile-B74');
  });

  it('reads none from a mention, a code block, another id or a malformed one', () => {
    for (const body of [
      null,
      undefined,
      '',
      'This Fixes mobile-B74 mid-sentence',
      '`Fixes mobile-B74`',
      '```\nFixes mobile-B74\n```',
      '    Fixes mobile-B74',
      'Fixes #74',
      'Fixes mobile-74',
      'Fixes mobile-R3',
      'fixes mobile-B74',
      'Fixes Mobile-B74',
      'Fixes mobile-b74',
      'Fixes mobile-B074',
      'Fixes mobile-B0',
      'Fixes mobile-B74x',
      'Fixes mobile-B74-2',
      `Fixes ${'a'.repeat(41)}-B1`,
    ]) {
      expect(fixedRecordOf(body), String(body)).toBeNull();
    }
  });

  it('reads a later line when the first `Fixes` line names no record', () => {
    expect(fixedRecordOf('Fixes #12\nFixes mobile-B9')).toBe('mobile-B9');
  });
});

describe('the fix stamp event', () => {
  const data = { installationId: 7, repository: 'Acme/API', prNumber: 446, kind: 'merged', at: '2026-10-16T09:00:00Z', bug: null };

  it('takes a pull request of owner/name, merged, closed or reopened, at a time, naming a record or none', () => {
    expect(FixStampDataSchema.parse(data)).toEqual(data);
    expect(FixStampDataSchema.parse({ ...data, kind: 'closed', bug: 'mobile-B74' }).bug).toBe('mobile-B74');
  });

  it('refuses a malformed one by its field', () => {
    for (const [field, value] of [
      ['repository', 'api'],
      ['repository', 'acme/api/x'],
      ['prNumber', 0],
      ['kind', 'opened'],
      ['at', 'yesterday'],
      ['bug', 'mobile-74'],
    ] as const) {
      const read = FixStampDataSchema.safeParse({ ...data, [field]: value });
      expect(read.success, `${field}: ${String(value)}`).toBe(false);
      expect(read.error?.issues[0]?.path).toEqual([field]);
    }
  });

  it('has one id per pull request, change and time, whatever the case of the repository', () => {
    const one = { repository: 'Acme/API', prNumber: parsePr(446), kind: 'merged' as const, at: '2026-10-16T09:00:00Z' };
    expect(fixStampId(one)).toBe('fix-stamp:acme/api#446:merged:2026-10-16T09:00:00Z');
    expect(fixStampId({ ...one, repository: 'acme/api' })).toBe(fixStampId(one));
    expect(new Set([fixStampId(one), fixStampId({ ...one, kind: 'closed' }), fixStampId({ ...one, prNumber: parsePr(447) }), fixStampId({ ...one, at: '2026-10-16T09:00:01Z' })]).size).toBe(4);
  });
});
