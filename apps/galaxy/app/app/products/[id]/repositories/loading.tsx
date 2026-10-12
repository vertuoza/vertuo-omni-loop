import { ListLoading } from '../../../../../src/skeleton/pages';

// /app/products/<id>/repositories' skeleton, while the page starts (PRD 1364 s11): inside the layout's frame, sent at once.

export default function Loading() {
  return <ListLoading what="the product's repositories" />;
}
