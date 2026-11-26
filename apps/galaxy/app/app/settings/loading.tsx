import { ListLoading } from '../../../src/skeleton/pages';

// /app/settings' skeleton (PRD 657 s4, omni-loop-32 s4), while the settings home starts: a list's, inside
// the layout's frame, sent at once.

export default function Loading() {
  return <ListLoading what="the settings" />;
}
