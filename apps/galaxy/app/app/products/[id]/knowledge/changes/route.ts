// POST /app/products/<id>/knowledge/changes {op: 'change' | 'decide' | 'name', …} → {done}: a member changes
// the product's Legal entries or glossary (directly when they answer for the kind, else as a proposal), the
// kind's owner or delegate decides a proposal, a workspace owner names an owner or delegate (PRD 1795 s2,
// src/product-knowledge/product-knowledge.controller.ts).
export { postChange as POST } from '../../../../../../src/product-knowledge/product-knowledge.controller';
