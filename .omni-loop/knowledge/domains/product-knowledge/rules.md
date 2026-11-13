# Product knowledge rules

## BR-PRODUCT-113

A Legal knowledge entry's source law is accepted as any single line of up to 500 characters, either a web link or the law's name and article. It is never refused for not being a web address.

Serves: P-PRODUCT-94
Source: .omni-loop/delivery/shipped/1795-product-knowledge-page/outbox/settled.md, entry s1-01-legal-source-free-text, PRD #1795
Enforced by: supabase/checks/product_knowledge.sql, kit/lib/knowledge/check-knowledge-legal.ts
Stated: 2026-10-16
Decided: nobody — adopted when raised (medium), 2026-10-15
Merged: @pierrederval, 2026-10-16, PR #2032
Kept id: moved from product, PRD 2346

## BR-PRODUCT-114

A new Legal entry with no owner named is owned by the person who wrote it; one that came from a proposal is owned by its proposer once approved, unless they named someone else. Anyone allowed may change the owner later.

Serves: P-PRODUCT-95
Source: .omni-loop/delivery/shipped/1795-product-knowledge-page/outbox/settled.md, entry s1-02-legal-entry-owner-default, PRD #1795
Enforced by: apps/galaxy/src/product-knowledge/product-knowledge.service.test.ts, supabase/checks/product_knowledge.sql
Stated: 2026-10-16
Decided: nobody — adopted when raised (medium), 2026-10-15
Merged: @pierrederval, 2026-10-16, PR #2032
Kept id: moved from product, PRD 2346

## BR-PRODUCT-115

A person named as the Legal or Glossary owner counts as named only while still a team member. When no named person remains on the team, the team's owners decide that kind's entries and proposals, as they do before anyone is named.

Serves: P-PRODUCT-96
Source: .omni-loop/delivery/shipped/1795-product-knowledge-page/outbox/settled.md, entry s1-03-named-owner-who-left, PRD #1795
Enforced by: apps/galaxy/src/product-knowledge/product-knowledge.service.test.ts, supabase/checks/product_knowledge.sql
Stated: 2026-10-16
Decided: nobody — adopted when raised (medium), 2026-10-15
Merged: @pierrederval, 2026-10-16, PR #2032
Kept id: moved from product, PRD 2346

## BR-PRODUCT-116

Naming, changing or clearing an owner or a delegate of product knowledge is recorded in the knowledge history as its own kind of change, named, with who was named before and after.

Serves: P-PRODUCT-97
Source: .omni-loop/delivery/shipped/1795-product-knowledge-page/outbox/settled.md, entry s1-04-naming-an-owner-is-logged, PRD #1795
Enforced by: supabase/checks/product_knowledge.sql, supabase/migrations/20261212110000_product_knowledge.sql, apps/galaxy/src/product-knowledge/product-knowledge.repository.test.ts
Stated: 2026-10-16
Decided: nobody — adopted when raised (medium), 2026-10-15
Merged: @pierrederval, 2026-10-16, PR #2032
Kept id: moved from product, PRD 2346

## BR-PRODUCT-120

A repository's knowledge graph keeps the account and the GitHub login of the person who pushed it, as the login was at the push, and the server keeps the twenty graphs pushed most recently for each repository: pushing an older commit again makes it the newest, and the graph served is always the one pushed last.

Serves: P-PRODUCT-72
Source: .omni-loop/delivery/shipped/1798-knowledge-graph-api/outbox/settled.md, entry s1-02-pusher-login-and-history, PRD #1798
Enforced by: supabase/checks/knowledge_graphs.sql
Stated: 2026-10-19
Decided: @pierrederval, 2026-10-19
Kept id: moved from product, PRD 2346

## BR-PRODUCTKNOWLEDGE-1

A page or decision record is owned by its owner line, else by the law owners of the repository it is read from, such as the plan repository. A page still on the kit default is owned by the viewed repository's law owners. Only law owners are named, never their delegates.

Serves: P-PRODUCTKNOWLEDGE-1
Source: .omni-loop/delivery/shipped/2419-knowledge-tree-page/outbox/settled.md, entry s1-01-owners-of-records-and-defaults, PRD #2419
Enforced by: kit/lib/knowledge-tree/pages.test.ts, apps/galaxy/src/product-knowledge/repositories/repositories-section.test.ts
Stated: 2026-10-27
Decided: nobody — adopted when raised (medium), 2026-10-23
Merged: @pierrederval, 2026-10-27, PR #2510
Proposed: harvest 2026-10-27

## BR-PRODUCTKNOWLEDGE-2

A product's Repositories section lists only the repositories linked to the product. The plan repository appears only as the level its pages come from, never as a repository of its own unless it is linked too.

Serves: P-PRODUCTKNOWLEDGE-2
Source: .omni-loop/delivery/shipped/2419-knowledge-tree-page/outbox/settled.md, entry s1-02-which-repositories-get-a-card, PRD #2419
Enforced by: apps/galaxy/src/product-knowledge/repositories/repositories-section.test.ts, apps/galaxy/src/product-knowledge/repositories/settings-level.test.ts
Stated: 2026-10-27
Decided: nobody — adopted when raised (medium), 2026-10-23
Merged: @pierrederval, 2026-10-27, PR #2510
Proposed: harvest 2026-10-27
