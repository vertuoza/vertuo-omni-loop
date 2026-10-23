import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { checkRunnerLine, LINE_MAX } from 'omni-loop/kit/lib/runner/line.ts';
import { AGENT_LINE, approvalOf, KIT_REPOSITORY, leakOf, proposesRule, runnerLine, type ApprovedFinding } from './rewind.approval';

// What Approve sends, by where a finding started (PRD 2410, s7): a repository finding queues /omni:bug-fix, a
// glossary or Legal finding is filed as a product knowledge proposal, another knowledge finding queues
// /omni:rewind-apply <prd> <finding> (PRD 2498, s3), and an Omni-setup finding opens one issue on the kit's
// repository with the card's text. Every line it queues passes the runner's own line check, so a finding's
// quotes and long words never stop it; nothing queues /omni:knowledge-add any more.

const PRD = parsePrd(2410);
const ID = '3f2a9c1e-5b7d-4e8f-a1b2-c3d4e5f60718';
const finding = (more: Partial<ApprovedFinding> = {}): ApprovedFinding => ({
  id: ID, check: 'ci', origin: 'repository', happened: 'The lint job was red on s3 and the slice merged anyway.',
  evidence: ['https://github.com/acme/widgets/actions/runs/9'], fix: `Make the lint a required check.\n${AGENT_LINE}`,
  repository: 'acme/widgets', prd: PRD, ...more,
});

describe('a repository finding', () => {
  it('queues /omni:bug-fix with what happened, as a line a runner takes', () => {
    const plan = approvalOf(finding());
    expect(plan).toEqual({ kind: 'job', skill: 'bug-fix', line: '/omni:bug-fix rewind of PRD 2410: The lint job was red on s3 and the slice merged anyway.' });
    if (plan.kind === 'job') expect(checkRunnerLine(plan.line)).toMatchObject({ ok: true, skill: 'bug-fix' });
  });
});

describe('the runner line', () => {
  it('drops every character the runner refuses, quotes included, and never reads as a flag or an issue', () => {
    const line = runnerLine('bug-fix', PRD, `"Saving" twice — duplicates the 'row' (see #12) --answers 4 \n…`);
    expect(line).toBe('/omni:bug-fix rewind of PRD 2410: Saving twice duplicates the row see #12 -answers 4');
    expect(checkRunnerLine(line).ok).toBe(true);
  });

  it('cuts a long text at a word, within the runner\'s longest line', () => {
    const line = runnerLine('bug-fix', PRD, 'word '.repeat(80));
    expect(line.length).toBeLessThanOrEqual(LINE_MAX);
    expect(line.endsWith('word')).toBe(true);
    expect(checkRunnerLine(line).ok).toBe(true);
  });

  it('cuts one endless word too', () => {
    const line = runnerLine('bug-fix', PRD, 'x'.repeat(500));
    expect(line.length).toBe(LINE_MAX);
    expect(checkRunnerLine(line).ok).toBe(true);
  });
});

describe('a knowledge finding', () => {
  it('about a glossary term files a glossary proposal: the term it names, the fix as its meaning, without the agent\'s line', () => {
    const plan = approvalOf(finding({ origin: 'knowledge', check: 'knowledge', fix: `Add the glossary term \`main watch\`: the seven days after a feature PR merges.\n${AGENT_LINE}` }));
    expect(plan).toEqual({
      kind: 'proposal', knowledge: 'glossary',
      fields: { term: 'main watch', meaning: 'Add the glossary term `main watch`: the seven days after a feature PR merges.' },
    });
  });

  it('about a Legal entry files a Legal proposal under the code it names, with the evidence as its source', () => {
    const plan = approvalOf(finding({ origin: 'knowledge', check: 'knowledge', fix: 'Add a Legal entry L-GDPR: logs keep no e-mail address.' }));
    expect(plan).toEqual({
      kind: 'proposal', knowledge: 'legal',
      fields: { code: 'GDPR', statement: 'Add a Legal entry L-GDPR: logs keep no e-mail address.', source: 'The rewind of PRD 2410: https://github.com/acme/widgets/actions/runs/9' },
    });
  });

  it('cuts a meaning or a statement to what the product\'s knowledge takes', () => {
    const plan = approvalOf(finding({ origin: 'knowledge', fix: `Add the glossary term "rewind": ${'long '.repeat(120)}` }));
    expect(plan).toMatchObject({ kind: 'proposal', knowledge: 'glossary', fields: { term: 'rewind' } });
    expect(plan.kind === 'proposal' && plan.knowledge === 'glossary' && plan.fields.meaning.length).toBeLessThanOrEqual(400);
  });

  it.each([
    ['a playbook form', 'Write it in the conventions form, under Naming.'],
    ['a register', 'Add a rule to the product register: a watch never reads clean with a signal unread.'],
    ['a glossary finding that names no term', 'Add the word to the glossary.'],
    ['a Legal finding that names no code', 'Add a Legal entry for the logs.'],
  ])('about %s queues /omni:rewind-apply with the PRD and the finding\'s id only, never /omni:knowledge-add', (_what, fix) => {
    const plan = approvalOf(finding({ origin: 'knowledge', fix: `${fix}\n${AGENT_LINE}` }));
    expect(plan).toEqual({ kind: 'job', skill: 'rewind-apply', line: `/omni:rewind-apply 2410 ${ID}` });
    if (plan.kind === 'job') {
      expect(checkRunnerLine(plan.line)).toEqual({ ok: true, kind: 'omni', skill: 'rewind-apply', args: `2410 ${ID}` });
      expect(plan.line).not.toContain('knowledge-add');
    }
  });

  it('says which approved findings wait for /omni:rewind-apply\'s outcome: a knowledge finding that files no proposal', () => {
    expect(proposesRule({ origin: 'knowledge', fix: 'Write it in the conventions form, under Naming.' })).toBe(true);
    expect(proposesRule({ origin: 'knowledge', fix: 'Add the word to the glossary.' })).toBe(true);
    expect(proposesRule({ origin: 'knowledge', fix: 'Add the glossary term `main watch`: the seven days.' })).toBe(false);
    expect(proposesRule({ origin: 'knowledge', fix: 'Add a Legal entry L-GDPR: logs keep no e-mail address.' })).toBe(false);
    expect(proposesRule({ origin: 'repository', fix: 'Write it in the conventions form.' })).toBe(false);
    expect(proposesRule({ origin: 'omni-setup', fix: 'Write it in the conventions form.' })).toBe(false);
  });
});

describe('an Omni-setup finding', () => {
  it('opens an issue on the kit\'s repository holding the card\'s words, its evidence links left in the workspace', () => {
    const plan = approvalOf(finding({ origin: 'omni-setup', check: 'bodies', happened: 'The pull request form never asked for the run link.', fix: `Make /omni:pr ask for it.\n${AGENT_LINE}` }));
    expect(KIT_REPOSITORY).toBe('vertuoza/vertuo-omni-loop');
    expect(plan).toEqual({
      kind: 'issue',
      title: 'Rewind: The pull request form never asked for the run link.',
      body: `Pull request bodies · Started in: The Omni setup\n\nThe pull request form never asked for the run link.\n\nFix: Make /omni:pr ask for it.\n${AGENT_LINE}\n`,
    });
  });

  it('keeps the title to one short line', () => {
    const plan = approvalOf(finding({ origin: 'omni-setup', happened: `${'a '.repeat(100)}\nsecond line` }));
    expect(plan.kind === 'issue' && plan.title.length).toBeLessThanOrEqual(120);
    expect(plan.kind === 'issue' && plan.title.includes('\n')).toBe(false);
  });
});

describe('what would leak out of the workspace', () => {
  it('is the workspace\'s repository, named or linked, in any case', () => {
    expect(leakOf('The setup broke Acme/Widgets twice.', 'acme/widgets')).toBe('acme/widgets');
    expect(leakOf('See https://github.com/acme/other/pull/3.', 'acme/widgets')).toBe('github.com/acme');
    expect(leakOf('The kit\'s /omni:pr never asked for the run link.', 'acme/widgets')).toBeNull();
  });

  it('is nothing in the kit\'s own repository, where the issue opens at home', () => {
    expect(leakOf('See https://github.com/vertuoza/vertuo-omni-loop/pull/3.', KIT_REPOSITORY)).toBeNull();
  });
});
