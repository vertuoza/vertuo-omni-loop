import { ListLoading } from '../../../../src/skeleton/pages';

// /prd/<id>/attestation's skeleton (PRD 1612 s4, folded into PRD 1548): inside the layout's frame, sent at
// once while the route redirects to the PRD page's approval, as every page under /prd has one (PRD 657 s4).

export default function Loading() {
  return <ListLoading what="the attestation" />;
}
