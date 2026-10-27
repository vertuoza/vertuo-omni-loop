---
title: Knowledge map
description: The ten layers and nine roles every repository of a product shares, the alias table for the words in use before them, and the optional map from layers to paths.
---

An agent about to change a file asks the knowledge base what applies. The answer is better when a
file has a **domain** and **layers**, and when a repository's **role** in its product means the same
thing in every repository. The kit ships one list of each, so `db` in one repository and `database`
in another meet. Everything on this page is optional: a repository that declares nothing narrows
nothing, and works as before.

## The layers

A layer says what a file is. A file may be in several. Ten words, no others:

| Layer | What it covers |
|---|---|
| `ui` | screens and components |
| `api` | REST or RPC routes and their payloads |
| `schema` | GraphQL or other typed contracts callers compile against |
| `db` | stored shapes, migrations, row-level security |
| `auth` | identity, sign-in, access |
| `event` | webhooks, queues, messages between services |
| `cli` | commands a person or an agent types |
| `job` | cron, workers, background runs |
| `infra` | deploy, environments, hosting |
| `ci` | pipelines, hooks, checks |

A repository maps layers to the paths that hold them, in `.omni-loop/config.yml`:

```yaml file=.omni-loop/config.yml
layers:
  db:   [^supabase/migrations/, ^supabase/checks/]
  cli:  [^kit/bin/]
  auth: [^apps/galaxy/src/auth/]
```

Each value is a list of regular expressions over repository paths, written as a flow area's `paths`
are ([Repository flow](/docs/flow)). A key that is not one of the ten layers is refused by name.
`omni check config` also flags a pattern that matches no tracked file, so a map that went stale
shows red instead of hiding rules.

The kinds a slice declares in `contracts.kinds` are layers too. The default stays `[api, db]`.

## The roles

A role says what a repository is for in its product, in a plan's `plan.targets[].role` and on the
product's Repositories tab. Nine words:

| Role | What it is | Usually holds |
|---|---|---|
| `api` | serves routes, data and business rules to other repositories | api, schema, db, auth, event, job |
| `web` | a web application a person opens in a browser | ui, auth, api |
| `mobile` | a mobile application | ui, auth, api |
| `ui` | a shared set of screens, components or design tokens | ui |
| `library` | code other repositories install and call | api, cli |
| `infra` | deploy, environments and hosting for the product | infra, ci |
| `plan` | holds the product's plans and delivery, and builds no feature itself | cli, ci |
| `doc` | documentation, guides and written knowledge | none |
| `monorepo` | several of the roles above in one repository | any |

The last column is guidance only: nothing checks it.

## Tech levels

A playbook form (review, verification, definition of done, bug fixing…) is answered by the first
level that has text for it, read from the closest to the most shared:

1. **This repository.** Its own playbook, as written in the repository.
2. **The plan repository.** The copy of the plan repository's playbook, when this repository has a
   plan repository.
3. **The Omni settings.** The workspace's settings repository keeps its tech playbook in
   `.omni-loop/settings/`. A sync copies that folder into this checkout, so the same pages apply
   to every repository of the workspace.
4. **The kit's first default.** Shipped with the kit, used only when no level above has text.

A level whose section is empty, holds only open questions, or is a pointer to another file is
skipped, and the next level answers. A repository that wants a rule of its own writes it at level 1
and it wins. The text of a level is never filled from the config. The Omni settings copy is written
by `omni sync`; until a sync has copied it, or with no settings repository, level 3 is skipped and
the kit's default answers.

[Playbook](/docs/playbook) explains these levels in full, and the two screens that show them.

## Old words

Two small tables read the words in use before the lists, once:

| Setting | Old word | Read as |
|---|---|---|
| layer, `contracts.kinds` | `rest` | `api` |
| layer, `contracts.kinds` | `graphql` | `schema` |
| layer, `contracts.kinds` | `database` | `db` |
| layer, `contracts.kinds` | `migration` | `db` |
| role | `back-end`, `backend` | `api` |
| role | `front-end`, `frontend` | `web` |
| role | `docs` | `doc` |

Any other old word is kept and flagged, never refused on what already exists: `omni check config`
names an unknown contract kind or role with its list, and `omni plan check` still accepts the kind
until a person replaces it.

[Next → Design craft (opt-in)](/docs/design)
