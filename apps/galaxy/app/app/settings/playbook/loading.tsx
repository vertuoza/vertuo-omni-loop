import { ListLoading } from '../../../../src/skeleton/pages';

// /app/settings/playbook's skeleton, while the page starts (PRD 2417 s6): inside the layout's frame,
// sent at once.

export default function Loading() {
  return <ListLoading what="the playbook" />;
}
