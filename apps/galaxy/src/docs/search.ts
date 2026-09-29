import type { AdvancedIndex } from 'fumadocs-core/search/server';
import { skillNames, skillPage, type SkillEntry } from './skills';

// The docs' search index (PRD 346, PRD 580): what /docs/search serves, built once at build time. The
// guide's pages, indexed as fumadocs indexes them, then one index per skill page (/docs/skills/<name>),
// built from the same model its page draws: its slash command, its summary and its sentences. Pure:
// the route hands it the guide's pages.

type StructuredData = AdvancedIndex['structuredData'];

/** A guide page, the fields its index reads (what fumadocs-mdx compiled from docs/guide/). */
export interface GuideSearchPage {
  url: string;
  data: { title?: string; description?: string; structuredData: StructuredData };
}

/** The guide's pages, each indexed as fumadocs' createFromSource indexes it. */
export function guideSearchIndexes(pages: readonly GuideSearchPage[]): AdvancedIndex[] {
  return pages.map((page) => ({
    id: page.url,
    url: page.url,
    title: page.data.title ?? page.url,
    description: page.data.description,
    structuredData: page.data.structuredData,
  }));
}

/** One index per skill page, in the overview's order: titled by its slash command, holding its
 * summary, what it does, when to use it, its usage and its example. */
export function skillSearchIndexes(entries?: readonly SkillEntry[]): AdvancedIndex[] {
  return skillNames(entries).flatMap((name) => {
    const page = skillPage(name, entries);
    if (!page) return [];
    const texts = [page.summary, page.what, page.when, ...page.usage, page.example.type].filter((text) => text.trim() !== '');
    return [{
      id: page.url,
      url: page.url,
      title: page.command,
      description: page.summary,
      breadcrumbs: ['Skills'],
      structuredData: { headings: [], contents: [...new Set(texts)].map((content) => ({ heading: undefined, content })) },
    }];
  });
}

/** The whole index: the guide's pages first, then the skills'. */
export function searchIndexes(guidePages: readonly GuideSearchPage[], entries?: readonly SkillEntry[]): AdvancedIndex[] {
  return [...guideSearchIndexes(guidePages), ...skillSearchIndexes(entries)];
}
