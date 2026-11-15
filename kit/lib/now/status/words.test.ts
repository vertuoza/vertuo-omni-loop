// PRD #2906, slice s1: the one table of plain words — every step of every kind has a name, the kinds
// are the glossary's words, no block shows a loop word (branch, slice, sub-PR, outbox, wave, CI), and
// each technical word is explained the first time it appears in a block, and only then. A sweep over
// every step of every kind, under every verdict. Pure: no git, no disk.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd } from '../../ids.ts';
import { statusBlock } from './render.ts';
import type { StatusFacts, StatusPullRequest } from './steps.ts';
import { CHECKS_UNKNOWN, explainer, KIND_NAMES, plain, STEPS, TERM_LIST, TERMS, termOf, TRACKS, VERDICTS, WHERE } from './words.ts';

const NOW = Date.parse('2026-11-15T10:00:00.000Z');
const LOOP_WORDS = /\b(branch|slice|sub-PR|outbox|wave|CI)\b/i;
const URL = /https?:\/\/\S+/g;
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('the table', () => {
  it('names every step of every kind, its short name too', () => {
    const tracked = new Set<string>(Object.values(TRACKS).flat());
    tracked.add('questions');
    expect([...tracked].sort()).toEqual(Object.keys(STEPS).sort());
    for (const words of Object.values(STEPS)) {
      expect(words.name.trim()).not.toBe('');
      expect(words.short.trim()).not.toBe('');
      expect(words.next.length).toBeGreaterThan(0);
      expect(words.next.length).toBeLessThanOrEqual(2);
    }
  });

  it("names the kinds in the glossary's words", () => {
    expect(Object.values(KIND_NAMES).map(plain)).toEqual(['PRD', 'Bug fix', 'Visual update']);
  });

  it('marks every technical word it writes, and marks only words it explains', () => {
    const lines = [
      ...Object.values(STEPS).flatMap((words) => [words.name, words.sentence, words.you, ...words.next]),
      ...Object.values(VERDICTS).flatMap((said) => [said.sentence, ...said.next]),
      CHECKS_UNKNOWN.sentence,
      ...Object.values(WHERE),
      ...Object.values(KIND_NAMES),
    ];
    for (const line of lines) {
      for (const [, word] of line.matchAll(/\[\[([^\]]+)\]\]/g)) expect(termOf(word ?? '')).not.toBeNull();
      const unmarked = line.replace(/\[\[[^\]]+\]\]/g, '');
      for (const term of TERM_LIST) expect(unmarked).not.toMatch(new RegExp(`\\b${escape(term)}\\b`, 'i'));
      expect(plain(line)).not.toMatch(LOOP_WORDS);
    }
  });

  it('explains a word the first time a block says it, then prints it plain', () => {
    const { say } = explainer();
    expect(say('the [[checks]] run, the [[Checks]] pass')).toBe('the checks (the tests GitHub runs on every change) run, the Checks pass');
    expect(say('once the [[checks]] pass')).toBe('once the checks pass');
    expect(plain('the [[pull request]] is below')).toBe('the pull request is below');
  });
});

// Every step of every kind, then each under every verdict the facts can say over it.
const LINKS = { page: 'https://omni.example/app/x/1', issueUrl: 'https://github.com/acme/widgets/issues/1', pullRequest: 'https://github.com/acme/widgets/pull/2' };
const CHECKED = { at: '2026-11-15T09:50:00.000Z', fetch: 'no-answer' as const };
const pull = (state: StatusPullRequest['state'], checks: StatusPullRequest['checks'] = []): StatusPullRequest => ({ state, files: ['src/a.ts'], checks });
const board = (states: string[]) => states.map((state, i) => ({ id: `s${String(i + 1)}`, state }));
const PRD_BASE = { kind: 'prd' as const, number: parsePrd(7), title: 'Quotes in two clicks', folder: 'inbox' as const, approved: true, approvalWait: false, phase0Open: false, plan: true, slices: null, openQuestions: 0, pullRequest: null, links: LINKS, checked: CHECKED };
const PRD_STEPS: StatusFacts[] = [
  { ...PRD_BASE, folder: 'none', approved: false, plan: false },
  { ...PRD_BASE, approved: false },
  { ...PRD_BASE, approved: false, approvalWait: true },
  { ...PRD_BASE, slices: board(['runnable']) },
  { ...PRD_BASE, plan: false },
  { ...PRD_BASE, slices: board(['merged', 'in-flight', 'stuck']), pullRequest: pull('draft') },
  { ...PRD_BASE, slices: board(['merged']), pullRequest: pull('draft') },
  { ...PRD_BASE, slices: board(['merged']), openQuestions: 1, pullRequest: pull('draft') },
  { ...PRD_BASE, slices: board(['merged']), pullRequest: pull('open') },
  { ...PRD_BASE, folder: 'shipped' },
];
const fixSteps = (kind: 'bug' | 'visual'): StatusFacts[] => {
  const base = { kind, number: parseIssue(9), title: 'The sidebar is too dark', folder: '.omni-loop/delivery/bugs/9-x', branch: true, merged: false, pullRequest: null, links: LINKS, checked: CHECKED };
  return [
    { ...base, branch: false },
    base,
    { ...base, pullRequest: { ...pull('draft'), files: ['src/a.test.ts'] } },
    { ...base, pullRequest: pull('draft') },
    { ...base, pullRequest: pull('open') },
    { ...base, merged: true },
  ];
};
const VARIANTS: ((facts: StatusFacts) => StatusFacts)[] = [
  (facts) => facts,
  (facts) => ({ ...facts, pullRequest: pull('draft', [{ name: 'CI / test', state: 'failure' }]) }),
  (facts) => ({ ...facts, pullRequest: pull('draft', null) }),
  (facts) => ({ ...facts, pullRequest: pull('closed') }),
  (facts) => ({ ...facts, links: { page: null, issueUrl: LINKS.issueUrl, pullRequest: null } }),
  (facts) => ({ ...facts, links: { page: null, issueUrl: null, pullRequest: LINKS.pullRequest } }),
];
const BLOCKS = [...PRD_STEPS, ...fixSteps('bug'), ...fixSteps('visual')].flatMap((facts) => VARIANTS.map((variant) => statusBlock(variant(facts), NOW)));

/** The block's text a person reads in plain words: its Details (RAW) lines and its addresses left out. */
const readText = (block: string[]): string[] => block.filter((line) => !line.startsWith('Details (RAW')).map((line) => line.replace(URL, ''));

describe('every block', () => {
  it('shows no loop word outside the Details (RAW) lines', () => {
    expect(BLOCKS.length).toBe(22 * VARIANTS.length);
    for (const block of BLOCKS) for (const line of readText(block)) expect(line).not.toMatch(LOOP_WORDS);
  });

  it('explains each technical word the first time it appears, and only then', () => {
    for (const block of BLOCKS) {
      const lines = readText(block);
      for (const term of TERM_LIST) {
        const said = new RegExp(`\\b${escape(term)}\\b`, 'i');
        const explanation = `(${TERMS[term]})`;
        const firstLine = lines.findIndex((line) => said.test(line));
        const explained = lines.flatMap((line, index) => (line.includes(explanation) ? [index] : []));
        if (firstLine === -1) {
          expect(explained, `${term} explained but never said in:\n${block.join('\n')}`).toEqual([]);
          continue;
        }
        expect(explained, `${term} not explained once, where first said, in:\n${block.join('\n')}`).toEqual([firstLine]);
        const line = lines[firstLine] ?? '';
        expect(line.search(said)).toBeLessThan(line.indexOf(explanation));
        expect(line.split(explanation).length).toBe(2);
      }
    }
  });

  it('holds at most two Next items and a You line', () => {
    for (const block of BLOCKS) {
      expect(block.filter((line) => line.startsWith('You: ')).length).toBe(1);
      const next = block.find((line) => line.startsWith('Next: ')) ?? '';
      expect(next.split('; ').length).toBeLessThanOrEqual(2);
    }
  });
});
