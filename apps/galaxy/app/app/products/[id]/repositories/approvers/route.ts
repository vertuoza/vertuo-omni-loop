// POST /app/products/<id>/repositories/approvers {member, state} → {member, state}: a workspace owner lists
// a member as asked to approve the product's PRDs, or skipped. DELETE …/approvers?member=<id> →
// {member, removed}: an owner takes them off the list (PRD 1364 s11, PRD 1322,
// src/product-repositories/repositories-tab.controller.ts).
export { postApprover as POST, deleteApprover as DELETE } from '../../../../../../src/product-repositories/repositories-tab.controller';
