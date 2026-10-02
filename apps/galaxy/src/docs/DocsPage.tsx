import type { ReactNode } from 'react';
import type { TOCItemType } from 'fumadocs-core/toc';
import { CodeCopy } from './CodeCopy';
import { DocsSearch } from './DocsSearch';
import { ALL_SKILLS } from './skills-view';
import type { SidebarItem } from './tree';

// PRD 580: after the guide's pages, the sidebar shows Skills › All skills, and on a skills page every
// skill's link under it, the one shown marked current.

// One page of the guide at /docs (PRD 346), in the app's own look: the sidebar (search, then every page
// in meta.json's order, the one shown marked current), the page (its title, its description, its
// body as fumadocs-mdx compiled it), and its table of contents. Fumadocs gives the data; the layout
// and docs.css are ours. On a phone the three stack: the sidebar, the page, and no table of contents.

export interface DocsPageProps {
  /** The sidebar, in order. */
  items: readonly SidebarItem[];
  /** The URL of the page shown. */
  url: string;
  title: string;
  description?: string;
  /** The page's headings, as fumadocs-mdx found them. */
  toc: readonly TOCItemType[];
  /** The page's body. */
  children: ReactNode;
  /** On a skills page, every skill's link, shown under All skills (PRD 580). */
  skills?: readonly SidebarItem[];
}

export function DocsPage({ items, url, title, description, toc, children, skills }: DocsPageProps) {
  return (
    <div className="docs">
      <aside className="docs-side">
        <DocsSearch />
        <nav className="docs-nav" aria-label="Guide">
          <ol>
            {items.map((item) => (
              <li key={item.url}>
                <a href={item.url} aria-current={item.url === url ? 'page' : undefined}>{item.name}</a>
              </li>
            ))}
          </ol>
        </nav>
        <nav className="docs-nav" aria-label="Skills">
          <p className="docs-nav-head">Skills</p>
          <ol>
            {[ALL_SKILLS, ...(skills ?? [])].map((item) => (
              <li key={item.url}>
                <a href={item.url} aria-current={item.url === url ? 'page' : undefined}>{item.name}</a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
      <article className="docs-article">
        <h1 className="docs-title">{title}</h1>
        {description ? <p className="docs-lede">{description}</p> : null}
        <div className="docs-md">{children}</div>
        <CodeCopy />
      </article>
      {toc.length > 0 ? (
        <nav className="docs-toc" aria-label="On this page">
          <p className="docs-toc-head">On this page</p>
          <ol>
            {toc.map((heading) => (
              <li key={heading.url} data-depth={heading.depth}>
                <a href={heading.url}>{heading.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </div>
  );
}
