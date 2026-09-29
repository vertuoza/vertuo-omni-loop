import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsPage } from '../../../../src/docs/DocsPage';
import { guide } from '../../../../src/docs/source';
import { skillNames, skillPage } from '../../../../src/docs/skills';
import { SkillBody, skillSidebar, skillToc } from '../../../../src/docs/skills-view';
import { sidebarItems } from '../../../../src/docs/tree';

// /docs/skills/<name> (PRD 580): one skill's page, from its entry in the help table. Every page is
// built at build time, and a name no skill has is a 404: nothing here reads a session, a cookie or a
// database.

type Params = { params: Promise<{ name: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return skillNames().map((name) => ({ name }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const page = skillPage((await params).name);
  if (!page) notFound();
  return { title: page.command, description: page.summary };
}

export default async function SkillRoute({ params }: Params) {
  const page = skillPage((await params).name);
  if (!page) notFound();
  return (
    <DocsPage items={sidebarItems(guide.pageTree)} skills={skillSidebar()} url={page.url} title={page.command} description={page.summary} toc={skillToc(page)}>
      <SkillBody page={page} />
    </DocsPage>
  );
}
