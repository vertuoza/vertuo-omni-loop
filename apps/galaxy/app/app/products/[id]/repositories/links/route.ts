// POST /app/products/<id>/repositories/links {repo, role, knowledge, readAt, readOnly, consumes} → {link}: a
// workspace owner adds a repository to the product, or sets every field of its link. DELETE
// …/links?repo=<owner/name> → {repo, removed}: an owner takes it out (PRD 1364 s11,
// src/product-repositories/repositories-tab.controller.ts).
export { postLink as POST, deleteLink as DELETE } from '../../../../../../src/product-repositories/repositories-tab.controller';
