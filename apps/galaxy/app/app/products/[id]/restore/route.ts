// POST /app/products/<id>/restore → {id, name, archivedAt: null}: a workspace owner restores an archived
// product as it was (PRD 2232 s1, src/product-home/product-home.controller.ts).
export { postRestore as POST } from '../../../../../src/product-home/product-home.controller';
