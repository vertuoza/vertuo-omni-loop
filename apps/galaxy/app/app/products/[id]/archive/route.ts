// POST /app/products/<id>/archive → {id, name, archivedAt}: a workspace owner archives the product; it leaves
// every member's list and every lookup, and nothing under it is erased (PRD 2232 s1,
// src/product-home/product-home.controller.ts).
export { postArchive as POST } from '../../../../../src/product-home/product-home.controller';
