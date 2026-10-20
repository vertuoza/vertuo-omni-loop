// POST /app/products/<id>/repositories/plan {repo: "owner/name" | null} → {plan}: a workspace owner names
// the product's plan repository, one of the workspace's repositories, or none
// (src/product-repositories/repositories-tab.controller.ts).
export { postPlan as POST } from '../../../../../../src/product-repositories/repositories-tab.controller';
