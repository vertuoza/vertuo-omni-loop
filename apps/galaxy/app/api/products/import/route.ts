import { productTargetsDeps } from '../../../../src/product-repositories/product-repositories-live';
import { importProductTargets } from '../../../../src/product-repositories/product-repositories.controller';

// POST /api/products/import {repo, product, targets} → 200 {product, added, changed, unchanged}:
// `omni product import` writes a plan repository's plan.targets into a product as its repository links
// (src/product-repositories/product-repositories.controller.ts, PRD 1364 s5).
export const maxDuration = 60;

export function POST(request: Request) {
  return importProductTargets(request, productTargetsDeps());
}
