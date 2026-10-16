import { describe, expect, it } from 'vitest';
import type { ExecText } from '../context.ts';
import { parseIssue, parsePr } from '../ids.ts';
import { openPullRequest, proofFaults, proofSection } from './proof-body.ts';
import type { ProofSource } from './proof-body.ts';

const ISSUE = parseIssue(12);
const PR = parsePr(34);
const IMAGE = '![Before and after the fix](https://omni.example/api/proofs/9f0c1d2e/preview.gif)';
const LINES = ['- **Before the fix** (red): `AssertionError`', '- **After the fix** (green, `a1b2c3d`): `✓ saves once`'];
const file = (...lines: string[]): ProofSource => ({ kind: 'file', body: lines.join('\n') });
const faults = (...lines: string[]) => proofFaults(file(...lines), ISSUE);

describe('proofSection', () => {
  it('is the text between the ## Proof heading and the next # or ## heading', () => {
    expect(proofSection('## What\n\nx\n\n## Proof\n\nthe proof\n\n## Bug\n\ny\n')).toBe('\nthe proof\n');
  });

  it('runs to the end of the body, and keeps a ### inside it', () => {
    expect(proofSection('## Proof\n### GIF\nthe proof')).toBe('### GIF\nthe proof');
  });

  it('stops at a # heading too', () => {
    expect(proofSection('## Proof\nthe proof\n# Other\nnot it')).toBe('the proof');
  });

  it('reads CRLF line ends, trailing hashes and blanks after the heading', () => {
    expect(proofSection('## Proof ##  \r\nthe proof\r\n')).toBe('the proof\n');
  });

  it('is the first section when there are two, and undefined when there is none', () => {
    expect(proofSection('## Proof\none\n## Proof\ntwo')).toBe('one');
    expect(proofSection('## Proofs\nx\n### Proof\ny\nProof\n')).toBeUndefined();
    expect(proofSection('')).toBeUndefined();
  });
});

describe('proofFaults', () => {
  it('has none for an https image with its two lines', () => {
    expect(faults('## Proof', IMAGE, ...LINES)).toEqual([]);
  });

  it('has none for a not-produced line with a reason, whatever else the section says', () => {
    expect(faults('## Proof', 'GIF not produced - ffmpeg not found')).toEqual([]);
    expect(faults('## Proof', '  GIF not produced - the pinned omni is too old: run omni update')).toEqual([]);
    expect(faults('## Proof', IMAGE, 'GIF not produced - ffmpeg not found')).toEqual([]);
  });

  it('is no section when the heading is missing', () => {
    expect(faults('Closes #12', IMAGE, ...LINES)).toEqual(['no ## Proof section']);
  });

  it('is no image and no not-produced line for prose, a bare dash, or an image that is not https', () => {
    const line = '## Proof has no image and no "GIF not produced - <reason>" line';
    expect(faults('## Proof', 'It works.')).toEqual([line]);
    expect(faults('## Proof', 'GIF not produced -')).toEqual([line]);
    expect(faults('## Proof', 'GIF not produced - ')).toEqual([line]);
    expect(faults('## Proof', 'GIF not produced')).toEqual([line]);
    expect(faults('## Proof', '![x](http://omni.example/a.gif)', ...LINES)).toEqual([line]);
    expect(faults('## Proof', '[x](https://omni.example/a.gif)', ...LINES)).toEqual([line]);
    expect(faults('## Proof', '')).toEqual([line]);
  });

  it('is an image with no Before or After line when either is missing', () => {
    const line = '## Proof\'s image has no "Before the fix" or "After the fix" line';
    expect(faults('## Proof', IMAGE)).toEqual([line]);
    expect(faults('## Proof', IMAGE, LINES[0] ?? '')).toEqual([line]);
    expect(faults('## Proof', IMAGE, LINES[1] ?? '')).toEqual([line]);
    expect(faults('## Proof', IMAGE, '* **Before the fix**', '* **After the fix**')).toEqual([line]);
  });

  it('reads an indented Before and After line', () => {
    expect(faults('## Proof', IMAGE, ...LINES.map((line) => `  ${line}`))).toEqual([]);
  });

  it('says how to proceed, with the issue\'s number, when there is no body', () => {
    expect(proofFaults({ kind: 'none' }, ISSUE)).toEqual([
      'no pull request body to check: make the GIF (omni bug film 12 --before <red> --after <green>, then omni proof push --kind bug 12 <folder>), ' +
        'write the body with its ## Proof section to a file, and rerun omni bug 12 --body-file <file>; ' +
        'with no GIF, ## Proof is the line GIF not produced - <reason> and the pull request opens as a draft',
    ]);
  });

  describe('of an open pull request', () => {
    const pull = (isDraft: boolean, ...lines: string[]): ProofSource => ({ kind: 'pull-request', body: lines.join('\n'), pr: PR, isDraft });

    it('asks for a draft when the proof was not produced and the pull request is not one', () => {
      expect(proofFaults(pull(false, '## Proof', 'GIF not produced - ffmpeg not found'), ISSUE)).toEqual([
        'the proof was not produced but #34 is not a draft: gh pr ready 34 --undo',
      ]);
    });

    it('is content with a draft that says so, and with a filmed proof on either', () => {
      expect(proofFaults(pull(true, '## Proof', 'GIF not produced - ffmpeg not found'), ISSUE)).toEqual([]);
      expect(proofFaults(pull(false, '## Proof', IMAGE, ...LINES), ISSUE)).toEqual([]);
      expect(proofFaults(pull(true, '## Proof', IMAGE, ...LINES), ISSUE)).toEqual([]);
    });

    it('does not ask for a draft when the proof has a fault of its own, or when a filmed proof also carries the line', () => {
      expect(proofFaults(pull(false, '## Proof', 'GIF not produced -'), ISSUE)).toEqual([
        '## Proof has no image and no "GIF not produced - <reason>" line',
      ]);
      expect(proofFaults(pull(false, 'Closes #12'), ISSUE)).toEqual(['no ## Proof section']);
      expect(proofFaults(pull(false, '## Proof', IMAGE, ...LINES, 'GIF not produced - x'), ISSUE)).toEqual([]);
    });

    it('asks nothing of a draft in a body read from a file', () => {
      expect(faults('## Proof', 'GIF not produced - ffmpeg not found')).toEqual([]);
    });
  });
});

describe('openPullRequest', () => {
  type Call = { file: string; args: readonly string[]; cwd: unknown };

  /** An exec answering `gh` with `answer`, or throwing it, and recording what it was asked. */
  function exec(answer: string | Error) {
    const calls: Call[] = [];
    const run: ExecText = (file, args, options) => {
      calls.push({ file, args, cwd: options.cwd });
      if (answer instanceof Error) throw answer;
      return answer;
    };
    return { run, calls };
  }
  const read = (answer: string | Error) => openPullRequest({ root: '/repo', exec: exec(answer).run });
  const json = (over: Record<string, unknown> = {}) => JSON.stringify({ body: 'the body', isDraft: false, state: 'OPEN', number: 34, ...over });

  it('runs gh pr view for the checked-out branch, in the root, asking for body, isDraft, state and number', () => {
    const fake = exec(json());
    openPullRequest({ root: '/repo', exec: fake.run });
    expect(fake.calls).toEqual([{ file: 'gh', args: ['pr', 'view', '--json', 'body,isDraft,state,number'], cwd: '/repo' }]);
  });

  it('is the pull request an OPEN answer names, with its body, number and draft state', () => {
    expect(read(json())).toEqual({ kind: 'pull-request', body: 'the body', pr: PR, isDraft: false });
    expect(read(json({ isDraft: true }))).toMatchObject({ isDraft: true });
    expect(read(json({ body: null }))).toMatchObject({ body: '' });
  });

  it.each([
    ['a closed pull request', json({ state: 'CLOSED' })],
    ['a merged pull request', json({ state: 'MERGED' })],
    ['a pull request number of zero', json({ number: 0 })],
    ['a pull request with no draft flag', json({ isDraft: undefined })],
    ['text that is not JSON', 'run gh auth login'],
    ['JSON that is not a pull request', '[]'],
    ['gh failing', new Error('no pull requests found for branch')],
  ])('is none for %s', (_name: string, answer: string | Error) => {
    expect(read(answer)).toEqual({ kind: 'none' });
  });
});
