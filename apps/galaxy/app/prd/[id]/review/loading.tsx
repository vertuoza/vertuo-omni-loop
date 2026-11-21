import { DossierLoading } from '../../../../src/skeleton/pages';

// /prd/<id>/review's skeleton (PRD omni-loop-20 s5): inside the layout's frame, sent at once while the review
// screen reads the approval, as every page under /prd has one (PRD 657 s4).

export default function Loading() {
  return <DossierLoading />;
}
