import { describe, expect, it } from 'vitest';
import { checkLine, JobUpdateSchema, RegisterRequestSchema, RUNNER_SKILLS, SendRequestSchema, TargetSchema } from './runners.contract';

// The line check (PRD 1830 s1): a runner runs only `/omni:<skill> <args>` lines whose skill is on the
// list and whose arguments are letters, digits, spaces and `._/:#-`, 200 characters at most.

describe('the line check', () => {
  it.each(RUNNER_SKILLS)('lets /omni:%s through, with its arguments', (skill) => {
    expect(checkLine(`/omni:${skill} 1830 s1 --in-wave`)).toEqual({ ok: true, skill, args: '1830 s1 --in-wave' });
  });

  it('lets a line with no arguments through', () => {
    expect(checkLine('/omni:wave')).toEqual({ ok: true, skill: 'wave', args: '' });
  });

  it('takes every character the list allows', () => {
    expect(checkLine('/omni:bug-fix acme/widgets#12 v1.2_3:x').ok).toBe(true);
  });

  it.each([
    ['an unlisted skill', '/omni:enforce 1400', 'not a skill a runner runs'],
    ['a conversational skill', '/omni:brainstorm a new idea', 'not a skill a runner runs'],
    ['the loop, which never ends', '/omni:drive 1717', 'not a skill a runner runs'],
    ['another plugin\'s skill', '/vercel:deploy prod', 'reads `/omni:<skill> <arguments>`'],
    ['no slash', 'omni:yolo 1717', 'reads `/omni:<skill> <arguments>`'],
  ])('refuses %s', (_, line, reason) => {
    const check = checkLine(line);
    expect(check.ok).toBe(false);
    expect(check.ok ? '' : check.reason).toContain(reason);
  });

  it.each([
    ['a command chained on', '/omni:yolo 1717; rm -rf ~'],
    ['a subshell', '/omni:yolo $(whoami)'],
    ['backticks', '/omni:yolo `id`'],
    ['a pipe', '/omni:yolo 1717 | sh'],
    ['a redirection', '/omni:yolo 1717 > /etc/passwd'],
    ['quotes', '/omni:yolo "1717"'],
    ['a new line', '/omni:yolo 1717\nrm -rf ~'],
    ['an ampersand', '/omni:yolo 1717 && echo'],
  ])('refuses shell characters: %s', (_, line) => {
    expect(checkLine(line).ok).toBe(false);
  });

  it('takes 200 characters of arguments and refuses 201', () => {
    expect(checkLine(`/omni:yolo ${'a'.repeat(200)}`).ok).toBe(true);
    expect(checkLine(`/omni:yolo ${'a'.repeat(201)}`)).toEqual({ ok: false, reason: 'A line\'s arguments are 200 characters at most.' });
  });
});

describe('the requests', () => {
  it('registers a runner with 1 to 8 slots and at least one repository', () => {
    const runner = { name: 'vertuo-agents', slots: 4, repos: ['vertuoza/vertuo-omni-loop'], version: '0.0.387' };
    expect(RegisterRequestSchema.parse(runner)).toEqual(runner);
    for (const slots of [0, 9, 1.5]) expect(RegisterRequestSchema.safeParse({ ...runner, slots }).success).toBe(false);
    expect(RegisterRequestSchema.safeParse({ ...runner, repos: [] }).success).toBe(false);
    expect(RegisterRequestSchema.safeParse({ ...runner, name: 'two words' }).success).toBe(false);
    expect(RegisterRequestSchema.safeParse({ ...runner, owner: 'someone' }).success).toBe(false);
  });

  it('sends to any runner, a fleet or one runner, and nowhere else', () => {
    expect(TargetSchema.parse({ kind: 'any' })).toEqual({ kind: 'any' });
    expect(TargetSchema.parse({ kind: 'fleet', fleet: 'cia' })).toEqual({ kind: 'fleet', fleet: 'cia' });
    expect(TargetSchema.safeParse({ kind: 'runner', runner: 'not-an-id' }).success).toBe(false);
    expect(TargetSchema.safeParse({ kind: 'fleet', fleet: 'cia', runner: '00000000-0000-4000-8000-000000000001' }).success).toBe(false);
    expect(SendRequestSchema.safeParse({ line: '/omni:yolo 1', repo: 'not a repo', target: { kind: 'any' } }).success).toBe(false);
  });

  it('reports a status a runner may set, with a pull request link from GitHub only', () => {
    expect(JobUpdateSchema.parse({ status: 'done', prUrl: 'https://github.com/acme/widgets/pull/12', exitCode: 0 }).status).toBe('done');
    expect(JobUpdateSchema.safeParse({ status: 'claimed' }).success).toBe(false);
    expect(JobUpdateSchema.safeParse({ status: 'queued' }).success).toBe(false);
    expect(JobUpdateSchema.safeParse({ status: 'done', prUrl: 'https://evil.test/acme/widgets/pull/12' }).success).toBe(false);
  });
});
