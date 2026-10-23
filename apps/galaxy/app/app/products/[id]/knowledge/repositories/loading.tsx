import { ListLoading } from '../../../../../../src/skeleton/pages';

// /app/products/<id>/knowledge/repositories's skeleton, while the page starts (PRD 2419 s1): inside the layout's frame, sent at once.

export default function Loading() {
  return <ListLoading what="the product's repositories" />;
}
