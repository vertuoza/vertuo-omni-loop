import { describe, expect, it } from 'vitest';
import { afterAnswersWords, answeredOf, cancelledByWords, canAnswer, canCancel, canResume, fixLineOf, canSendAgain, madeByWords, prdLineOf, prdPageLink, prWords, retroLineOf, senderWords, slicesWords, stateWords, statusTone, statusWords, targetOf } from './model';

// The Runners page's words and rules (PRD 1830 s3), pure: how long ago, where a job is sent again, and
// which jobs take Cancel or Send again.

const NOW = new Date('2026-10-13T14:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;

describe('stateWords', () => {
  it('says how long ago an offline runner was last seen, in minutes, hours or days', () => {
    expect(stateWords({ state: 'offline', lastSeenAt: ago(30_000) }, NOW)).toBe('Offline');
    expect(stateWords({ state: 'offline', lastSeenAt: ago(5 * MIN) }, NOW)).toBe('Offline, 5 min ago');
    expect(stateWords({ state: 'offline', lastSeenAt: ago(125 * MIN) }, NOW)).toBe('Offline, 2 h ago');
    expect(stateWords({ state: 'offline', lastSeenAt: ago(50 * 60 * MIN) }, NOW)).toBe('Offline, 2 d ago');
  });
});

describe('statusWords', () => {
  const job = { reason: null, exitCode: null, runningAt: null, claimedAt: null };

  it('counts a running job from when it started, else from its claim', () => {
    expect(statusWords({ ...job, status: 'running', runningAt: ago(3 * MIN), claimedAt: ago(4 * MIN) }, NOW)).toBe('Running 3 min');
    expect(statusWords({ ...job, status: 'running', claimedAt: ago(4 * MIN) }, NOW)).toBe('Running 4 min');
    expect(statusWords({ ...job, status: 'running' }, NOW)).toBe('Running');
    expect(statusWords({ ...job, status: 'claimed' }, NOW)).toBe('Starting');
  });

  it('says a failure without a reason or an exit code as Failed', () => {
    expect(statusWords({ ...job, status: 'failed' }, NOW)).toBe('Failed');
  });
});

describe('the actions', () => {
  it('cancels a queued, claimed or running job, a running one once', () => {
    for (const status of ['queued', 'claimed', 'running'] as const) expect(canCancel({ status, cancelRequested: false })).toBe(true);
    expect(canCancel({ status: 'running', cancelRequested: true })).toBe(false);
    for (const status of ['done', 'failed', 'cancelled'] as const) expect(canCancel({ status, cancelRequested: false })).toBe(false);
  });

  it('keeps Cancel on a Starting job whose cancel was already asked, so it never stays stuck (#2168)', () => {
    expect(canCancel({ status: 'claimed', cancelRequested: true })).toBe(true);
  });

  it('sends again only a failed or cancelled job', () => {
    expect((['queued', 'claimed', 'running', 'done', 'failed', 'cancelled'] as const).filter((status) => canSendAgain({ status }))).toEqual(['failed', 'cancelled']);
  });

  it('sends a job again to where it first went', () => {
    expect(targetOf({ toRunner: 'r1', toFleet: null })).toEqual({ kind: 'runner', runner: 'r1' });
    expect(targetOf({ toRunner: null, toFleet: 'comets' })).toEqual({ kind: 'fleet', fleet: 'comets' });
    expect(targetOf({ toRunner: null, toFleet: null })).toEqual({ kind: 'any' });
  });
});

describe('prWords', () => {
  it('names a pull request by its number', () => {
    expect(prWords('https://github.com/acme/widgets/pull/1838')).toBe('PR #1838');
    expect(prWords('https://github.com/acme/widgets')).toBe('Pull request');
  });
});

describe('senderWords and madeByWords', () => {
  it('name a key as the sender with its maker under it, and a person by their login (PRD 2022)', () => {
    expect(senderWords({ sentByLogin: 'ada', sentByKey: 'QA dashboard' })).toBe('API key QA dashboard');
    expect(madeByWords({ sentByLogin: 'ada', sentByKey: 'QA dashboard' })).toBe('made by @ada');
    expect(senderWords({ sentByLogin: 'ada', sentByKey: null })).toBe('@ada');
    expect(madeByWords({ sentByLogin: 'ada', sentByKey: null })).toBeNull();
    expect(senderWords({ sentByLogin: null, sentByKey: null })).toBe('A member');
    expect(madeByWords({ sentByLogin: null, sentByKey: 'QA dashboard' })).toBeNull();
  });
});

describe('a key\'s job, for whom the app acted (PRD 2425)', () => {
  const key = { sentByLogin: 'ada', sentByKey: 'cleaner' };

  it('reads ` · for <acting_for>` after made by, as the app gave it, and as before without one', () => {
    const sent = { ...key, actingFor: 'Jane D.' };
    expect(senderWords(sent)).toBe('API key cleaner');
    expect(madeByWords(sent)).toBe('made by @ada · for Jane D.');
    expect(madeByWords({ ...key, actingFor: 'jane.d@acme.test' })).toBe('made by @ada · for jane.d@acme.test');
    expect(madeByWords({ ...key, actingFor: null })).toBe('made by @ada');
    expect(madeByWords(key)).toBe('made by @ada');
  });

  it('reads the for part alone when the key\'s maker is unknown, and nothing when neither is', () => {
    expect(madeByWords({ sentByLogin: null, sentByKey: 'cleaner', actingFor: 'Jane D.' })).toBe('for Jane D.');
    expect(madeByWords({ sentByLogin: null, sentByKey: 'cleaner', actingFor: null })).toBeNull();
  });

  it('names no one for a job no key sent, whatever it carries', () => {
    expect(madeByWords({ sentByLogin: 'ada', sentByKey: null, actingFor: 'Jane D.' })).toBeNull();
  });

  it('says `by API key <name>` under Cancelled for a job a key cancelled, and nothing for a person\'s cancel or any other status', () => {
    expect(cancelledByWords({ status: 'cancelled', cancelledByKey: 'cleaner' })).toBe('by API key cleaner');
    expect(cancelledByWords({ status: 'cancelled', cancelledByKey: null })).toBeNull();
    expect(cancelledByWords({ status: 'cancelled' })).toBeNull();
    expect(cancelledByWords({ status: 'running', cancelledByKey: 'cleaner' })).toBeNull();
  });
});

describe('a bug fix\'s own end reads Done on the page (PRD 2425)', () => {
  const ended = { status: 'done' as const, reason: null, exitCode: 0, runningAt: null, claimedAt: null };
  const line = { line: '/omni:bug-fix 1790', repo: 'acme/widgets' };

  it.each(['pr-opened', 'already-fixed', 'needs-brainstorm', 'not-a-bug', 'stuck', 'blocked'] as const)('%s reads Done, in the green, with no button, no Resume and no PRD page', (outcome) => {
    expect(statusWords({ ...ended, outcome }, NOW)).toBe('Done');
    expect(statusTone('done', outcome)).toBe('done');
    expect(canAnswer({ status: 'done', outcome })).toBe(false);
    expect(canResume({ status: 'done', outcome })).toBe(false);
    expect(prdPageLink({ ...line, status: 'done', outcome })).toBeNull();
  });

  it('keeps the words of the outcomes it shows', () => {
    expect(statusWords({ ...ended, outcome: 'human' }, NOW)).toBe('Need human');
    expect(statusWords({ ...ended, outcome: 'ready' }, NOW)).toBe('Ready');
    expect(prdPageLink({ ...line, line: '/omni:yolo 1790', status: 'done', outcome: 'ready' })).toBe('/prd/at/acme/widgets/1790');
    expect(prdPageLink({ ...line, line: '/omni:yolo 1790', status: 'done', outcome: 'stopped' })).toBe('/prd/at/acme/widgets/1790');
  });
});

describe('a job the Omni app sent (PRD 2338)', () => {
  const app = { sentByLogin: null, sentByKey: null, sentByApp: 'omni-app' as const };
  const retro = { ...app, line: '/omni:retro-apply --retro 2340', repo: 'Acme/Widgets' };

  it('reads Omni app as its sender, with no maker under it', () => {
    expect(senderWords(app)).toBe('Omni app');
    expect(madeByWords(app)).toBeNull();
    expect(senderWords({ sentByLogin: 'ada', sentByKey: null, sentByApp: null })).toBe('@ada');
  });

  it('says what a retro job is for, linked to its retro pull request', () => {
    expect(retroLineOf(retro, { 'acme/widgets#2340': 2270 })).toEqual({ words: 'retro of PRD 2270', href: 'https://github.com/Acme/Widgets/pull/2340' });
  });

  it('names the retro pull request when the PRD is not known, and says nothing for another job', () => {
    expect(retroLineOf(retro, {})?.words).toBe('retro PR #2340');
    expect(retroLineOf({ ...retro, sentByApp: null }, { 'acme/widgets#2340': 2270 })).toBeNull();
    expect(retroLineOf({ ...retro, line: '/omni:yolo 2340' }, {})).toBeNull();
  });
});

describe('a done job\'s outcome (PRD 2223)', () => {
  const job = { reason: null, exitCode: 0, runningAt: null, claimedAt: null, status: 'done' as const };

  it('reads Waiting on answers, Held or Ready, and Done without one', () => {
    expect(statusWords({ ...job, outcome: 'answers' }, NOW)).toBe('Waiting on answers');
    expect(statusWords({ ...job, outcome: 'held' }, NOW)).toBe('Held');
    expect(statusWords({ ...job, outcome: 'ready' }, NOW)).toBe('Ready');
    expect(statusWords({ ...job, outcome: null }, NOW)).toBe('Done');
    expect(statusWords(job, NOW)).toBe('Done');
  });

  it('is drawn in the yellow for answers and held, the green for ready and a plain done job', () => {
    expect(statusTone('done', 'answers')).toBe('wait');
    expect(statusTone('done', 'held')).toBe('wait');
    expect(statusTone('done', 'ready')).toBe('done');
    expect(statusTone('done', null)).toBe('done');
    expect(statusTone('failed', 'answers')).toBe('fail');
  });

  it('links the PRD page of the PRD the line names, for a done job with an outcome only', () => {
    const done = { line: '/omni:yolo 2213', repo: 'acme/widgets', status: 'done' as const, outcome: 'answers' as const };
    expect(prdPageLink(done)).toBe('/prd/at/acme/widgets/2213');
    expect(prdPageLink({ ...done, line: '/omni:yolo-fix 7' })).toBe('/prd/at/acme/widgets/7');
    expect(prdPageLink({ ...done, outcome: null })).toBeNull();
    expect(prdPageLink({ ...done, status: 'failed' })).toBeNull();
    expect(prdPageLink({ ...done, line: '/omni:yolo Issue 5' })).toBeNull();
  });
});

describe('a job that waited, once its answers are in (PRD 2270 s2)', () => {
  const waited = { id: '11111111-aaaa-4000-8000-000000000001', status: 'done', outcome: 'answers' } as const;
  const fix = (status: 'queued' | 'claimed' | 'running' | 'done' | 'failed' | 'cancelled') => ({ id: '22222222-bbbb-4000-8000-000000000002', status, continues: waited.id });

  it('reads Answered · fixing, linking the fix, while its continuation is queued, starting or running', () => {
    for (const status of ['queued', 'claimed', 'running'] as const) {
      expect(answeredOf(waited, [fix(status)], [])).toEqual({ words: 'Answered · fixing', tone: 'run', fix: fix(status).id, button: false });
    }
  });

  it('reads Answered · fixed once the continuation ended, however it ended', () => {
    for (const status of ['done', 'failed', 'cancelled'] as const) {
      expect(answeredOf(waited, [fix(status)], [])).toEqual({ words: 'Answered · fixed', tone: 'done', fix: fix(status).id, button: false });
    }
  });

  it('reads Answered with the button when every asked item is answered and nothing continued it', () => {
    expect(answeredOf(waited, [], [waited.id])).toEqual({ words: 'Answered', tone: 'wait', fix: null, button: true });
  });

  it('keeps Waiting on answers (null) while answers are missing, and for a job that did not wait', () => {
    expect(answeredOf(waited, [], [])).toBeNull();
    expect(answeredOf({ ...waited, outcome: 'held' }, [fix('running')], [waited.id])).toBeNull();
    expect(answeredOf({ ...waited, status: 'failed' }, [], [waited.id])).toBeNull();
  });

  it('says `after answers · job <8 characters>` under the fix job and nothing under another', () => {
    expect(afterAnswersWords({ continues: waited.id })).toBe('after answers · job 11111111');
    expect(afterAnswersWords({ continues: null })).toBeNull();
    expect(afterAnswersWords({})).toBeNull();
  });

  it('asks /omni:yolo-fix for the PRD the job\'s line names', () => {
    expect(fixLineOf({ line: '/omni:yolo 2270' })).toBe('/omni:yolo-fix 2270');
    expect(fixLineOf({ line: '/omni:do-work 2270 s1' })).toBe('/omni:yolo-fix 2270');
    expect(fixLineOf({ line: '/omni:bug-fix Issue 548 totals' })).toBeNull();
  });
});

describe('prdLineOf', () => {
  const prds = { 'acme/widgets#1717': 'Widgets sync', 'acme/widgets#42': 'A, B & <C>' };

  it('names the PRD a /omni:<skill> <n> line builds, linking its page, with its title', () => {
    expect(prdLineOf({ line: '/omni:yolo 1717', repo: 'acme/widgets' }, prds)).toEqual({ number: 1717, href: '/prd/at/acme/widgets/1717?to=page', title: 'Widgets sync' });
    expect(prdLineOf({ line: '/omni:yolo-fix 42', repo: 'Acme/Widgets' }, prds)?.title).toBe('A, B & <C>');
  });

  it('is null for a PRD the repository has no dossier of, or a line that names none', () => {
    expect(prdLineOf({ line: '/omni:yolo 9', repo: 'acme/widgets' }, prds)).toBeNull();
    expect(prdLineOf({ line: '/omni:yolo 1717', repo: 'acme/mobile' }, prds)).toBeNull();
    expect(prdLineOf({ line: '/omni:bug-fix Issue 548 totals', repo: 'acme/widgets' }, prds)).toBeNull();
    expect(prdLineOf({ line: '/omni:yolo 1717 now', repo: 'acme/widgets' }, prds)).toBeNull();
    expect(prdLineOf({ line: 'yolo 1717', repo: 'acme/widgets' }, prds)).toBeNull();
  });
});

describe('a done job that needs a human (PRD 2255)', () => {
  const job = { reason: null, exitCode: 0, runningAt: null, claimedAt: null, status: 'done' as const };

  it('reads Need human, and Done once its questions are answered or dismissed (the board sends no outcome then)', () => {
    expect(statusWords({ ...job, outcome: 'human' }, NOW)).toBe('Need human');
    expect(statusWords({ ...job, outcome: null }, NOW)).toBe('Done');
  });

  it('is drawn in the yellow, as a job that waits on a person, and only when it is done', () => {
    expect(statusTone('done', 'human')).toBe('wait');
    expect(statusTone('failed', 'human')).toBe('fail');
    expect(statusTone('cancelled', 'human')).toBe('off');
  });

  it('links no PRD page: its number is a bug\'s issue', () => {
    expect(prdPageLink({ line: '/omni:bug-fix 314', repo: 'acme/widgets', status: 'done', outcome: 'human' })).toBeNull();
    expect(prdPageLink({ line: '/omni:yolo 2213', repo: 'acme/widgets', status: 'done', outcome: 'human' })).toBeNull();
  });
});

describe('canAnswer (PRD 2255 s3)', () => {
  it('shows the Need human button on a done job that ended with its questions open', () => {
    expect(canAnswer({ status: 'done', outcome: 'human' })).toBe(true);
  });

  it('shows none once the questions were answered or dismissed (the board sends no outcome then), or on any other outcome', () => {
    expect(canAnswer({ status: 'done', outcome: null })).toBe(false);
    expect(canAnswer({ status: 'done' })).toBe(false);
    for (const outcome of ['answers', 'held', 'ready'] as const) expect(canAnswer({ status: 'done', outcome })).toBe(false);
  });

  it('shows none on a job that asked and then failed, was cancelled, or still runs', () => {
    for (const status of ['failed', 'cancelled', 'running', 'queued', 'claimed'] as const) expect(canAnswer({ status, outcome: 'human' })).toBe(false);
  });
});

describe('a job stopped mid-way (PRD 2375)', () => {
  const job = { reason: null, exitCode: 0, runningAt: null, claimedAt: null };

  it('reads Stopped mid-way in the red of Failed, never Done', () => {
    expect(statusWords({ ...job, status: 'done', outcome: 'stopped' }, NOW)).toBe('Stopped mid-way');
    expect(statusTone('done', 'stopped')).toBe('fail');
  });

  it('says what it left when its count is known, and nothing when it is not', () => {
    expect(slicesWords({ status: 'done', outcome: 'stopped', slicesMerged: 2, slicesTotal: 5 })).toBe('2 / 5 slices merged');
    expect(slicesWords({ status: 'done', outcome: 'stopped', slicesMerged: 0, slicesTotal: 5 })).toBe('0 / 5 slices merged');
    expect(slicesWords({ status: 'done', outcome: 'stopped', slicesMerged: null, slicesTotal: null })).toBeNull();
    expect(slicesWords({ status: 'done', outcome: 'ready', slicesMerged: 2, slicesTotal: 5 })).toBeNull();
  });

  it('resumes a stopped job only: not a done job with another outcome, nor a failed or cancelled one', () => {
    expect(canResume({ status: 'done', outcome: 'stopped' })).toBe(true);
    for (const outcome of ['answers', 'held', 'ready', 'human', null] as const) expect(canResume({ status: 'done', outcome })).toBe(false);
    for (const status of ['failed', 'cancelled', 'running', 'queued', 'claimed'] as const) expect(canResume({ status, outcome: 'stopped' })).toBe(false);
  });

  it('keeps the other outcomes and statuses as they were', () => {
    expect(statusTone('done', 'ready')).toBe('done');
    expect(statusTone('done', 'held')).toBe('wait');
    expect(statusTone('failed', 'stopped')).toBe('fail');
    expect(canSendAgain({ status: 'done' })).toBe(false);
  });
});
