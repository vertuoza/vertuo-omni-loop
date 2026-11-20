import { SectionHeading } from '@omni/ui';
import { PitchPane } from './PitchPane';
import { RetroPane } from './RetroPane';
import type { DossierView } from './view';

// The Retro tab of /prd/<id> (omni-loop-20 s7): the retro, with its pull request on top (RetroPane.tsx), then
// Pitch once the PRD holds a pitch, a section whose id an old `?tab=pitch` link lands on (`#pitch`).
// omni-loop-20 s13 draws them in Calm 2.

export function RetroTab({ view }: { view: DossierView }) {
  return (
    <>
      <RetroPane retro={view.retro} />
      {view.pitch && (
        <section id="pitch" aria-label="Pitch">
          <SectionHeading>Pitch</SectionHeading>
          <PitchPane pitch={view.pitch} action={view.link} />
        </section>
      )}
    </>
  );
}
