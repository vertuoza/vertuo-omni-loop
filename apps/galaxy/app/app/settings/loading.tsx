import { ListLoading } from '../../../src/skeleton/pages';

// /app/settings' skeleton (PRD 657 s4), while it redirects to the Fleets tab (PRD 733): the fleets list's,
// inside the layout's frame, sent at once.

export default function Loading() {
  return <ListLoading what="the fleets" />;
}
