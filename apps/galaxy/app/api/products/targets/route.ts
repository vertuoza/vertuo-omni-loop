import { productTargetsDeps } from '../../../../src/product-repositories/product-repositories-live';
import { readProductTargets } from '../../../../src/product-repositories/product-repositories.controller';

// GET /api/products/targets?repo=<owner/name>&product=<name> → 200 {product, targets}: `omni targets`
// reads a product's repository links as a plan repository's targets when its config names
// plan.product (src/product-repositories/product-repositories.controller.ts, PRD 1364 s4).
export const maxDuration = 60;

export function GET(request: Request) {
  return readProductTargets(request, productTargetsDeps());
}
