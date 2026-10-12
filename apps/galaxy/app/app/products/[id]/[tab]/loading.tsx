import { ListLoading } from '../../../../../src/skeleton/pages';

// /app/products/<id>/<tab>'s skeleton, while the page starts (PRD 1364 s10): inside the layout's frame, sent at once.

export default function Loading() {
  return <ListLoading what="the product" />;
}
