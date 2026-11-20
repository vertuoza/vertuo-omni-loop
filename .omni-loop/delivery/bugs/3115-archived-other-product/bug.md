# Bug 3115: a member cannot open a product that shares a repository with an archived product

## Triage

- **Domain:** galaxy product home (`apps/galaxy/src/product-home`): the read of the other products linked to the product's repositories
- **Risk:** medium — every member who is not an owner cannot open the product's page while another product sharing one of its repositories is archived; workaround: an owner restores that product or unlinks the repository (Jev, 0.45)
- **Regression:** yes — #2233 (archive a product, PRD 2232) hid archived products from members, while the other-products read from #2130 requires each linked product to be readable

## Reproduction

- **File:** `apps/galaxy/src/product-home/product-home.repository.test.ts`
- **Level:** unit
- **Red:** Error: product-home/product-home.repository: product_repositories of other products: the answer does not parse: [0].products invalid_type (expected object)

## Fix

Row-level security hides an archived product from a member, so the embedded product of another product's link came back null and the read threw, which the page showed as "Couldn't load your products". The read now accepts a null product and leaves that link out, as the member cannot see that product anyway.

## Guard

The reproduction is the guard: a unit test on the other-products read with a link whose product the reader cannot read; it fails on the default branch's read and passes on the fix.

## Mutation

mutation: no changed core file against origin/main (c6579081): nothing to mutate
