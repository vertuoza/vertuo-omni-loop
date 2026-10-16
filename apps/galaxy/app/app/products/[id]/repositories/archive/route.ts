// POST /app/products/<id>/repositories/archive {archived} → {archivedAt}: a workspace owner archives the
// product's plan repository (true), or undoes it (false) (PRD 2011 s17,
// src/product-repositories/repositories-tab.controller.ts). A person's click only: refused while a repository is
// below step 5 or a record born in the plan repository is open, naming each. It records the decision; the App
// makes the repository read-only on GitHub.
export { postArchive as POST } from '../../../../../../src/product-repositories/repositories-tab.controller';
