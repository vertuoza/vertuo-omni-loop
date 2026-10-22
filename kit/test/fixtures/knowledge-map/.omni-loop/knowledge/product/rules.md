# Rules

## BR-PRODUCT-3

An agent never applies the override label itself. It reports the red gate and stops.

Serves: P-PRODUCT-1
Source: PRD #7
Enforced by: kit/test/plugin.test.ts
Stated: 2026-10-01
Locked: @law-keeper, 2026-10-14
Governs: ^kit/plugin/skills/pr/

## BR-PRODUCT-5

A feature stays a draft while any question is open. It is marked ready only once shipped.

Serves: P-PRODUCT-1
Source: PRD #7
Enforced by: kit/test/plugin.test.ts
Stated: 2026-10-01
Locked: @law-keeper, 2026-10-14
Governs: ^kit/plugin/skills/pr/, ^kit/plugin/skills/yolo/

## BR-PRODUCT-28

Only a member of a workspace can link a GitHub account to it. A stranger's link is refused.

Serves: P-PRODUCT-1
Source: PRD #9
Enforced by: supabase/checks/links.sql
Stated: 2026-10-01
Locked: @law-keeper, 2026-10-14
Layers: db

## BR-PRODUCT-90

A theme colour is read from the design tokens. No screen hard-codes one.

Serves: P-PRODUCT-1
Source: PRD #11
Enforced by: unenforced
Stated: 2026-10-01
