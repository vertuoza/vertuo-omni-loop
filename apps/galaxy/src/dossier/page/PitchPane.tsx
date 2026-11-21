'use client';
import { Button, Card, Code, DefinitionList, EmptyState, Notice, SectionHeading, SegmentedControl, Text } from '@omni/ui';
import type { PitchAudienceView, PitchView } from './pitch';
import { PitchPaneCopy } from './PitchPaneCopy';

// Pitch, a section of the Retro tab of /prd/<id> (PRD 859 s3; drawn in Calm 2 by omni-loop-20 s13): what
// /omni:pitch made of a shipped PRD, the latest pitch per audience, Customers first. Each: the audience's
// picker (its pitches by date, a set of links to `?tab=retro&pitch=<id>`, so it works before any script
// runs), the slide, the 16:9 video's player, the words, a download per file of the five, and Copy GIF link.
// Read-only; every text is escaped.

function PitchPicker({ action, pitch }: { action: string; pitch: PitchAudienceView }) {
  if (pitch.versions.length < 2) return null;
  return (
    <SegmentedControl
      label={`${pitch.label} pitches`}
      size="sm"
      value={pitch.id}
      options={pitch.versions.map((v) => ({ id: v.id, label: v.label, href: `${action}?tab=retro&pitch=${v.id}#pitch` }))}
    />
  );
}

function PitchRun({ action, pitch }: { action: string; pitch: PitchAudienceView }) {
  const missing = pitch.slide === null || pitch.video === null;
  return (
    <section aria-label={`${pitch.label} pitch`}>
      <Card>
        <div className="pitch-run">
          <header className="pitch-run-head">
            <SectionHeading level="3">{pitch.label}</SectionHeading>
            <PitchPicker action={action} pitch={pitch} />
          </header>
          <DefinitionList
            facts={[
              { id: 'made', label: 'Made', value: pitch.at },
              { id: 'look', label: 'Look', value: pitch.look },
              { id: 'commit', label: 'Commit', value: <Code>{pitch.commit}</Code> },
            ]}
          />
          <div className="pitch-media">
            {pitch.slide && <img className="pitch-slide" src={pitch.slide} alt={`Slide: ${pitch.hook}`} />}
            {pitch.video && <video className="pitch-video" src={pitch.video} controls preload="metadata" playsInline aria-label={`Video: ${pitch.hook}`} />}
          </div>
          {missing && <Notice tone="danger">A file could not be loaded. Reload the page in a moment.</Notice>}
          <div className="pitch-words">
            <Text size="caption" tone="secondary" strong>{pitch.kicker}</Text>
            <Text size="heading" strong>{pitch.hook}</Text>
            <Text>{pitch.benefit}</Text>
            <Text tone="secondary">{pitch.closing}</Text>
          </div>
          <ul className="pitch-downloads" aria-label="Downloads">
            {pitch.downloads.map((d) => (
              <li key={d.name}>
                {d.href
                  ? <a className="omni-button omni-button--quiet omni-button--sm" href={d.href} download={d.name}>{d.name}</a>
                  : <Button variant="quiet" size="sm" disabled title="Could not be loaded">{d.name}</Button>}
              </li>
            ))}
            <li><PitchPaneCopy path={pitch.gif} /></li>
          </ul>
        </div>
      </Card>
    </section>
  );
}

export function PitchPane({ pitch, action }: { pitch: PitchView | null; action: string }) {
  if (!pitch) return <EmptyState size="inline" title="No pitch was made for this PRD." />;
  return (
    <div className="pitch-runs">
      {pitch.audiences.map((p) => <PitchRun key={p.audience} action={action} pitch={p} />)}
    </div>
  );
}
