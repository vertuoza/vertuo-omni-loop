// A milestone retro (PRD 3065 s1): 1 to 5 cited sentences under each side, never a log excerpt (AC-10).
import { describe, expect, it } from 'vitest';
import { MissionRetroSchema, retroLine, retroRecordLine } from './retro.ts';

const sentence = (text: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  text,
  cites: [{ kind: 'prd', ref: 2950 }],
  ...over,
});

const retro = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  wentWell: [sentence('The build and QA chain of the first PRD ran clean.')],
  toChange: [sentence('The second PRD waited two rounds on a blocked review.', { cites: [{ kind: 'event', ref: 41 }] })],
  ...over,
});

const refusal = (value: unknown): string => {
  const parsed = MissionRetroSchema.safeParse(value);
  expect(parsed.success).toBe(false);
  return parsed.success ? '' : parsed.error.issues.map((issue) => issue.message).join(' | ');
};

describe('MissionRetroSchema', () => {
  it('accepts 1 to 5 sentences on each side, each citing an event, a PRD, a pull request or a repair', () => {
    expect(MissionRetroSchema.safeParse(retro()).success).toBe(true);
    const five = Array.from({ length: 5 }, (_, i) => sentence(`Sentence number ${String(i + 1)} stands alone.`, { cites: [{ kind: 'repair', ref: i + 1 }] }));
    expect(MissionRetroSchema.safeParse(retro({ wentWell: five, toChange: five })).success).toBe(true);
    for (const kind of ['event', 'prd', 'pr', 'repair']) {
      expect(MissionRetroSchema.safeParse(retro({ wentWell: [sentence('One cited sentence.', { cites: [{ kind, ref: 7 }] })] })).success).toBe(true);
    }
  });

  it('refuses a sentence that cites nothing, naming it (AC-10)', () => {
    const message = refusal(retro({ wentWell: [sentence('Everything went smoothly.', { cites: [] })] }));
    expect(message).toContain('Everything went smoothly.');
    expect(message).toContain('cites no event, PRD, pull request or repair');
  });

  it('refuses an empty side and a sixth sentence', () => {
    expect(refusal(retro({ wentWell: [] }))).not.toBe('');
    expect(refusal(retro({ toChange: [] }))).not.toBe('');
    const six = Array.from({ length: 6 }, (_, i) => sentence(`Sentence ${String(i)} is here.`));
    expect(refusal(retro({ toChange: six }))).not.toBe('');
  });

  it('refuses a log excerpt shape: several lines, a time stamp, a second sentence, a credential', () => {
    expect(refusal(retro({ wentWell: [sentence('line one\nline two')] }))).not.toBe('');
    expect(refusal(retro({ wentWell: [sentence('12:00:01 npm ERR! code ELIFECYCLE')] }))).not.toBe('');
    expect(refusal(retro({ wentWell: [sentence('It ran. Then it failed.')] }))).not.toBe('');
    expect(refusal(retro({ wentWell: [sentence('The key was ' + 'ghp_' + 'a'.repeat(36) + '.')] }))).not.toBe('');
    expect(refusal(retro({ wentWell: [sentence('x'.repeat(300))] }))).not.toBe('');
  });

  it('refuses an unknown citation kind, a non-positive ref and an unknown key', () => {
    expect(refusal(retro({ wentWell: [sentence('A sentence.', { cites: [{ kind: 'log', ref: 1 }] })] }))).not.toBe('');
    expect(refusal(retro({ wentWell: [sentence('A sentence.', { cites: [{ kind: 'prd', ref: 0 }] })] }))).not.toBe('');
    expect(refusal(retro({ log: 'raw output' }))).not.toBe('');
  });
});

const item = {
  target: { kind: 'form', form: 'testing', section: 'Never' },
  wording: 'A test never leaves a clock running.',
  evidence: [sentence('Two repairs traced to a test that kept a clock running.', { cites: [{ kind: 'repair', ref: 3 }] })],
};

const record = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  v: 1,
  mission: 12,
  milestone: '2950',
  retro: retro(),
  file: 'missions/12-launch/retros/1-2950.md',
  items: [item],
  ...over,
});

const line = (value: Record<string, unknown>): string => `omni retro: ${JSON.stringify(value)}`;

describe('retroLine', () => {
  it('reads the last record line of a log, a time stamp before it or not', () => {
    const log = ['12:00:00 working', `12:00:01 ${line(record({ file: null }))}`, 'noise', `12:00:09 ${line(record({ milestone: 'mission' }))}`].join('\n');
    const read = retroLine(log);
    expect(read.readable).toBe(true);
    if (!read.readable) return;
    expect(read.record).toMatchObject({ mission: 12, milestone: 'mission', file: 'missions/12-launch/retros/1-2950.md' });
    expect(read.record.items).toHaveLength(1);
  });

  it('reads a retro with no file (with-you) and no items', () => {
    const read = retroLine(line(record({ file: null, items: [] })));
    expect(read).toMatchObject({ readable: true, record: { file: null, items: [] } });
  });

  it('answers unreadable when the log holds none, or the last one is malformed', () => {
    expect(retroLine('')).toEqual({ readable: false, reason: 'missing' });
    expect(retroLine('omni repair: {}')).toEqual({ readable: false, reason: 'missing' });
    expect(retroLine('omni retro: {nope')).toEqual({ readable: false, reason: 'malformed' });
    expect(retroLine([line(record()), 'omni retro: {"v":1}'].join('\n'))).toEqual({ readable: false, reason: 'malformed' });
    expect(retroLine(line(record({ v: 2 })))).toEqual({ readable: false, reason: 'malformed' });
    expect(retroLine(line(record({ milestone: 'roadmap' })))).toEqual({ readable: false, reason: 'malformed' });
    expect(retroLine(line(record({ milestone: '0' })))).toEqual({ readable: false, reason: 'malformed' });
    expect(retroLine(line(record({ retro: retro({ wentWell: [] }) })))).toEqual({ readable: false, reason: 'malformed' });
    expect(retroLine(line(record({ items: [{ ...item, wording: '' }] })))).toEqual({ readable: false, reason: 'malformed' });
  });

  it('refuses a file path that leaves the mission folder', () => {
    expect(retroLine(line(record({ file: '../outside.md' })))).toEqual({ readable: false, reason: 'malformed' });
    expect(retroLine(line(record({ file: '/etc/passwd' })))).toEqual({ readable: false, reason: 'malformed' });
  });

  it('writes the line it reads', () => {
    const read = retroLine(line(record()));
    expect(read.readable).toBe(true);
    if (!read.readable) return;
    expect(retroRecordLine(read.record).startsWith('omni retro: {"v":1,')).toBe(true);
    expect(retroLine(retroRecordLine(read.record))).toEqual(read);
  });
});
