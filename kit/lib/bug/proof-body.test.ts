import { describe, expect, it } from 'vitest';
import type { ExecText } from '../context.ts';
import { parseIssue, parsePr } from '../ids.ts';
import { openPullRequest, proofFaults, proofSection } from './proof-body.ts';
import type { ProofSource } from './proof-body.ts';

const ISSUE = parseIssue(12);
const PR = parsePr(34);
const IMAGE = '![Before and after the fix](https://omni.example/api/proofs/9f0c1d2e/preview.gif)';
const LINES = ['- **Before the fix** (red): `AssertionError`', '- **After the fix** (green, `a1b2c3d`): `✓ saves once`'];
const PROVED = '- **Proved on:** the machine that made the fix · reproduction test only, the screen was not filmed';
const D = 'GIF not produced - A: no bug-fix.proof hook; B: job story skipped; C: red not proven here';
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
    expect(faults('## Proof', IMAGE, ...LINES, PROVED)).toEqual([]);
  });

  describe('Proved on', () => {
    const proof = (...lines: string[]) => faults('## Proof', IMAGE, ...LINES, ...lines);

    it('passes at level A with its Preview line', () => {
      expect(proof('- **Proved on:** a preview environment', '- **Preview:** https://pr-34.example · until the pull request closes')).toEqual([]);
    });

    it('passes at level B and at level C with the not-filmed mention', () => {
      expect(proof('- **Proved on:** CI · reproduction test only, the screen was not filmed')).toEqual([]);
      expect(proof(PROVED)).toEqual([]);
    });

    it('passes at level C for a component filmed in Storybook, beside its Clips line', () => {
      expect(
        proof('- **Proved on:** the machine that made the fix · the component filmed in Storybook', 'Clips: [before](https://omni.example/b.webm) · [after](https://omni.example/a.webm)'),
      ).toEqual([]);
    });

    it('refuses a GIF without a Proved on line', () => {
      expect(proof()).toEqual(['## Proof has no "Proved on" line']);
    });

    it('refuses a B or C line without the not-filmed mention', () => {
      const mention = '## Proof\'s "Proved on" line has no "reproduction test only, the screen was not filmed" mention';
      expect(proof('- **Proved on:** CI')).toEqual([mention]);
      expect(proof('- **Proved on:** the machine that made the fix')).toEqual([mention]);
    });

    it('refuses the Storybook line without a Clips line', () => {
      expect(proof('- **Proved on:** the machine that made the fix · the component filmed in Storybook')).toEqual([
        '## Proof\'s "the component filmed in Storybook" line has no "Clips:" line',
      ]);
    });

    it('refuses level A without its Preview line', () => {
      expect(proof('- **Proved on:** a preview environment')).toEqual(['## Proof\'s "Proved on: a preview environment" has no "Preview" line']);
    });

    it('refuses a Proved on line that names no level', () => {
      expect(proof('- **Proved on:** my laptop')).toEqual([
        '## Proof\'s "Proved on" line names no level: a preview environment, CI or the machine that made the fix',
      ]);
    });

    it('keeps the Before and After rules unchanged', () => {
      expect(faults('## Proof', IMAGE, PROVED)).toEqual(['## Proof\'s image has no "Before the fix" or "After the fix" line']);
    });
  });

  describe('GIF not produced at level D', () => {
    it('refuses a level with no reason, each on its own line', () => {
      expect(faults('## Proof', 'GIF not produced - A: no hook; B: job story skipped')).toEqual(['## Proof\'s "GIF not produced" line has no reason for level C']);
      expect(faults('## Proof', 'GIF not produced - A: ; B: ; C: red not proven here')).toEqual([
        '## Proof\'s "GIF not produced" line has no reason for level A',
        '## Proof\'s "GIF not produced" line has no reason for level B',
      ]);
    });

    it('refuses a bare reason: every level answers', () => {
      expect(faults('## Proof', 'GIF not produced - ffmpeg not found')).toEqual([
        '## Proof\'s "GIF not produced" line has no reason for level A',
        '## Proof\'s "GIF not produced" line has no reason for level B',
        '## Proof\'s "GIF not produced" line has no reason for level C',
      ]);
    });

    it('allows a semicolon inside a reason', () => {
      expect(faults('## Proof', 'GIF not produced - A: none; still none; B: gh failed: x; y; C: red not proven here')).toEqual([]);
    });

    const B_FAULT = (why: string) =>
      `## Proof's "GIF not produced" line gives level B a reason omni bug ci does not print ("${why}"): run omni bug ci on the draft and write its line`;
    const C_FAULT = (why: string) =>
      `## Proof's "GIF not produced" line gives level C a reason it does not have ("${why}"): ` +
      'level C is reached whenever red.txt and green.txt exist, so film them with omni bug film; ' +
      'its reasons are red not proven here, the pinned omni is too old: run omni update, or the line omni bug film or omni proof push exits 1 with';

    it('takes every line omni bug ci exits 1 with as level B\'s reason', () => {
      for (const why of [
        'job e2e skipped',
        'job unit tests did not run on a1b2c3d',
        'job unit did not pass on a1b2c3d',
        'no failed log names saves once',
        'every check passed on a1b2c3d',
        'the runs did not finish within 30 minutes',
        'gh failed: HTTP 502',
      ]) {
        expect(faults('## Proof', `GIF not produced - A: no bug-fix.proof hook; B: ${why}; C: red not proven here`), why).toEqual([]);
      }
    });

    it('takes red not proven here, an old omni, a film or a proof push line as level C\'s reason', () => {
      for (const why of [
        'red not proven here',
        'Red not proven here — the harness needs a database',
        'the pinned omni is too old: run omni update',
        'could not write /tmp/proof-bug-12/run',
        'proof push: no sign-in (omni signin)',
      ]) {
        expect(faults('## Proof', `GIF not produced - A: no bug-fix.proof hook; B: job e2e skipped; C: ${why}`), why).toEqual([]);
      }
    });

    it('refuses a level C reason that is the wording of its own Proved on line: C is reached whenever red and green exist', () => {
      const why = 'reproduction test only, nothing to film';
      expect(faults('## Proof', `GIF not produced - A: no bug-fix.proof hook; B: job e2e skipped; C: ${why}`)).toEqual([C_FAULT(why)]);
      expect(faults('## Proof', 'GIF not produced - A: no hook; B: job e2e skipped; C: not a component bug')).toEqual([C_FAULT('not a component bug')]);
      expect(faults('## Proof', 'GIF not produced - A: no hook; B: job e2e skipped; C: ffmpeg not found')).toEqual([C_FAULT('ffmpeg not found')]);
    });

    it('refuses a level B reason omni bug ci never prints, such as a reproduction pushed with the fix', () => {
      const why = 'the reproduction was pushed together with the fix, not alone on a draft';
      expect(faults('## Proof', `GIF not produced - A: no bug-fix.proof hook; B: ${why}; C: red not proven here`)).toEqual([B_FAULT(why)]);
      expect(faults('## Proof', `GIF not produced - A: no hook; B: ${why}; C: reproduction test only`)).toEqual([
        B_FAULT(why),
        C_FAULT('reproduction test only'),
      ]);
    });

    it('leaves level A\'s reason to its hook', () => {
      expect(faults('## Proof', 'GIF not produced - A: the hook timed out on a cold start; B: job e2e skipped; C: red not proven here')).toEqual([]);
    });

    it('asks no draft of a pull request whose level D line is refused: the line is mended first', () => {
      const body = { kind: 'pull-request' as const, body: '## Proof\nGIF not produced - A: no hook; B: job e2e skipped; C: nothing to film', pr: PR, isDraft: false };
      expect(proofFaults(body, ISSUE)).toEqual([C_FAULT('nothing to film')]);
    });
  });

  it('has none for a not-produced line with a reason, whatever else the section says', () => {
    expect(faults('## Proof', D)).toEqual([]);
    expect(faults('## Proof', `  ${D}`)).toEqual([]);
    expect(faults('## Proof', IMAGE, ...LINES, PROVED, D)).toEqual([]);
  });

  it('is no section when the heading is missing', () => {
    expect(faults('Closes #12', IMAGE, ...LINES, PROVED)).toEqual(['no ## Proof section']);
  });

  it('is no image and no not-produced line for prose, a bare dash, or an image that is not https', () => {
    const line = '## Proof has no image and no "GIF not produced - <reason>" line';
    expect(faults('## Proof', 'It works.')).toEqual([line]);
    expect(faults('## Proof', 'GIF not produced -')).toEqual([line]);
    expect(faults('## Proof', 'GIF not produced - ')).toEqual([line]);
    expect(faults('## Proof', 'GIF not produced')).toEqual([line]);
    expect(faults('## Proof', '![x](http://omni.example/a.gif)', ...LINES, PROVED)).toEqual([line]);
    expect(faults('## Proof', '[x](https://omni.example/a.gif)', ...LINES, PROVED)).toEqual([line]);
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
    expect(faults('## Proof', IMAGE, ...LINES.map((line) => `  ${line}`), PROVED)).toEqual([]);
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
      expect(proofFaults(pull(false, '## Proof', D), ISSUE)).toEqual([
        'the proof was not produced but #34 is not a draft: gh pr ready 34 --undo',
      ]);
    });

    it('is content with a draft that says so, and with a filmed proof on either', () => {
      expect(proofFaults(pull(true, '## Proof', D), ISSUE)).toEqual([]);
      expect(proofFaults(pull(false, '## Proof', IMAGE, ...LINES, PROVED), ISSUE)).toEqual([]);
      expect(proofFaults(pull(true, '## Proof', IMAGE, ...LINES, PROVED), ISSUE)).toEqual([]);
    });

    it('does not ask for a draft when the proof has a fault of its own, or when a filmed proof also carries the line', () => {
      expect(proofFaults(pull(false, '## Proof', 'GIF not produced -'), ISSUE)).toEqual([
        '## Proof has no image and no "GIF not produced - <reason>" line',
      ]);
      expect(proofFaults(pull(false, 'Closes #12'), ISSUE)).toEqual(['no ## Proof section']);
      expect(proofFaults(pull(false, '## Proof', IMAGE, ...LINES, PROVED, D), ISSUE)).toEqual([]);
    });

    it('asks nothing of a draft in a body read from a file', () => {
      expect(faults('## Proof', D)).toEqual([]);
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
