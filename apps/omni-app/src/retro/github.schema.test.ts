import { describe, expect, it } from 'vitest';
import {
  ContentSchema,
  IssuesSchema,
  ListSchema,
  PullSchema,
  PullsSchema,
  RetroDocSchema,
  RetroLessonsSchema,
  TreeSchema,
  parseGitHub,
} from './github.schema.ts';
import { RetroEventSchema } from './retro.ts';

const PULL = 'GET /repos/{owner}/{repo}/pulls/{pull_number}';
const pull = { number: 12, state: 'closed', base: { ref: 'main' }, head: { ref: 'feat/widget', sha: 'h1' } };

describe('parseGitHub — what the retro reads from GitHub', () => {
  it('reads a pull request whose optional fields are missing or null', () => {
    expect(parseGitHub(PullSchema, { ...pull, title: null, labels: null }, PULL)).toMatchObject({ number: 12, head: { sha: 'h1' } });
  });

  it('fails a pull request missing what the reader reads as is, naming the field', () => {
    expect(() => parseGitHub(PullSchema, { ...pull, head: { ref: 'feat/widget' } }, PULL)).toThrow(
      /^GET \/repos\/\{owner\}\/\{repo\}\/pulls\/\{pull_number\} answered an unexpected shape: head\.sha: /,
    );
  });

  it('fails a list of pull requests one of which has no opening time, naming its place', () => {
    expect(() => parseGitHub(PullsSchema, [{ ...pull, created_at: '2026-09-20T09:00:00Z' }, pull], 'GET pulls')).toThrow(
      /^GET pulls answered an unexpected shape: 1\.created_at: /,
    );
  });

  it('reads a tree, and fails an entry with no sha', () => {
    const tree = { tree: [{ path: 'a', type: 'blob', sha: 's1' }] };
    expect(parseGitHub(TreeSchema, tree, 'GET tree')).toEqual(tree);
    expect(() => parseGitHub(TreeSchema, { tree: [{ path: 'a', type: 'blob' }] }, 'GET tree')).toThrow(/tree\.0\.sha: /);
  });

  it('reads a folder or one file from the contents API', () => {
    expect(parseGitHub(ContentSchema, [{ name: 'a' }], 'GET contents')).toEqual([{ name: 'a' }]);
    expect(parseGitHub(ContentSchema, { type: 'file', content: 'aGk=', encoding: 'base64' }, 'GET contents')).toMatchObject({ type: 'file' });
  });

  it('reads a page of a list route as its items, and fails an answer that is no list', () => {
    expect(parseGitHub(ListSchema, [{ id: 1 }, 'two'], 'GET events')).toEqual([{ id: 1 }, 'two']);
    expect(() => parseGitHub(ListSchema, { message: 'Not Found' }, 'GET events')).toThrow(/^GET events answered an unexpected shape: /);
  });

  it('fails an issue whose number is not a number, naming it', () => {
    const issue = { number: '7', html_url: 'u', state: 'open', title: 't', body: null };
    expect(() => parseGitHub(IssuesSchema, [issue], 'GET issues')).toThrow(/0\.number: /);
  });
});

describe('a retro.json read back from a branch', () => {
  it('keeps its runs as they were written', () => {
    expect(RetroDocSchema.parse({ prd: 7, runs: [{ run: 'merge' }] })).toEqual({ runs: [{ run: 'merge' }] });
  });

  it('holds no run when it is not the retro’s JSON, as the reader always treated it', () => {
    for (const doc of [null, 'text', [], { runs: 'none' }]) expect(RetroDocSchema.parse(doc)).toEqual({ runs: [] });
  });

  it('gives a run’s lessons, and none for a run without a list of them', () => {
    expect(RetroLessonsSchema.parse({ lessons: [{ text: 'A' }, 'B'] })).toEqual({ lessons: [{ text: 'A' }, { text: null }] });
    expect(RetroLessonsSchema.parse({ run: 'day-14' })).toEqual({ lessons: [] });
    expect(RetroLessonsSchema.parse(null)).toEqual({ lessons: [] });
  });
});

describe('the retro event', () => {
  const data = { installationId: 1, owner: 'acme', repo: 'widgets', prNumber: 12, mergeSha: 'merge1', mergedAt: null };

  it('reads the merged pull request it names', () => {
    expect(RetroEventSchema.parse(data)).toEqual(data);
  });

  it('fails an event missing a field, naming it', () => {
    const { prNumber, ...rest } = data;
    const parsed = RetroEventSchema.safeParse(rest);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['prNumber']);
  });
});
