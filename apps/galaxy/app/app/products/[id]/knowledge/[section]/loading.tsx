import { ListLoading } from '../../../../../../src/skeleton/pages';

// /app/products/<id>/knowledge/<section>'s skeleton, while the page starts (PRD 2240 s3): inside the layout's frame, sent at once.

export default function Loading() {
  return <ListLoading what="the product's knowledge" />;
}
