import { describe, expect, it } from 'vitest';
import { IssueNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import type { Job, JobQuestions, Question } from '../runners.contract';
import type { Called } from '../runners.client';
import { emptyDraft, pickOption, typeOther } from '../../ask/answer-model';
import {
  answerParamOf, answersOf, closed, closedAfter, closedWords, demoPort, drawerMove, issueUrl, listedAnswer, NONE, opened, readingOf, refusedAsClosed, questionsOf, withAnswer, WORDS,
} from './need-human';

// The Need human drawer's rules (PRD 2255 s3, the `runner-need-human` screen), pure or driven through seams, so
// each is tested without a browser: which job `?answer=` opens, the URL it sets, the questions and answers in the
// shape the Questions page's model takes, the words of a closed row and of a read that failed, where the focus
// goes, what Tab does inside the drawer, and the demo's in-memory port.

const JOB = '00000000-0000-4000-8000-00000000d299';

function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`no item ${String(index)}`);
  return item;
}

const QUESTIONS: Question[] = [
  {
    question: 'How should the planning show an assignment whose project the user may not open?',
    header: 'Fix',
    multiSelect: false,
    options: [
      { label: 'Make the project nullable', description: 'The assignment shows with no project.' },
      { label: 'Filter those assignments out', description: 'The user sees only what they may open.' },
      { label: 'Design it first', description: 'Stop here and brainstorm the behaviour' },
    ],
  },
  {
    question: 'Which tenants first?',
    header: 'Rollout',
    multiSelect: true,
    options: [{ label: 'The 31 failing', description: '' }, { label: 'All', description: '' }],
  },
];

const ROW: JobQuestions = {
  job: JOB, issue: IssueNumberSchema.parse(314), lead: 'The planning query fails for 31 tenants.', questions: QUESTIONS,
  state: 'open', answers: null, by: null, byLogin: null, at: null, resume: null,
};

describe('the job ?answer= opens', () => {
  it('is the job id it names, once the board lists it', () => {
    expect(answerParamOf(JOB)).toBe(JOB);
    expect(listedAnswer(JOB, [{ id: JOB }])).toBe(JOB);
  });

  it('is none for a missing parameter, a value that is no job id, or a job the board does not list', () => {
    expect(answerParamOf(null)).toBeNull();
    expect(answerParamOf(undefined)).toBeNull();
    expect(answerParamOf('')).toBeNull();
    expect(answerParamOf('nope')).toBeNull();
    expect(listedAnswer(JOB, [])).toBeNull();
    expect(listedAnswer('nope', [{ id: JOB }])).toBeNull();
  });
});

describe('withAnswer', () => {
  it('sets ?answer=<job>, keeping every other parameter and the hash', () => {
    expect(withAnswer('https://omni.test/app/runners?terminal=t1#job-x', JOB)).toBe(`/app/runners?terminal=t1&answer=${JOB}#job-x`);
  });

  it('removes it with no job, and leaves a bare path', () => {
    expect(withAnswer(`https://omni.test/app/runners?answer=${JOB}`, null)).toBe('/app/runners');
    expect(withAnswer(`https://omni.test/app/runners?answer=${JOB}&terminal=t1`, null)).toBe('/app/runners?terminal=t1');
  });
});

describe('the issue the header links', () => {
  it('is the issue of the repository on GitHub', () => {
    expect(issueUrl('acme/widgets', IssueNumberSchema.parse(314))).toBe('https://github.com/acme/widgets/issues/314');
  });
});

describe('the questions and the answers', () => {
  const asked = questionsOf(QUESTIONS);

  it('reads a job\'s questions as the Questions page\'s model takes them, with no preview', () => {
    expect(asked).toHaveLength(2);
    expect(asked[0]).toMatchObject({ header: 'Fix', multiSelect: false });
    expect(asked[0]?.options.map((option) => option.preview)).toEqual([null, null, null]);
    expect(asked[1]?.multiSelect).toBe(true);
  });

  it('has no answer until every question has one (Send answers stays off)', () => {
    expect(answersOf(asked, emptyDraft(asked))).toBeNull();
    const first = emptyDraft(asked).map((pick, i) => (i === 0 ? pickOption(at(asked, 0), pick, 'Design it first') : pick));
    expect(answersOf(asked, first)).toBeNull();
  });

  it('answers each question by its text, with an option\'s label or a free answer', () => {
    const draft = emptyDraft(asked).map((pick, i) => {
      if (i === 0) return pickOption(at(asked, 0), pick, 'Filter those assignments out');
      return typeOther(at(asked, 1), pick, 'Start with the biggest tenant');
    });
    expect(answersOf(asked, draft)).toEqual({
      [at(QUESTIONS, 0).question]: 'Filter those assignments out',
      'Which tenants first?': 'Start with the biggest tenant',
    });
  });

  it('joins the labels of a multi-select with a comma', () => {
    const draft = emptyDraft(asked).map((pick, i) => {
      if (i === 0) return pickOption(at(asked, 0), pick, 'Design it first');
      return pickOption(at(asked, 1), pickOption(at(asked, 1), pick, 'The 31 failing'), 'All');
    });
    expect(answersOf(asked, draft)?.['Which tenants first?']).toBe('The 31 failing, All');
  });

  it('refuses an answer past 2,000 characters, as the route does', () => {
    const one = questionsOf([QUESTIONS[0] as Question]);
    const pick = (text: string) => answersOf(one, [typeOther(at(one, 0), at(emptyDraft(one), 0), text)]);
    expect(pick('x'.repeat(2_000))).not.toBeNull();
    expect(pick('x'.repeat(2_001))).toBeNull();
  });

  it('counts a free answer of spaces as none', () => {
    const one = questionsOf([QUESTIONS[0] as Question]);
    expect(answersOf(one, [typeOther(at(one, 0), at(emptyDraft(one), 0), '   ')])).toBeNull();
  });
});

describe('a closed row', () => {
  it('reads Already answered by the person, or Dismissed by them, in the words the service uses', () => {
    expect(closedWords({ state: 'answered', answers: { q: 'a' }, byLogin: 'mo' })).toBe('Already answered by @mo');
    expect(closedWords({ state: 'dismissed', answers: null, byLogin: 'olga' })).toBe('Dismissed by @olga');
    expect(closedWords({ state: 'answered', answers: { q: 'a' }, byLogin: null })).toBe('Already answered by someone');
  });

  it('reads nothing while the row is open', () => {
    expect(closedWords({ state: 'open', answers: null, byLogin: null })).toBeNull();
  });

  it('names the API key that closed it, then whom the app said it acted for, never as a person (PRD 2425)', () => {
    const key = { byLogin: null, byKey: 'cleaner' };
    expect(closedWords({ ...key, state: 'answered', answers: { q: 'a' }, actingFor: 'Jane D.' })).toBe('Already answered by API key cleaner · for Jane D.');
    expect(closedWords({ ...key, state: 'dismissed', answers: null, actingFor: 'Jane D.' })).toBe('Dismissed by API key cleaner · for Jane D.');
    expect(closedWords({ ...key, state: 'answered', answers: { q: 'a' }, actingFor: null })).toBe('Already answered by API key cleaner');
    expect(closedWords({ ...key, state: 'dismissed', answers: null })).toBe('Dismissed by API key cleaner');
  });

  it('reads a person\'s close as before, and never adds a for part to it', () => {
    expect(closedWords({ state: 'answered', answers: { q: 'a' }, byLogin: 'mo', byKey: null, actingFor: null })).toBe('Already answered by @mo');
    expect(closedWords({ state: 'answered', answers: { q: 'a' }, byLogin: 'mo', byKey: null, actingFor: 'Jane D.' })).toBe('Already answered by @mo');
    expect(closedWords({ state: 'dismissed', answers: null, byLogin: null, byKey: null, actingFor: 'Jane D.' })).toBe('Dismissed by someone');
  });

  it('is what a refused answer says when someone came first, and nothing for any other refusal', () => {
    expect(refusedAsClosed('Already answered by @mo')).toBe('Already answered by @mo');
    expect(refusedAsClosed('Dismissed by @olga')).toBe('Dismissed by @olga');
    expect(refusedAsClosed('Already answered by someone')).toBe('Already answered by someone');
    expect(refusedAsClosed('Already answered by API key cleaner · for Jane D.')).toBe('Already answered by API key cleaner · for Jane D.');
    expect(refusedAsClosed('Dismissed by API key cleaner')).toBe('Dismissed by API key cleaner');
    expect(refusedAsClosed('That runner is not yours to send to.')).toBeNull();
    expect(refusedAsClosed('The Omni app could not be reached. Try again.')).toBeNull();
  });
});

describe('a read of the questions', () => {
  it('is open with the questions to answer', () => {
    expect(readingOf({ ok: true, value: ROW })).toEqual({ kind: 'open', row: ROW, asked: questionsOf(QUESTIONS) });
  });

  it('is closed, with its words and the issue, once someone answered or dismissed', () => {
    expect(readingOf({ ok: true, value: { ...ROW, state: 'answered', answers: { q: 'a' }, byLogin: 'mo', by: 'u1' } })).toEqual({ kind: 'closed', words: 'Already answered by @mo', issue: 314 });
    expect(readingOf({ ok: true, value: { ...ROW, state: 'dismissed', byLogin: 'olga', by: 'u2' } })).toEqual({ kind: 'closed', words: 'Dismissed by @olga', issue: 314 });
  });

  it('is closed, naming the key and for whom, once an API key answered or dismissed (PRD 2425)', () => {
    const byKey = { by: null, byLogin: null, byKey: 'cleaner', actingFor: 'Jane D.' };
    expect(readingOf({ ok: true, value: { ...ROW, ...byKey, state: 'answered', answers: { q: 'a' } } })).toEqual({ kind: 'closed', words: 'Already answered by API key cleaner · for Jane D.', issue: 314 });
    expect(readingOf({ ok: true, value: { ...ROW, ...byKey, state: 'dismissed' } })).toEqual({ kind: 'closed', words: 'Dismissed by API key cleaner · for Jane D.', issue: 314 });
  });

  it('is missing for a job nobody sees or that asked no question: the drawer does not open', () => {
    expect(readingOf({ ok: false, error: 'No such job.' })).toEqual({ kind: 'missing' });
    expect(readingOf({ ok: false, error: 'This job asked no question.' })).toEqual({ kind: 'missing' });
  });

  it('is failed, with the words, for any other refusal', () => {
    expect(readingOf({ ok: false, error: 'The Omni app could not be reached. Try again.' })).toEqual({ kind: 'failed', words: 'The Omni app could not be reached. Try again.' });
  });
});

describe('the drawer after a refusal that says someone came first', () => {
  it('names the API key that closed the row, as the row read again says: the service\'s own words name a login only (PRD 2425)', () => {
    const again: Called<JobQuestions> = { ok: true, value: { ...ROW, by: null, byLogin: null, byKey: 'cleaner', actingFor: 'Jane D.', state: 'answered', answers: { q: 'a' } } };
    expect(closedAfter('Already answered by someone', again, ROW.issue)).toEqual({ kind: 'closed', words: 'Already answered by API key cleaner · for Jane D.', issue: ROW.issue });
  });

  it('keeps the refusal\'s own words when the row cannot be read again, or still reads open', () => {
    const lost: Called<JobQuestions> = { ok: false, error: 'The Omni app could not be reached. Try again.' };
    expect(closedAfter('Already answered by @mo', lost, ROW.issue)).toEqual({ kind: 'closed', words: 'Already answered by @mo', issue: ROW.issue });
    expect(closedAfter('Dismissed by someone', { ok: true, value: ROW }, ROW.issue)).toEqual({ kind: 'closed', words: 'Dismissed by someone', issue: ROW.issue });
  });
});

describe('the focus', () => {
  it('moves into the drawer when it opens', () => {
    expect(opened(JOB)).toEqual({ open: JOB, focus: 'drawer', job: JOB });
  });

  it('goes back to the job\'s button when the drawer closes (Escape, the close button, the dimmed page, or a send)', () => {
    expect(closed(opened(JOB))).toEqual({ open: null, focus: 'button', job: JOB });
  });

  it('moves nowhere when nothing was open', () => {
    expect(NONE).toEqual({ open: null, focus: 'none', job: null });
    expect(closed(NONE)).toEqual(NONE);
  });
});

describe('a key inside the open drawer', () => {
  const items = ['close', 'option', 'dismiss', 'send'];

  it('closes it on Escape', () => {
    expect(drawerMove('Escape', false, items, 'option')).toEqual({ kind: 'close' });
  });

  it('keeps Tab inside: the last item wraps to the first, Shift+Tab on the first to the last', () => {
    expect(drawerMove('Tab', false, items, 'send')).toEqual({ kind: 'focus', item: 'close' });
    expect(drawerMove('Tab', true, items, 'close')).toEqual({ kind: 'focus', item: 'send' });
  });

  it('takes the focus into it when it sits outside, or on the panel itself', () => {
    expect(drawerMove('Tab', false, items, null)).toEqual({ kind: 'focus', item: 'close' });
    expect(drawerMove('Tab', true, items, 'panel')).toEqual({ kind: 'focus', item: 'send' });
  });

  it('leaves Tab inside the list, and any other key, to the browser', () => {
    expect(drawerMove('Tab', false, items, 'option')).toEqual({ kind: 'none' });
    expect(drawerMove('Tab', true, items, 'dismiss')).toEqual({ kind: 'none' });
    expect(drawerMove('a', false, items, 'option')).toEqual({ kind: 'none' });
    expect(drawerMove('Tab', false, [], null)).toEqual({ kind: 'none' });
  });
});

describe('the demo\'s port (nothing leaves the browser)', () => {
  const resume = { id: 'r1' } as Job;
  const port = () => demoPort([ROW], 'you', resume);

  it('reads the demo\'s row, and refuses a job it holds none for as the route does', async () => {
    expect(await port().read(JOB)).toEqual({ ok: true, value: ROW });
    expect(await port().read('other')).toEqual({ ok: false, error: 'This job asked no question.' });
  });

  it('answers once, then refuses a second answer with who came first', async () => {
    const demo = port();
    expect(await demo.answer(JOB, { q: 'a' })).toMatchObject({ ok: true });
    expect(await demo.answer(JOB, { q: 'b' })).toEqual({ ok: false, error: 'Already answered by @you' });
    const read = await demo.read(JOB);
    expect(read.ok && read.value).toMatchObject({ state: 'answered', byLogin: 'you', answers: { q: 'a' }, resume: 'r1' });
  });

  it('refuses an answer to a row an API key closed, naming the key and for whom (PRD 2425)', async () => {
    const closedByKey: JobQuestions = { ...ROW, state: 'answered', answers: { q: 'a' }, byKey: 'cleaner', actingFor: 'Jane D.' };
    const demo = demoPort([closedByKey], 'you', resume);
    expect(await demo.answer(JOB, { q: 'b' })).toEqual({ ok: false, error: 'Already answered by API key cleaner · for Jane D.' });
    expect(await demo.dismiss(JOB)).toEqual({ ok: false, error: 'Already answered by API key cleaner · for Jane D.' });
  });

  it('dismisses once, and refuses an answer after it', async () => {
    const demo = port();
    expect(await demo.dismiss(JOB)).toMatchObject({ ok: true });
    expect(await demo.answer(JOB, { q: 'a' })).toEqual({ ok: false, error: 'Dismissed by @you' });
    expect(await demo.dismiss(JOB)).toEqual({ ok: false, error: 'Dismissed by @you' });
  });
});

describe('the words', () => {
  it('are the screen\'s', () => {
    expect(WORDS.need).toBe('Need human');
    expect(WORDS.send).toBe('Send answers');
    expect(WORDS.dismiss).toBe('Dismiss');
    expect(WORDS.own).toBe('Or your own answer');
  });
});
