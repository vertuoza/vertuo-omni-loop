import { EmptyState, SectionHeading } from '@omni/ui';
import { CarePane } from './CarePane';
import { MainPane } from './MainPane';
import { ProofPane } from './ProofPane';
import { ReadyPanel } from './ReadyPanel';
import type { ReadyView } from './ready';
import { FEATURE_EMPTY, type DossierView } from './view';

// The Feature tab of /prd/<id> (omni-loop-20 s7, was PR care): the Ready checks of the feature PR as a record
// on top (ReadyPanel.tsx), then PR care, Proof and After merge (was Main), each a section of its own whose id
// an old tab's link lands on (`#pr-care`, `#proof`, `#after-merge`), each only once it has something to show.
// With none of them, the tab says why. omni-loop-20 s13 draws them in Calm 2.

type Props = { view: DossierView; ready: ReadyView | null };

export function FeatureTab({ view, ready }: Props) {
  const { care, proof, mainWatch } = view;
  if (!ready && !care && !proof && !mainWatch) return <EmptyState size="inline" title={FEATURE_EMPTY} />;
  return (
    <>
      <ReadyPanel ready={ready} />
      {care && (
        <section id="pr-care" aria-label="PR care">
          <SectionHeading>PR care</SectionHeading>
          <CarePane care={care} />
        </section>
      )}
      {proof && (
        <section id="proof" aria-label="Proof">
          <SectionHeading>Proof</SectionHeading>
          <ProofPane proof={proof} action={view.link} />
        </section>
      )}
      {mainWatch && (
        <section id="after-merge" aria-label="After merge">
          <SectionHeading>After merge</SectionHeading>
          <MainPane main={mainWatch} findings={view.rewindFindings} />
        </section>
      )}
    </>
  );
}
