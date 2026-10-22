---
prd: 2411
title: Read a PRD by its page's id
blocked-by: none
spec: file
phase0: server
---

## Problem

Every pull request the loop opens starts with its PRD's page, `https://<omni host>/prd/<uuid>`. That
link is the one thing a reader of the pull request holds, yet nothing reads a PRD from it:

- `GET /api/dossiers/get` (`getDossier`, `apps/galaxy/src/dossier/api.ts`) reads only a product PRD,
  named `product=<key>&prd=<n>` (PRD 1548).
- `GET /api/dossiers?repo=&prd=` (`findDossier`) answers a repository PRD's id and link, never its
  content.

So a repository PRD's spec, plan, before/after and voice cannot be read through the API at all, and
no PRD can be read from its link. A reviewer agent that runs for a workspace member, and sees only
the pull request, cannot learn what the change was meant to do.

## Solution

### 1. `GET /api/dossiers/get?id=<uuid>&kind=<kind>`

The get route takes a third way to name a PRD: `id`, its dossier's id, the uuid of its page's link.
Same sign-in (`Authorization: Bearer <session JWT>`, from `POST /api/ask/token {omni_token}`), same
row-level security, as the token's owner: nothing new is granted.

- `kind` is one of `spec`, `plan`, `before-after`, `voice`, as today.
- `id` and `product` (or `prd`) are exclusive: a call sending both is a 400.
- An `id` that is not a uuid is a 400: `` `id` is a dossier's id, the uuid of its page's link. ``
- A dossier that does not exist, that row-level security hides from the caller, or that is not a PRD
  (a draft, a visual or bug fix, a concept) is the same 404, `No such PRD.`, so a caller cannot tell
  a hidden dossier from a missing one.
- A PRD with no version of `kind` yet is a 404 naming the kind.

### 2. One answer for both ways in

The 200 answer is the same whichever way the PRD was named:

```json
{ "id": "<uuid>", "prdId": "demo-org/shop#42", "url": "https://…/prd/<uuid>", "title": "…",
  "repo": "demo-org/shop", "prd": 42, "kind": "spec", "version": 3, "sha256": "…",
  "content": "…", "createdAt": "…" }
```

- `prdId` is for display: `<key>-<n>` for a product PRD (unchanged), `<owner/name>#<n>` for a
  repository PRD.
- `prd` is the PRD's number as an integer: on its product (`product_seq`) or in its repository
  (`prd`). No client parses `prdId`.
- `repo` is the repository's `owner/name` in lower case, `null` for a product PRD.
- `title` is the dossier's title.

The `product=&prd=` answer gains `title`, `repo` and `prd` too: additions only, so every caller of
today keeps reading it.

### 3. `omni dossier get <url | uuid | key-n> --kind <kind>`

The kit verb takes, besides the product PRD id it takes today, a PRD page's link (any host, the
uuid after `/prd/`) or the bare uuid, and calls the route with `id`. It writes the file to the
scratch folder and prints its path, as today. The answer's schema (`LatestSchema`,
`kit/lib/dossier/product-prd.ts`) gains `title`, `repo` and `prd`, `repo` nullable. The last-read
copy (`prd-cache`) keys by `prdId` as today.

### 4. A machine reader

No new kind of account or token. An agent account that is a member of the workspace signs in once,
creates its terminal token (`omni setup-token`) and keeps it as `OMNI_TOKEN`; it reads what that
member may read. An account outside the workspace gets the 404 of §1. The user guide
(`docs/guide/`) says so in one short section.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuoza/vertuo-omni-loop | API query | `id` | no written convention: follows `apps/galaxy/src/dossier/api.ts` (`findDossier` names a dossier by `id` in its answer) |
| vertuoza/vertuo-omni-loop | API answer | `prdId`, `prd`, `repo`, `title` | no written convention: follows `apps/galaxy/src/dossier/api.ts:374` (`findProductPrd`'s answer) |
| vertuoza/vertuo-omni-loop | kit | `getDossierById` | no written convention: follows `apps/galaxy/src/dossier/api.ts:380` (`getDossier`) |

## Decisions

- **One route, a parameter** (`id=` on `/api/dossiers/get`), not a route of its own: the sign-in,
  the kinds, the refusals and the answer are the get route's already. Chosen by the person.
- **One answer shape**, `prdId` kept for display and widened to repository PRDs. Chosen by the
  person, over the draft's shape (`repo`, `prd` and no `prdId`), which would have given the kit two
  schemas.
- **The voice's objection, accepted.** persona:Lead Engineer: *"A `prdId` with two formats is a
  field every client will have to parse again; I want explicit `repo` and `prd` beside it."* The
  answer carries `prd`, an integer, and `repo`, so nobody parses `prdId`. Settled: `accepted`.
- **The CLI takes a link or a uuid.** Chosen by the person: a reviewer pastes the pull request's
  first line as is.
- **No machine account feature.** Chosen by the person: a member account's terminal token already
  reads under row-level security; a token scoped to a workspace or to reading only is out of scope.
- **One 404 for missing, hidden and not-a-PRD**, so the route never tells a non-member that a
  dossier exists (L-GDPR-1).
- **A product PRD's number is `product_seq`.** An earlier draft returned `dossiers.prd`, null for a
  product PRD; the reader reads `product_seq` and the product's key.

## User stories

- As a reviewer agent running for a workspace member, I read the spec and the plan of the PRD a
  pull request links to, from that link alone, so my review checks the change against its intent.
- As a member in a terminal, I run `omni dossier get <link> --kind plan` and get the plan of any
  PRD of my workspace, a repository's or a product's.

## Scope

In: the `id` parameter of `GET /api/dossiers/get`; `title`, `repo`, `prd` in its answer; the kit
verb taking a link or a uuid; the guide's section on a machine reader.

Out: a route listing a PRD's versions; reading an older version; a token scoped to a workspace or to
reading only; the reviewer agent itself, which lives in its own repository.

## Test seams

- `apps/galaxy/src/dossier/api-product.test.ts`, against the store fake: a repository PRD read by
  id (`prdId` `owner/name#n`, `repo`, `prd`), a product PRD read by id (`prdId` `key-n`, `repo`
  null, `prd` its `product_seq`), 400 for a non-uuid, 400 for `id` with `product`, 404 for a
  dossier that is not a PRD and for one the caller cannot read (same body), 404 for a missing kind,
  and the `product=` answer carrying `title`, `repo`, `prd`.
- `kit/lib/dossier/product-prd.test.ts`: the argument parser (a link on any host, with or without a
  trailing slash or query; a bare uuid; a `key-n`; anything else refused) and `LatestSchema`
  reading the widened answer.
- No test calls GitHub or the real Supabase.

## Risks

- **What merging publishes:** one optional query parameter and three answer fields on a route the
  kit already calls; a kit verb taking more forms of argument. Rolled back by reverting the feature
  PR: no migration, no stored shape.
- **A leak through the route.** It reads under the caller's row-level security; the one 404 keeps a
  hidden dossier indistinguishable from a missing one.
- **The Legal entries:** L-GDPR-1 (only members read a workspace's data): the route reads under the
  caller's sign-in and adds no grant. L-GDPR-2 (credentials never logged in clear): the token is
  exchanged as today and never logged.
- **The locked laws:** BR-PRODUCT-29: ask mode lets in only the workspace's members; broken, a
  stranger could read a team's PRDs. The route reuses the ask sign-in unchanged. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub. BR-PRODUCT-12, BR-PRODUCT-39,
  BR-PRODUCT-94, N-PRODUCT-7 and N-PRODUCT-8 apply to the ask domain this route signs in through
  and are not changed.

## Acceptance criteria

- `GET /api/dossiers/get?id=<uuid of a repository PRD>&kind=spec`, signed in as a member, answers
  200 with that PRD's latest spec, `repo` its repository, `prd` its number, `prdId`
  `<owner/name>#<n>`.
- The same with a product PRD's uuid answers 200, `repo` null, `prd` its number on its product,
  `prdId` `<key>-<n>`.
- A non-uuid `id` is a 400; `id` with `product` is a 400.
- A non-member's call, a missing uuid and a draft's uuid each answer the same 404 body.
- `omni dossier get https://<host>/prd/<uuid> --kind plan` writes the plan to the scratch folder and
  prints its path; the bare uuid does the same; `omni dossier get <key>-<n>` works as before.
- The `product=&prd=` answer still carries every field it carried, plus `title`, `repo`, `prd`.
- The user guide says how a member's agent account reads a PRD by its link.
