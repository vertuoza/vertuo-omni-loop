import { Badge, DefinitionList, Notice, Text, type DefinitionFact } from '@omni/ui';
import { PersonChip } from '../../people/PersonChip';
import { ProductPicker } from './ProductPicker';
import { StageLinks } from './StageHeader';
import type { DossierView } from './view';

// About this PRD (omni-loop-20 s6): the facts the head has no room for, as side facts under the tab bar,
// so nothing of the old facts strip is lost — the product picker, the repositories, the issue and pull
// requests with when GitHub was last read, the approval, who the Tech Approval waits on, the PRD's status on
// main, its timeline line, and who opened it and when. A fact with nothing to show is left out. A fix's
// page shows About this fix: its repositories, its issue and fix PR, and who opened it.

type Props = { view: DossierView; supabase: { url: string; key: string } | null };

/** The repositories, each a chip. */
function Repos({ repos }: { repos: readonly string[] }) {
  return (
    <ul className="dossier-repos" aria-label="Repositories">
      {repos.map((repo) => <li key={repo} className="dossier-repo"><Badge tone="neutral">{repo}</Badge></li>)}
    </ul>
  );
}

/** The issue and pull requests of a PRD or a fix. */
const linksOf = (view: DossierView) => view.fix?.links ?? view.stage?.links ?? [];

/** The issue and pull requests, and when GitHub was last read. */
function OnGithub({ view }: { view: DossierView }) {
  const links = linksOf(view);
  return (
    <>
      {links.length > 0 && <StageLinks links={links} />}
      {view.githubAsOf && (
        <p className="ask-hint github-as-of">
          {view.githubAsOf}{view.githubResumes && <> · <strong>{view.githubResumes}</strong></>}
        </p>
      )}
    </>
  );
}

/** The approval of a ◆ PRD: its state, then who approved it and when, or what changed since. */
function Approval({ approval }: { approval: NonNullable<DossierView['approval']> }) {
  if (approval.state === 'unread') return <Notice tone="danger">{approval.words}</Notice>;
  return (
    <span className={`dossier-approval dossier-approval-${approval.state}`}>
      <strong>{approval.words}</strong>
      {approval.detail && <Text size="small" tone="secondary">{approval.detail}</Text>}
    </span>
  );
}

/** A watched PRD's status on main (PRD 2410, s3), linking the Feature tab's After merge section. */
function Main({ view }: { view: DossierView }) {
  const main = view.mainWatch;
  if (!main) return null;
  const href = `${view.tabs.find((t) => t.kind === 'feature')?.href ?? view.link}#after-merge`;
  return <a className={`dossier-main dossier-main-${main.state}`} href={href}><strong>{main.words}</strong></a>;
}

/** A ◆ PRD's approval facts: the approval, then who the Tech Approval waits on. */
function approvalFacts(approval: DossierView['approval']): DefinitionFact[] {
  if (!approval) return [];
  return [
    { id: 'approval', label: 'Approval', value: <Approval approval={approval} /> },
    { id: 'tech', label: 'Tech Approval', value: approval.tech?.waiting ?? null },
  ];
}

/** The timeline's line without its `Now: <stage>` words: the track says the stage once, and its hover the time. */
const timelineWords = (line: string | null) => (line === null ? null : line.replace(/ · Now: .*$/, ''));

/** Who opened it, with their face when the page knows them. */
function Opened({ view }: { view: DossierView }) {
  if (!view.openedBy) return <>{view.opened}</>;
  return <span className="ask-hint">opened by <PersonChip person={view.openedBy} size="inline" /> · {view.openedAt}</span>;
}

/** The facts About this PRD lists, in order; one with no value is left out by the list. */
function aboutFacts(view: DossierView): DefinitionFact[] {
  return [
    { id: 'repos', label: view.repos.length > 1 ? 'Repositories' : 'Repository', value: <Repos repos={view.repos} /> },
    { id: 'github', label: 'On GitHub', value: linksOf(view).length > 0 || view.githubAsOf ? <OnGithub view={view} /> : null },
    ...approvalFacts(view.approval),
    { id: 'main', label: 'Main', value: view.mainWatch ? <Main view={view} /> : null },
    { id: 'timeline', label: 'Timeline', value: timelineWords(view.timelineLine) },
    { id: 'opened', label: 'Opened', value: <Opened view={view} /> },
  ];
}

export function AboutPrd({ view, supabase }: Props) {
  const product = view.kind === 'prd' && supabase !== null && !view.demo;
  return (
    <section className="dossier-about" aria-label={view.kind === 'prd' ? 'About this PRD' : 'About this fix'}>
      {product && <ProductPicker dossier={view.id} />}
      <DefinitionList density="compact" facts={aboutFacts(view)} />
    </section>
  );
}
