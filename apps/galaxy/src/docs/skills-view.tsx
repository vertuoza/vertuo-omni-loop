import type { TOCItemType } from 'fumadocs-core/toc';
import { badgeLabel } from './badges';
import { skillNames, skillPage, SKILLS_PATH, type SkillLink, type SkillPageModel, type SkillSection } from './skills';
import type { SidebarItem } from './tree';

// The skills pages as drawn inside DocsPage (PRD 580): the overview's sections and cards, one skill's
// sections, its table of contents and the sidebar's skill links. skills.ts holds what they say; this
// file only lays it out, with the guide's own classes (docs-md, docs-code) and docs.css's cards.

/** The sidebar's links under All skills, in the overview's order. */
export function skillSidebar(): SidebarItem[] {
  return skillNames().map((name) => {
    const page = skillPage(name)!;
    return { name: page.command, url: page.url };
  });
}

/** Where the overview is, as the sidebar's first skills link. */
export const ALL_SKILLS: SidebarItem = { name: 'All skills', url: SKILLS_PATH };

const HEADINGS = {
  what: { id: 'what-it-does', title: 'What it does' },
  when: { id: 'when-to-use-it', title: 'When to use it' },
  how: { id: 'how-to-use-it', title: 'How to use it' },
  example: { id: 'example', title: 'Example' },
  who: { id: 'who-runs-it', title: 'Who runs it' },
  related: { id: 'related-skills', title: 'Related skills' },
} as const;

/** The headings a skill page shows, in order: Related skills only when it has any. */
function headingsOf(page: SkillPageModel) {
  const { what, when, how, example, who, related } = HEADINGS;
  return [
    { ...what, depth: 2 }, { ...when, depth: 2 }, { ...how, depth: 2 }, { ...example, depth: 3 }, { ...who, depth: 2 },
    ...(page.related.length > 0 ? [{ ...related, depth: 2 }] : []),
  ];
}

/** A skill page's table of contents. */
export function skillToc(page: SkillPageModel): TOCItemType[] {
  return headingsOf(page).map(({ id, title, depth }) => ({ title, url: `#${id}`, depth }));
}

/** A block a person types in Claude Code, badged as the guide's are. */
function AgentBlock({ lines }: { lines: readonly string[] }) {
  return (
    <div className="docs-code">
      <div className="docs-badges">
        <span className="docs-badge" data-kind="agent">{badgeLabel({ kind: 'agent' })}</span>
        <button type="button" className="docs-copy" aria-label="Copy the code">
          <svg className="docs-copy-icon" width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
            <rect x={5} y={5} width={9} height={9} rx={1.5} strokeWidth={1.5} />
            <path d="M2 11V3a1 1 0 0 1 1-1h8" strokeWidth={1.5} />
          </svg>
          <svg className="docs-copy-done" width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M3 8.5l3.5 3.5L13 4" strokeWidth={2} />
          </svg>
        </button>
      </div>
      <pre><code>{lines.join('\n')}</code></pre>
    </div>
  );
}

function Links({ skills }: { skills: readonly SkillLink[] }) {
  return <ul>{skills.map((skill) => <li key={skill.name}><a href={skill.url}>{skill.command}</a></li>)}</ul>;
}

/** /docs/skills: one section per group, one card per skill linking its page. */
export function SkillsOverview({ groups }: { groups: readonly SkillSection[] }) {
  return (
    <>
      {groups.map((group) => (
        <section key={group.id}>
          <h2 id={group.id}>{group.title}</h2>
          <ul className="docs-skill-cards">
            {group.skills.map((skill) => (
              <li key={skill.name}>
                <a className="docs-skill-card" href={skill.url}><code>{skill.command}</code><span>{skill.summary}</span></a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** /docs/skills/<name>: what it does, when to use it, how, who runs it, related skills, its SKILL.md. */
export function SkillBody({ page }: { page: SkillPageModel }) {
  const { what, when, how, example, who, related } = HEADINGS;
  return (
    <>
      <h2 id={what.id}>{what.title}</h2>
      <p>{page.what}</p>
      <h2 id={when.id}>{when.title}</h2>
      <p>{page.when}</p>
      <h2 id={how.id}>{how.title}</h2>
      <AgentBlock lines={page.usage} />
      <h3 id={example.id}>{example.title}</h3>
      <AgentBlock lines={[page.example.type]} />
      <p>{`→ ${page.example.result}`}</p>
      <h2 id={who.id}>{who.title}</h2>
      {page.runBy === 'you'
        ? <p>You type it in Claude Code.</p>
        : <><p>Other skills run it:</p><Links skills={page.runBy} /></>}
      {page.related.length > 0 ? <><h2 id={related.id}>{related.title}</h2><Links skills={page.related} /></> : null}
      <p className="docs-skill-source">Its full instructions, written for Claude: <a href={page.source}>{`kit/plugin/skills/${page.name}/SKILL.md`}</a></p>
    </>
  );
}
