import { initAdvancedSearch } from 'fumadocs-core/search/server';
import { describe, expect, it } from 'vitest';
import { guideSearchIndexes, searchIndexes, skillSearchIndexes, type GuideSearchPage } from './search';
import { skillNames, type SkillEntry } from './skills';

// The docs' search index (PRD 580): the guide's pages and, beside them, one index per skill page, so
// the search box finds /docs/skills/<name> by its slash command, its summary and its sentences.

const guidePage: GuideSearchPage = {
  url: '/docs/loop',
  data: {
    title: 'How the loop works',
    description: 'The loop, step by step.',
    structuredData: { headings: [{ id: 'the-loop', content: 'The loop' }], contents: [{ heading: 'the-loop', content: 'A PRD goes in.' }] },
  },
};

const skill = (name: string, summary: string, detail: string): SkillEntry => ({
  name, kind: 'skill', who: 'you', usage: [`/omni:${name}`], summary, detail, group: 'build',
  when: 'Use it when you want it.', example: { type: `/omni:${name} 7`, result: 'done' },
});

const search = async (query: string, indexes: Parameters<typeof initAdvancedSearch>[0]['indexes']) =>
  (await initAdvancedSearch({ indexes }).search(query)).map((result) => result.url);

describe('the skills in the search index', () => {
  it('holds one index per skill page, titled by its slash command', () => {
    const indexes = skillSearchIndexes();
    expect(indexes.map((index) => index.url)).toEqual(skillNames().map((name) => `/docs/skills/${name}`));
    const wave = indexes.find((index) => index.url === '/docs/skills/wave');
    expect(wave?.title).toBe('/omni:wave');
    expect(wave?.id).toBe('/docs/skills/wave');
  });

  it('carries the summary and the sentences, braces filled with generic words', () => {
    const [index] = skillSearchIndexes([skill('lone', 'a lone summary', 'Merges into {defaultBranch}. Never twice.')]);
    expect(index!.description).toBe('a lone summary');
    const text = index!.structuredData.contents.map((content) => content.content);
    expect(text).toContain('a lone summary');
    expect(text).toContain('Merges into the default branch. Never twice.');
    expect(text).toContain('Use it when you want it.');
  });

  it('finds the wave skill page when searching wave', async () => {
    expect(await search('wave', searchIndexes([guidePage]))).toContain('/docs/skills/wave');
  });

  it('finds a skill by words of its sentences only', async () => {
    const indexes = skillSearchIndexes([skill('lone', 'a summary', 'Polishes the zeppelin.')]);
    expect(await search('zeppelin', indexes)).toContain('/docs/skills/lone');
  });
});

describe('the guide in the search index', () => {
  it('keeps each page as fumadocs indexes it: its title, description, url and structured data', () => {
    expect(guideSearchIndexes([guidePage])).toEqual([{
      id: '/docs/loop', url: '/docs/loop', title: 'How the loop works', description: 'The loop, step by step.',
      structuredData: guidePage.data.structuredData,
    }]);
  });

  it('puts the guide\'s pages first, then the skills\'', async () => {
    const urls = searchIndexes([guidePage]).map((index) => index.url);
    expect(urls[0]).toBe('/docs/loop');
    expect(urls.slice(1)).toEqual(skillNames().map((name) => `/docs/skills/${name}`));
    expect(await search('PRD goes', searchIndexes([guidePage]))).toContain('/docs/loop');
  });
});
