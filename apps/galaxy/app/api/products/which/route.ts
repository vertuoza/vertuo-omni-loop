import { productTargetsDeps } from '../../../../src/product-repositories/product-repositories-live';
import { readProductsOf } from '../../../../src/product-repositories/product-repositories.controller';

// GET /api/products/which?repo=<owner/name> → 200 {products: [{name}]}: `omni product which` reads the
// products a repository is in (src/product-repositories/product-repositories.controller.ts, PRD 1364 s5).
export const maxDuration = 60;

export function GET(request: Request) {
  return readProductsOf(request, productTargetsDeps());
}
