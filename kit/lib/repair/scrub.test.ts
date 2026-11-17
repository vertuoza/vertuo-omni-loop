// The public report of an Omni Loop bug (PRD 2980 s1, AC-6): fixed fields only, the message scrubbed of every path, repository
// name, login, email, URL and token-shaped string, and no report at all when something still looks sensitive.
import { describe, expect, it } from 'vitest';
import { PublicReportSchema, scrub, type ScrubInput } from './scrub.ts';

const FINGERPRINT = 'b'.repeat(64);
const ghToken = 'ghp_' + 'Q'.repeat(36);
const unknownToken = ['Zx9Q', 'w2Lm', '4Np6', 'Rt8V', 'b0Cd', '3Fg5'].join('');

const input = (over: Partial<ScrubInput> = {}): ScrubInput => ({
  kitVersion: '0.0.659',
  command: '/omni:yolo',
  class: 'omni-loop',
  message: 'omni next crashed',
  fingerprint: FINGERPRINT,
  ...over,
});

const SENSITIVE = [
  '/Users/octo-dev/work/widgets/src/a.ts',
  'acme/widgets',
  'octo-dev',
  'dev@acme.example',
  'https://github.com/acme/widgets/pull/12',
  ghToken,
  'C:\\Users\\octo-dev\\widgets',
  'billing-export.ts',
  'Acme Corp',
];

describe('scrub', () => {
  it('removes every path, repository name, login, email, URL and token a message holds, and keeps the fixed fields', () => {
    const message = [
      'omni board crashed reading /Users/octo-dev/work/widgets/src/a.ts of acme/widgets for @octo-dev',
      '(dev@acme.example) at https://github.com/acme/widgets/pull/12 with',
      `token=${ghToken} under C:\\Users\\octo-dev\\widgets near billing-export.ts for Acme Corp`,
    ].join('\n');
    const scrubbed = scrub(input({ message, known: ['octo-dev', 'acme', 'widgets', 'Acme Corp'] }));
    expect(scrubbed.ok).toBe(true);
    if (!scrubbed.ok) return;
    const { report } = scrubbed;
    for (const shape of SENSITIVE) expect(report.message, shape).not.toContain(shape);
    expect(report.message).toContain('omni board crashed reading');
    expect(report.message).not.toMatch(/[\r\n]/);
    expect(report).toMatchObject({ kitVersion: '0.0.659', command: '/omni:yolo', class: 'omni-loop', fingerprint: FINGERPRINT });
    expect(Object.keys(report).sort()).toEqual(['class', 'command', 'fingerprint', 'kitVersion', 'message']);
    expect(PublicReportSchema.safeParse(report).success).toBe(true);
  });

  it('removes a name the caller knows wherever it stands, whatever its case', () => {
    const scrubbed = scrub(input({ message: 'the Widgets plan of OCTO-DEV broke', known: ['widgets', 'octo-dev'] }));
    expect(scrubbed).toMatchObject({ ok: true, report: { message: 'the <name> plan of <name> broke' } });
  });

  it('removes a commit hash and keeps a plain number', () => {
    const scrubbed = scrub(input({ message: 'step 3 failed at f9e8d7c6b5a4f9e8d7c6b5a4f9e8d7c6b5a4f9e8' }));
    expect(scrubbed).toMatchObject({ ok: true, report: { message: 'step 3 failed at <hash>' } });
  });

  it('keeps the command alone, without its arguments', () => {
    expect(scrub(input({ command: '/omni:yolo 2980 --base mission/12-acme' }))).toMatchObject({ ok: true, report: { command: '/omni:yolo' } });
    expect(scrub(input({ command: 'omni runner work --repo acme/widgets' }))).toMatchObject({ ok: true, report: { command: 'omni runner work' } });
  });

  it('refuses a message that still holds a token-shaped string after scrubbing', () => {
    const scrubbed = scrub(input({ message: `the runner sent ${unknownToken} and was refused` }));
    expect(scrubbed.ok).toBe(false);
    if (scrubbed.ok) return;
    expect(scrubbed.reason).toMatch(/token-shaped/);
    expect(scrubbed).not.toHaveProperty('report');
  });

  it('refuses a report whose fixed fields are not what they say', () => {
    expect(scrub(input({ kitVersion: 'latest' })).ok).toBe(false);
    expect(scrub(input({ command: 'rm -rf /' })).ok).toBe(false);
    expect(scrub(input({ fingerprint: 'not-hex' })).ok).toBe(false);
    expect(scrub(input({ message: '   ' })).ok).toBe(false);
  });

  it('cuts a long message', () => {
    const scrubbed = scrub(input({ message: 'word '.repeat(200) }));
    expect(scrubbed.ok && scrubbed.report.message.length).toBeLessThanOrEqual(300);
  });
});

describe('PublicReportSchema', () => {
  it('refuses a report whose message holds a sensitive shape', () => {
    const report = { kitVersion: '0.0.659', command: '/omni:yolo', class: 'omni-loop', fingerprint: FINGERPRINT };
    expect(PublicReportSchema.safeParse({ ...report, message: 'omni next crashed' }).success).toBe(true);
    for (const message of [`sent ${unknownToken}`, 'mail dev@acme.example', 'see https://acme.example', 'in /home/dev/a.ts', 'for @octo-dev']) {
      expect(PublicReportSchema.safeParse({ ...report, message }).success, message).toBe(false);
    }
  });
});
