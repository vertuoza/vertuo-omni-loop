import { ListLoading } from '../../../../src/skeleton/pages';

// /prd/<id>/attestation's skeleton, while the page starts (PRD 1612 s4): inside the layout's frame, sent
// at once, the pinned files drawn as a list's rows.

export default function Loading() {
  return <ListLoading what="the attestation" />;
}
