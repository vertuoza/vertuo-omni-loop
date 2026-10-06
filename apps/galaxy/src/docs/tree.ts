import type { Node, Root } from 'fumadocs-core/page-tree';
import { loader, type MetaData, type PageData, type StaticSource } from 'fumadocs-core/source';
import { plainText } from 'vertuo-omni-plan/kit/lib/outbox/plain-text.ts';
import { DOCS_PATH } from './paths';

// The guide's pages through fumadocs-core (PRD 346): its loader serves them under /docs, builds the
// page tree in meta.json's order, and finds a page by its slugs. source.ts hands it what fumadocs-mdx
// compiled; the tests hand it the same files read from the folder.

/** fumadocs-core's loader over the guide, at /docs. */
export function guideLoader<C extends { pageData: PageData; metaData: MetaData }>(source: StaticSource<C>) {
  return loader({ baseUrl: DOCS_PATH, source });
}

/** One link of the sidebar. */
export interface SidebarItem {
  name: string;
  url: string;
}

/** The sidebar: every page of the tree, in its order, folders flattened. */
export function sidebarItems(tree: Root): SidebarItem[] {
  const walk = (nodes: Node[]): SidebarItem[] =>
    nodes.flatMap((node) => {
      if (node.type === 'page') return [{ name: plainText(node.name), url: node.url }];
      if (node.type === 'folder') return [...(node.index ? walk([node.index]) : []), ...walk(node.children)];
      return [];
    });
  return walk(tree.children);
}
