import { describe, it, expect } from 'vitest';
import {
  activeQuestion,
  answerOf,
  emptyDraft,
  keyIntent,
  pickByKey,
  pickOption,
  readQuestions,
  roundAnswers,
  shownLabel,
  shownPreview,
  toggleOther,
  typeOther,
  type AskQuestion,
} from './answer-model';

// AskUserQuestion's input, as Claude sends it and s2 stores it.
const STORAGE = {
  question: 'Which storage should the sessions use?',
  header: 'Storage',
  multiSelect: false,
  options: [
    { label: 'Postgres (Recommended)', description: 'Row-level security per owner.', preview: 'create table ask_sessions (\n  id uuid\n);' },
    { label: 'Memory', description: 'Lost on every deploy.' },
    { label: 'Files', description: 'One JSON file per session.', preview: '{ "id": "…" }' },
  ],
};
const CHECKS = {
  question: 'Which checks run?',
  header: 'Checks',
  multiSelect: true,
  options: [
    { label: 'RLS', description: 'two JWTs' },
    { label: 'Handlers', description: 'stubbed client' },
    { label: 'Hooks', description: 'fake server' },
  ],
};

const [storage, checks] = readQuestions([STORAGE, CHECKS]) as [AskQuestion, AskQuestion];

describe('reading a round', () => {
  it('reads AskUserQuestion\'s questions as given, labels untouched', () => {
    expect(storage).toEqual({
      question: STORAGE.question,
      header: 'Storage',
      multiSelect: false,
      options: [
        { label: 'Postgres (Recommended)', description: 'Row-level security per owner.', preview: 'create table ask_sessions (\n  id uuid\n);' },
        { label: 'Memory', description: 'Lost on every deploy.', preview: null },
        { label: 'Files', description: 'One JSON file per session.', preview: '{ "id": "…" }' },
      ],
    });
    expect(checks.multiSelect).toBe(true);
  });

  it('leaves out what is not a question, and fills what a question leaves out', () => {
    const read = readQuestions([null, 'text', { header: 'No text' }, { question: 'Bare?' }, { question: 'Odd?', options: [{ label: 'A' }, { nope: 1 }, 'B'] }]);
    expect(read).toEqual([
      { question: 'Bare?', header: '', multiSelect: false, options: [] },
      { question: 'Odd?', header: '', multiSelect: false, options: [{ label: 'A', description: '', preview: null }] },
    ]);
    expect(readQuestions('not a list')).toEqual([]);
  });
});

describe('the Recommended badge', () => {
  it('replaces a trailing "(Recommended)" and keeps the rest of the label', () => {
    expect(shownLabel('Postgres (Recommended)')).toEqual({ text: 'Postgres', recommended: true });
    expect(shownLabel('Postgres (recommended) ')).toEqual({ text: 'Postgres', recommended: true });
    expect(shownLabel('Memory')).toEqual({ text: 'Memory', recommended: false });
  });

  it('leaves "(Recommended)" anywhere else alone', () => {
    expect(shownLabel('The (Recommended) one, or not')).toEqual({ text: 'The (Recommended) one, or not', recommended: false });
    expect(shownLabel('(Recommended)')).toEqual({ text: '(Recommended)', recommended: false });
  });
});

describe('an answer', () => {
  it('is the chosen label exactly, "(Recommended)" included, for a single choice', () => {
    const pick = pickOption(storage, emptyDraft([storage])[0], 'Postgres (Recommended)');
    expect(answerOf(storage, pick)).toBe('Postgres (Recommended)');
    expect(answerOf(storage, pickOption(storage, pick, 'Memory'))).toBe('Memory');
  });

  it('joins a multi-select with ", " in the order the options are listed', () => {
    let pick = emptyDraft([checks])[0];
    pick = pickOption(checks, pick, 'Hooks');
    pick = pickOption(checks, pick, 'RLS');
    expect(answerOf(checks, pick)).toBe('RLS, Hooks');
    pick = pickOption(checks, pick, 'Hooks');
    expect(answerOf(checks, pick)).toBe('RLS');
    pick = pickOption(checks, pick, 'RLS');
    expect(answerOf(checks, pick)).toBeNull();
  });

  it('sends Other verbatim, and Other replaces the pick of a single choice', () => {
    const typed = '  Neither: keep it in Redis, "for now"\nand revisit  ';
    let pick = pickOption(storage, emptyDraft([storage])[0], 'Memory');
    pick = typeOther(storage, pick, typed);
    expect(answerOf(storage, pick)).toBe(typed);
    pick = pickOption(storage, pick, 'Files');
    expect(answerOf(storage, pick)).toBe('Files');
    pick = toggleOther(storage, pick);
    expect(answerOf(storage, pick)).toBe(typed);
  });

  it('adds Other after the chosen labels of a multi-select', () => {
    let pick = pickOption(checks, emptyDraft([checks])[0], 'Handlers');
    pick = typeOther(checks, pick, 'A live run');
    expect(answerOf(checks, pick)).toBe('Handlers, A live run');
    pick = toggleOther(checks, pick);
    expect(answerOf(checks, pick)).toBe('Handlers');
    pick = pickOption(checks, pick, 'Handlers');
    pick = toggleOther(checks, pick);
    expect(answerOf(checks, pick)).toBe('A live run');
  });

  it('is no answer while Other is chosen but empty', () => {
    expect(answerOf(storage, toggleOther(storage, emptyDraft([storage])[0]))).toBeNull();
    expect(answerOf(storage, typeOther(storage, emptyDraft([storage])[0], ' \n '))).toBeNull();
  });
});

describe('Send', () => {
  it('is enabled only when every question has an answer', () => {
    const questions = [storage, checks];
    let draft = emptyDraft(questions);
    expect(roundAnswers(questions, draft)).toBeNull();
    draft = [pickOption(storage, draft[0], 'Postgres (Recommended)'), draft[1]];
    expect(roundAnswers(questions, draft)).toBeNull();
    draft = [draft[0], pickOption(checks, pickOption(checks, draft[1], 'RLS'), 'Handlers')];
    expect(roundAnswers(questions, draft)).toEqual({
      'Which storage should the sessions use?': 'Postgres (Recommended)',
      'Which checks run?': 'RLS, Handlers',
    });
  });

  it('has nothing to send for a round without questions', () => {
    expect(roundAnswers([], [])).toBeNull();
  });
});

describe('the keyboard', () => {
  it('picks with 1 to 4 and sends with Enter', () => {
    expect(keyIntent({ key: '1' }, false)).toEqual({ kind: 'pick', option: 0 });
    expect(keyIntent({ key: '4' }, false)).toEqual({ kind: 'pick', option: 3 });
    expect(keyIntent({ key: 'Enter' }, false)).toEqual({ kind: 'send' });
    for (const key of ['0', '5', 'a', ' ', 'Escape']) expect(keyIntent({ key }, false), key).toBeNull();
  });

  it('types into Other: digits are text there, Enter still sends and Shift+Enter breaks the line', () => {
    expect(keyIntent({ key: '2' }, true)).toBeNull();
    expect(keyIntent({ key: 'Enter' }, true)).toEqual({ kind: 'send' });
    expect(keyIntent({ key: 'Enter', shiftKey: true }, true)).toBeNull();
    expect(keyIntent({ key: 'Enter', isComposing: true }, true)).toBeNull();
  });

  it('leaves shortcuts with a modifier to the browser', () => {
    for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      expect(keyIntent({ key: '1', [mod]: true }, false), mod).toBeNull();
      expect(keyIntent({ key: 'Enter', [mod]: true }, false), mod).toBeNull();
    }
  });

  it('picks in the question that has the focus, else the first one without an answer', () => {
    const questions = [storage, checks];
    let draft = emptyDraft(questions);
    expect(activeQuestion(questions, draft, null)).toBe(0);
    draft = pickByKey(questions, draft, activeQuestion(questions, draft, null), 2);
    expect(answerOf(storage, draft[0])).toBe('Files');
    expect(activeQuestion(questions, draft, null)).toBe(1);
    draft = pickByKey(questions, draft, 1, 1);
    draft = pickByKey(questions, draft, 1, 0);
    expect(answerOf(checks, draft[1])).toBe('RLS, Handlers');
    expect(activeQuestion(questions, draft, null)).toBe(1);
    expect(activeQuestion(questions, draft, 0)).toBe(0);
    draft = pickByKey(questions, draft, 0, 1);
    expect(answerOf(storage, draft[0])).toBe('Memory');
  });

  it('ignores a key past the last option', () => {
    const draft = emptyDraft([storage]);
    expect(pickByKey([storage], draft, 0, 3)).toBe(draft);
  });
});

describe('the preview', () => {
  it('shows the option in focus, else the one picked, else the first that has one', () => {
    const pick = emptyDraft([storage])[0];
    expect(shownPreview(storage, pick, null)).toEqual({ option: 0, text: STORAGE.options[0].preview });
    expect(shownPreview(storage, pickOption(storage, pick, 'Files'), null)).toEqual({ option: 2, text: '{ "id": "…" }' });
    expect(shownPreview(storage, pickOption(storage, pick, 'Files'), 0)).toEqual({ option: 0, text: STORAGE.options[0].preview });
  });

  it('keeps the last preview while an option without one is in focus or picked', () => {
    const pick = pickOption(storage, emptyDraft([storage])[0], 'Memory');
    expect(shownPreview(storage, pick, 1)).toEqual({ option: 0, text: STORAGE.options[0].preview });
  });

  it('is none for a question without previews', () => {
    expect(shownPreview(checks, emptyDraft([checks])[0], 0)).toBeNull();
  });
});
