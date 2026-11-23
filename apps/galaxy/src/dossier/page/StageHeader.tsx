import { Badge, Button, ListRow, Stack, StageTrack } from '@omni/ui';
import type { TrackView } from './next-step';
import type { StageView } from './stage';
import { PitchAction } from './PitchAction';
import { StageHeaderCopy } from './StageHeaderCopy';

// The stage's pieces of /prd/<id>'s head (PRD 426, laid out on the page anatomy by omni-loop-20 s6),
// rendered on the server: the stage's one button, the track Idea ─ PRD ─ Inbox ─ Building ─ Outbox ─
// Shipped ─ Retro (PRD 587) on @omni/ui's StageTrack, the stage said once, and the issue and pull
// requests that exist for About this PRD. Hovering a stage says when it was reached, and the current one
// when it was last synced. A fix's track is Asked ─ Picked ─ Approved ─ Merged ─ Released. The open
// feature PR's link carries its health chip (PRD 790, s2).

/** The title of a page that has no PageHeader yet (the concept page): the same marks, in the old h1. */
export function DossierTitle({ heading, draft, title, issueUrl, badge = null }: {
  heading: string; draft: boolean; title: string; issueUrl: string | null; badge?: string | null;
}) {
  return (
    <h1 className="dossier-title">
      {badge && <><span className="dossier-kind">{badge}</span>{' '}</>}
      {draft || !issueUrl ? (
        <span className="dossier-draft">DRAFT</span>
      ) : (
        <a className="dossier-number" href={issueUrl} target="_blank" rel="noopener noreferrer">{heading} ↗</a>
      )}{' '}
      <span>{title}</span>
    </h1>
  );
}

/** The stage's one button: a link to GitHub, a command to copy, or Pitch's panel (PRD 859), disabled in
 * the demo; nothing when the stage has none. */
export function StageAction({ stage, demo = false }: { stage: StageView | null; demo?: boolean }) {
  const action = stage?.action;
  if (action?.kind === 'pitch') return <PitchAction prd={action.prd} disabled={demo} />;
  if (action?.kind === 'link') {
    return <Button variant="primary" href={action.href} external>{action.label}</Button>;
  }
  if (action?.kind === 'copy') {
    const copy = <StageHeaderCopy label={action.label} command={action.command} />;
    if (!stage?.fixes) return copy;
    // Fix with answers (PRD 2223): the answers it acts on, under the button, linking the Outbox tab (a query-only link, so it stays on this page).
    return (
      <Stack gap="1" align="end">
        {copy}
        <a className="stage-fixes ask-hint" href="?tab=outbox">{stage.fixes}</a>
      </Stack>
    );
  }
  return null;
}

/** The stage said once (omni-loop-20 s6): @omni/ui's StageTrack, the current stage bold with its progress,
 * in the signal tone while it waits on the viewer, each stage's time on hover. */
export function HeadTrack({ track }: { track: TrackView }) {
  return (
    <StageTrack
      stages={track.stages}
      stage={track.stage}
      tone={track.tone}
      times={track.times}
      {...(track.progress === undefined ? {} : { progress: track.progress })}
    />
  );
}

/** The On GitHub cell's value: each issue or pull request that exists, open or ✓, and the open feature
 * PR's health chip. */
export function StageLinks({ links }: { links: StageView['links'] }) {
  return (
    <ul className="stage-links" aria-label="On GitHub">
      {links.map((link) => (
        <li key={link.label}>
          <ListRow
            density="compact"
            title={<a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>}
            trailing={(
              <>
                <span className="ask-hint">{link.done ? '✓' : 'open'}</span>
                {link.chip && <Badge title="PR care" tone={link.chip.tone === 'red' ? 'danger' : link.chip.tone === 'grey' ? 'neutral' : 'success'}>{link.chip.label}</Badge>}
              </>
            )}
          />
        </li>
      ))}
    </ul>
  );
}
