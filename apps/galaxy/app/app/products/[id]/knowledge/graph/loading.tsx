import { ListLoading } from '../../../../../../src/skeleton/pages';

// /app/products/<id>/knowledge/graph's skeleton, while the page starts (PRD 1798 s6): inside the layout's frame, sent at once.

export default function Loading() {
  return <ListLoading what="the product's knowledge graph" />;
}
