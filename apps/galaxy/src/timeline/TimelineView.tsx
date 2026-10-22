import type { GapLine, MilestoneLine, TimelineView } from './view';

// A PRD's Timeline tab (PRD 2370, s5): its own milestones, then one lane per repository, each
// milestone with its date linked to its pull request, each gap between two with its duration and who it
// waits on, the longest marked. Rendered on the server; every word is text, escaped by React. It wears
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

export function PrdTimelinePane({ timeline }: { timeline: TimelineView | null }) {
  if (timeline === null) return <p className="dossier-empty">No timeline for this page.</p>;
  if (timeline.state !== 'sections') return <p className="dossier-empty">{timeline.words}</p>;
  return (
    <div className="prd-timeline">
      {timeline.sections.map((section) => (
        <section key={section.title} aria-label={section.title}>
          <h3 className="prd-timeline-title">{section.title}</h3>
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
