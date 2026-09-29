import type { Metadata } from 'next';
import { DocsPage } from '../../../src/docs/DocsPage';
import { guide } from '../../../src/docs/source';
import { skillsOverview, SKILLS_PATH } from '../../../src/docs/skills';
import { SkillsOverview, skillSidebar } from '../../../src/docs/skills-view';
import { sidebarItems } from '../../../src/docs/tree';

// /docs/skills (PRD 580): every skill of the Omni Loop, grouped by what you want to do, one card each
// linking its page. Built at build time from the help table's skill entries; nothing here reads a
// session, a cookie or a database.

const TITLE = 'Skills';
const LEDE = 'Every skill of the Omni Loop, by what you want to do.';

export const metadata: Metadata = { title: TITLE, description: LEDE };

export default function SkillsRoute() {
  return (
    <DocsPage items={sidebarItems(guide.pageTree)} skills={skillSidebar()} url={SKILLS_PATH} title={TITLE} description={LEDE} toc={[]}>
      <SkillsOverview groups={skillsOverview()} />
    </DocsPage>
  );
}
