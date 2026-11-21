import { EmptyState, SectionHeading } from '@omni/ui';
import type { GapLine, MilestoneLine, TimelineSection, TimelineView } from './view';

// A PRD's Timeline tab (PRD 2370, s5): its own milestones, then one lane per repository, each
// milestone with its date linked to its pull request, each gap between two with its duration and who it
// waits on, the longest marked, each lane (the PRD's, then one per repository) under a SectionHeading with how many
// of its milestones are reached (omni-loop-20 s10). Rendered on the server; every word is text, escaped by React. It wears
// the fix pages' Timeline classes (fixes/TimelinePane.tsx).

function Milestone({ line }: { line: MilestoneLine }) {
  if (line.state !== 'done') {
    return (
      <li className={`fix-moment fix-moment-${line.state}`}>
        <span className="fix-moment-label">{line.label}</span>{' '}
        <span className="ask-hint">{line.words}</span>
      </li>
    );
  }
  return (
    <li className="fix-moment fix-moment-done">
      <span className="fix-moment-label">{line.label}</span>{' '}
      <span className="ask-hint">· {line.href
        ? <a href={line.href} target="_blank" rel="noopener noreferrer">{line.when}</a>
        : line.when}</span>
    </li>
  );
}

function Gap({ line }: { line: GapLine }) {
  return (
    <li className={`fix-moment prd-gap prd-gap-${line.state}${line.longest ? ' prd-gap-longest' : ''}`}>
      <span className="ask-hint">↳ {line.label} · {line.words} · waits on {line.waitsOn}</span>
      {line.longest && <>{' '}<strong className="prd-gap-mark">longest</strong></>}
    </li>
  );
}

/** How many of a lane's milestones are reached, out of all of them: `4/8`. */
function reached(section: TimelineSection): string {
  const milestones = section.lines.filter((line): line is MilestoneLine => line.kind === 'milestone');
  return `${milestones.filter((line) => line.state === 'done').length}/${milestones.length}`;
}

export function PrdTimelinePane({ timeline }: { timeline: TimelineView | null }) {
  if (timeline === null) return <EmptyState size="inline" title="No timeline for this page." />;
  if (timeline.state !== 'sections') return <EmptyState size="inline" title={timeline.words} />;
  return (
    <div className="prd-timeline">
      {timeline.sections.map((section) => (
        <section key={section.title} aria-label={section.title}>
          <SectionHeading count={reached(section)}>{section.title}</SectionHeading>
          <ol className="fix-timeline" aria-label={`Timeline: ${section.title}`}>
            {section.lines.map((line) => (line.kind === 'milestone'
              ? <Milestone key={line.id} line={line} />
              : <Gap key={line.id} line={line} />))}
          </ol>
        </section>
      ))}
    </div>
  );
}
