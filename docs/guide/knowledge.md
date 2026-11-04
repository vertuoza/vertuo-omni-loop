---
title: Knowledge
description: "What every agent reads before it works — the playbook and its four levels, the laws and their tests, and the words a product's repositories share: layers, roles and domains."
---

Before an agent changes anything, it reads what your repository knows. That knowledge lives in the
repository, as plain files, and in three parts:

- [**The playbook**](#the-playbook): how the team works, one page per question.
- [**Laws and their tests**](#laws-and-their-tests): what must stay true, and the test that proves it.
- [**The knowledge map**](#the-knowledge-map): the words every repository of a product shares, so
  the right rules reach the right files.

A product's Legal entries and glossary are kept on the Omni page: see
[Products](/docs/products#product-knowledge).

## The playbook

The **playbook** is the rulebook an agent reads before it works in a repository. It has one page per
question the agent asks while it delivers: how we test, how we fix a bug, when work is done, how we
answer a review comment, what must be green before a push. A page is called a **form**, and each
form is cut into **sections**, one per sub-question.

Below: where the playbook lives, how its four levels decide which text an agent follows, and how
to see and try the two screens that show it on the Omni page.

### What the playbook is

A repository keeps its own playbook in its knowledge folder, one Markdown file per form:
`.omni-loop/knowledge/playbook/<form>.md` by default. The decisions form is the one exception: it
lives beside the decision records, in `.omni-loop/knowledge/adr/README.md`.

To read one form the way an agent reads it, type:

```bash terminal agent
omni kb show review
```

It prints the form section by section. Each section ends its heading with a tag that says where its
text came from:

| tag | the text comes from |
|---|---|
| `[repo]` | this repository's own page |
| `[plan repo]` | the plan repository's copy (level 2, below) |
| `[omni settings]` | the Omni settings copy (level 3, below) |
| `[kit default]` | the default shipped with the kit |
| `[hole]` | the repository left open questions here (`TODO(human)` lines), listed with the kit default |

A section that names another file with a `See: <path>` line shows that file's text, tagged
`[→ <path>]`.

To see every form at once, type:

```bash terminal agent
omni kb status
```

It prints one line per form, with its state (`filled`, `blank` or `missing`). When a level above
the repository answers anything, each line also counts the sections each level answers, and a line
`reads the Omni settings: …` names the forms that read it.

### Levels

A section is answered by the **first level that has text for it**, read from the closest to the most
shared:

1. **This repository.** Its own page, in its knowledge folder.
2. **The plan repository.** A copy of the plan repository's playbook, kept in this checkout.
3. **The Omni settings.** A copy of the playbook kept in the workspace's settings repository.
4. **The kit's default.** Shipped with the kit. It answers only when no level above has text.

The two copies live in the checkout's local folder, which git ignores, so they are never committed:

| level | its copy in your checkout |
|---|---|
| plan repository | `.omni-loop/local/tree/plan-repo/` |
| Omni settings | `.omni-loop/local/tree/omni-settings/` |

Each copy is laid out like a knowledge folder: `playbook/<form>.md`, and `adr/README.md` for the
decisions form. A level whose copy is not there is skipped, never an error. A repository with
neither copy reads its own pages, then the kit's default.

**What "skipped" means.** A level answers a section only with real text. A section that is empty,
that holds only open questions, or that is a `See:` line pointing at another file is no answer: the
next level is read. When your repository left open questions in a section and a level above has
text, you see that text, tagged with that level, such as `[hole · plan repo]`, with your questions
still listed under it.

**Who fills the copies.**

- The Omni settings copy is written by `omni sync`. It refreshes only when the Omni page is switched
  on in your config (`dossier.enabled` and `ask.url`), you are signed in (`omni signin`), and the
  Omni page answers with a settings repository. Offline, signed out, or with no settings repository,
  the last copy stays as it was. Until a first copy is written, level 3 is skipped and the next
  level answers.
- Nothing fills the plan repository copy in the terminal yet: the kit reads the folder when it is
  there, but no command writes it. On the Omni page, level 2 is read another way (see
  Knowledge › Repositories, below).

**Write your own.** A rule your repository writes is level 1, and level 1 always wins. Open
`.omni-loop/knowledge/playbook/<form>.md` and write the text under the section's heading. A form
your repository does not have yet can be laid down blank first:

```bash terminal agent
omni kb init
```

It adds every missing form, blank, and changes no file that exists. A blank section still reads the
next level, so nothing changes until you write text in it. `/omni:invade` also fills forms, from
what the repository can prove ([Invade](/docs/invade)); it never copies a default into your files.

The text of a level is never filled from your config: what you read is what that repository wrote.

### A name that means two things

"Plan repository" is used for **two different roles**. They are set in two different places, and
they feed two different levels.

| | a product's plan repository | the workspace's plan repository |
|---|---|---|
| **what it is** | the repository that holds one product's plans and delivery | the repository that carries the workspace's PRD issues |
| **where it is set** | the product home's **Repositories & approvers** tab, **Plan repository** card, by a workspace owner | the workspace's row in the Omni page's database, by its owner, through **Settings › Playbook** |
| **its level in the playbook** | level 2, the plan repository | level 3, the Omni settings: it is also the **settings repository** |
| **what is read from it** | its own playbook, `.omni-loop/knowledge/playbook/` | its settings folder, `.omni-loop/settings/` |

The workspace's **settings repository** is its own setting. It holds the playbook every repository
of the workspace reads where its own pages are silent, in its `.omni-loop/settings/` folder. That
folder sits beside its own knowledge folder, never inside it: the repository's own playbook is still
its own, level 1 for itself.

The settings repository is chosen on **Settings › Playbook**. While none is chosen, the workspace's
plan repository is its default, so the two can be the same repository or two different ones. A
workspace with neither named has no settings repository, and level 3 is empty for every repository.
Choosing a settings repository does not move the plan repository: the game, the dossiers and the
points keep reading the plan repository.

### Settings › Playbook

Open the Omni page, then **Settings › Playbook** in the side menu, or the **Playbook** tab, the last
of the Settings tabs on every Settings page. Its address is `/app/settings/playbook`.

**What you see.** A head card, **Playbook**, says that the pages a repository does not write itself
read the ones below, and names the settings repository and the commit it was read at
(`Read from <owner>/<name> at <commit>`). Then one card per page: its name (**Review**,
**Definition of done**, **Verification**, **Bug fixing**, then any other page the settings repository
holds), a tag, and the page's text. The tag says whose the text is:

- **In your settings repository**: the settings repository holds this page. Every repository reads
  it after its next `omni sync`.
- **The kit's first default**: the settings repository does not hold this page yet; the card shows
  the text the kit offers to start from. Repositories do not read it from here: until the settings
  repository holds the page, they read the kit's own default for that form.

**Who can read and who can edit.** Every member of the workspace reads the page. Only a
**workspace owner** sees **Propose a change** under each page. A member who is not an owner sees the
text only.

**What saving does.** **Propose a change** turns the page's text into one field holding the whole
file, its header lines included. **Open pull request** sends it; **Cancel** puts the text back.
Sending opens a pull request in the settings repository, as the Omni app, on a branch of its own
(`omni-settings/<form>-<time>`), with the title `Playbook: a new <form> page, from the Omni page`.
Nothing is stored on the Omni page: the text lives only in the pull request. The card then links
**Pull request #n** and says that once a person merges it, every repository reads the new text on
its next sync. Each change opens its own pull request, even for the same page.

A change is refused, with the reason in one line under the field, when:

- the text is not a page the kit reads (the next sync would skip it);
- the settings repository already holds this exact text;
- the Omni app cannot reach the settings repository.

**With no settings repository.** The page shows a card, **No settings repository yet**, with the picker in it: the owner chooses the
repository that holds the playbook. A member sees the card and is told that the workspace's owner
chooses one. No page is listed. When the workspace names a settings repository the Omni app cannot reach,
the page names it and says why instead: *The Omni app is not installed where `<owner>/<name>`
lives.*, or *The Omni app cannot read `<owner>/<name>`.* A settings repository that holds no page yet shows a line
saying so, and lists every page as the kit's first default.

**How to set the settings repository.** A workspace owner opens **Settings › Playbook** and reads the
**Settings repository** line in the head card:

- **Chosen**: the line names the settings repository. **Change** opens the picker.
- **Plan repository by default**: no repository is chosen yet, and the plan repository is read as the
  default. **Keep it as the settings repository** makes that default the choice in one click. It is
  offered when the plan repository is one the workspace lists; otherwise, or to pick another, use
  **Choose another**.
- **None**: neither is named. The picker lists the workspace's repositories, the same list as
  Settings › Repositories.

The picker's **Save** stores the repository picked. **Clear the choice** (offered only once one is
chosen) returns the line to the plan repository default, or to none. Only a workspace owner changes
it; a member sees the line and the name of the repository it reads from.

### Knowledge › Repositories

Open a product, then its **Knowledge** tab, then **Repositories** (after **Pitch**, before
**Settings**): `/app/products/<id>/knowledge/repositories`. Every member of the workspace reads it.

**What you see.** One card per repository linked to the product, by name. Each card says which
knowledge pack it was read from (`Read from its knowledge pack at <commit>, committed <day>`): the
newest snapshot of the repository's knowledge, which the Omni app makes on a merge. Then two tables:

- **Playbook**: one row per form of the kit, with its **Level** (**Repository**, **Plan
  repository**, **Omni settings** or **Kit default**), **Read from** (the repository and the file;
  a dash for the kit default), its **Owner** and a **Write** column.
- **Decision records**: each record with its number, title, level, the repository it is read from
  and its owner. A repository with none says *No decision record yet.*

The levels here are read from what the Omni page holds, not from your checkout:

- **Plan repository** is the **product's** plan repository, read from its newest knowledge pack. The
  plan repository is never its own level 2.
- **Omni settings** is the **workspace's** settings repository, read from its `.omni-loop/settings/`
  folder on GitHub. When it cannot be read, or holds no page, that level is empty and the pages read
  the kit default.

**Owners.** A page's owner is its `owner:` line when it has one, else the law owners of the
repository its level is read from (`laws.owners` in that repository's config). A page on the kit
default is owned by the repository's own law owners, since writing it is theirs. A dash means nobody
is named.

**A repository with no knowledge pack** says *No knowledge pack of `<repository>` yet. The Omni app
makes one when a merge into `<repository>` touches its knowledge folder or its flow config
(.omni-loop/config.yml).* A product with no repository says so, with a link to Repositories &
approvers.

**Write it for this repository.** Every page whose level is not **Repository** shows the link
**Write it for this repository**. It opens GitHub's new-file page in that repository, in a new tab,
on the page's own path (`.omni-loop/knowledge/playbook/<form>.md`, or
`.omni-loop/knowledge/adr/README.md` for the decisions form). The file starts **empty**: the text
the page reads today is not carried over. You write the page, then commit it on a new branch and
open a pull request, as for any new file on GitHub. Once it is merged, that repository's own page wins.

### Try it

A short, safe check. Nothing below changes a repository until a person merges a pull request.

On the Omni page:

1. Open `/app/settings/playbook`. Check the head card names your settings repository and a commit,
   and that each card carries a tag.
2. As a workspace owner, press **Propose a change** on one page, change one word, then
   **Open pull request**. Expect a **Pull request #n** link.
3. Open that pull request in the settings repository. Check that it changes one file under
   `.omni-loop/settings/playbook/`. If it was only a test, close it without merging.
4. Open a product's **Knowledge** › **Repositories**. Check each repository's card, each page's
   level and owner, and that **Write it for this repository** opens an empty new file on GitHub.
   Leave that GitHub page without committing.

In a repository of the workspace:

1. Run `omni sync`, then `omni kb status`: the line `reads the Omni settings: …` names the forms
   that read it.
2. Run `omni kb show review`: a section the repository does not write shows `[omni settings]`.

### The first defaults

The kit ships a first version of the Omni settings playbook for a settings repository to start from:
four pages, **Review** (fix, push back, ask), **Definition of done**, **Verification** and
**Bug fixing**. Settings › Playbook shows them as **The kit's first default** until the settings
repository holds its own copy of each page.

Each page names its owners on an `owner:` line in its header; `owner: null`, as the first defaults
ship, means the law owners of the settings repository. The copy a checkout reads leaves that line
out.

## Laws and their tests

When your repository keeps its laws in the knowledge base (`laws.source: knowledge` in
`.omni-loop/config.yml`), each rule and invariant there says what must stay true, and its
`Enforced by:` line names how. A rule is a decision worth a test, and it carries that test; the
few rules that cost the most when broken are **locked** as laws (below). Everything in this section
is off unless `laws.source` is `knowledge`.

### Principles, rules and laws

The knowledge base holds three tiers, one word each:

| Tier | What it is | Who changes it | How many |
|---|---|---|---|
| **Principle** | the why: a person's decision about what the product should be | a person | any |
| **Rule** | what may or may not happen, proven by a test | any person, by answering its `high` question on the pull request | any |
| **Law** | a rule or an invariant a CODEOWNER **locked** | only with a CODEOWNER's approval of the pull request on GitHub | at most `laws.max` (20 by default) |

A principle is never a law. A law keeps its id and its test, and gains two lines:

```markdown file=.omni-loop/knowledge/domains/quote/rules.md
Locked: @ana, 2026-10-14
Governs: ^src/quotes/, ^src/invoices/total
```

`Governs:` lists the files the entry rules over, as regular expressions over paths, written the
same way as a flow area's `paths`. Any rule may carry it; every law must.

**The thesis** (`.omni-loop/knowledge/product/thesis.md`) is the page a newcomer reads first, in
plain words: who the product is for, what it promises, its laws (one line each: what breaks if it
is broken, and for whom) and what it refuses. `omni check knowledge` refuses a thesis whose laws
section forgets a locked law, or names one nobody locked.

**Agents read only what a change touches.** Instead of the whole knowledge base, a skill asks for
the entries that govern the files it will change:

```bash terminal
omni kb laws --paths src/quotes/total.ts
```

It prints every locked law, one plain line each with who must approve a change to it, then the
rules whose `Governs:` matches those files. `--slice <prd> <slice>` does the same for a slice of a
plan, and `--area <domain>` lists one domain's rules. `/omni:brainstorm` names each locked law its
design touches, and the person who must approve it, in the spec's **Risks**, so you know before
anything is built; `/omni:plan` marks a slice that changes one `law: <id> · owner @<login>`;
`/omni:do-work` and `/omni:bug-fix` read only these lines.

### Lock a law

No agent locks a law. `/omni:invade` and the loop only **propose** one, with a line a junior
developer or a junior PM can read:

```markdown file=.omni-loop/knowledge/domains/quote/rules.md
Proposed law: If a quote's total leaves out the tax, customers are billed the wrong amount.
```

A person locks it, in a pull request of their own:

1. Name the owners once: `laws.owners` in `.omni-loop/config.yml` (logins or teams, each with a
   delegate if you like, below), then `omni kb owners` writes them into `.github/CODEOWNERS` for the
   laws' files, the thesis and the registers. `omni check knowledge` refuses a lock while no owner
   is named.
2. Replace the entry's `Proposed law:` line with `Locked: @<your login>, <today>`, make sure it has
   its `Governs:` line and its test, and add its line to the thesis's laws section.
3. A CODEOWNER of those files approves the pull request on GitHub.

From then on, any pull request that adds or removes a `Locked:` line, edits a law, changes its test
or deletes it keeps its outbox check red (`law-locked`), knowledge and enforce pull requests
included, until a CODEOWNER of the files it changed approves it. An outbox answer, a label or a
commit trailer does not clear it, and an approval re-runs the check without a new push. When the
pull request merges, `/omni:pr` has written one `Law-Change-Approved-By: @<login>` line per
approving CODEOWNER in its description, so the history says who agreed. A change to a rule that is
not locked still needs only a `high` question, which any person may answer.

`Enforced by:` reads one of three ways:

| `Enforced by:` | What it means |
|---|---|
| a path, such as `src/quotes/total.test.ts` | the law's test: the outbox gate treats any change to it as a change to the law |
| `pending #<n>` | a law that waits for its test: law issue `#<n>` is open, and agents respect the law already |
| `unenforced` | a law with no test and no issue yet; refused once `laws.requireProof` is on, below |

### When an owner does not answer

An owner on leave should not leave a pull request stuck, and nothing waits forever without someone
being told. Give each owner a **delegate**, and name **product leadership**:

```yaml file=.omni-loop/config.yml
laws:
  owners:
    - login: ana
      delegate: jdoe
    - acme/platform          # an owner with no delegate
  leadership: [cto-login]
limits:
  escalationWorkingDays: 2
```

- A delegate is one person's GitHub login, never a team, and never the owner itself.
  `omni kb owners` writes each owner and each delegate on every line of its block, so a delegate's
  approval clears a law as the owner's does. Run it again after you add a delegate:
  `omni check knowledge` reports the block out of date until you do. `omni kb laws` names the
  delegate: `Changing it needs @ana (or the delegate @jdoe) to approve the pull request.`
- Leadership is a list of logins. It is never written into CODEOWNERS, so its approval never clears
  a law.
- `limits.escalationWorkingDays` is 1 to 10, 2 by default. Working days are Monday to Friday, in
  UTC.

A changed law waiting for its approval, or a `high` or `human-action` question waiting for its
answer, is asked about in three steps:

| Step | When | A law waiting for approval | A question waiting for its answer |
|---|---|---|---|
| 0 | as soon as it waits | its CODEOWNERS | the feature PR, and the PRD's opener on the Omni page |
| 1 | `escalationWorkingDays` working days later | each owner's delegate | each owner and each delegate |
| 2 | as many working days again | and leadership | and leadership |

Each step posts one new comment on the pull request that mentions the people newly asked, and
shows the wait in their list on the Omni page. Asking never decides: nothing is approved, adopted
or labelled, and the check stays red until a person answers. With no delegate and no leadership,
nobody more is ever asked.

### Worth a law?

When a feature pull request merges, the knowledge harvest writes back the decisions you settled.
Each one it calls a rule or an invariant takes one of three paths:

1. **The feature changed a test that proves it.** It becomes a law, with that test in its
   `Enforced by:`.
2. **No test, and not worth a law.** It stays out of the knowledge base. Its PRD's `settled.md` keeps
   it, with the note `not worth a law`, and who decided.
3. **No test, and worth a law.** The knowledge pull request writes it with `Enforced by: pending #<n>`,
   and the harvest opens **law issue** `#<n>`, titled `Law: <statement>` and labelled `omni:law`
   (`labels.law`). Its body names the entry, its register, its source and where its test would live.

"Is this worth a law?" is answered by the model that classifies the decision. When your workspace
turns the **`law-worth`** decision on in **Settings › Jev** on the Omni page, Jev's answer counts
instead, whenever it is confident enough. It starts **Off** in every workspace; **Shadow** lets you
read how often Jev agrees before you trust it. When Jev cannot answer, the model's answer stands, and
the harvest still completes.

### Give a law its test: `/omni:enforce`

```text agent
/omni:enforce 1400
```

It takes one law issue to one pull request. It writes one test of the law where your testing form
says tests live, then **proves** it: it breaks the law in the code with the smallest change it can
find and sees the test go red, then restores the code and sees it green. A test that cannot go red
proves nothing. It then rewrites the entry's `pending #<n>` to the test's path, on a branch
`test/law-<id>` (`branches.law`), and opens one pull request into the default branch that closes the
issue, its description showing the red line and the green one. **You merge it.**

When the test cannot be made to go red, or the law is already broken, it opens no pull request: it
comments on the issue with what is stuck, and the law stays `pending`.

### Move your repository onto it: the sweep

A repository that kept laws before this has many `unenforced` ones. Once, from a terminal at its
root, with `OPENROUTER_API_KEY` set:

```bash terminal
omni knowledge judge
```

It asks "worth a law?" of every `unenforced` rule and invariant, the model first, then
`omni decide law-worth` with your sign-in, whose answer counts when your workspace turned `law-worth`
on. A **yes** opens its law issue and turns the entry into `pending #<n>`; a **no** takes the entry
out of its register and records it in its PRD's `settled.md` as not worth a law, and the report
names every entry that cited it, for you to fix. Once every law is judged, it sets
`laws.requireProof: true`. To judge one law alone, name it: `omni knowledge judge BR-PRODUCT-23`. It only writes files: commit them on a `docs/knowledge-<topic>` branch
(`branches.knowledge`), open the knowledge pull request, review it and merge it.

From then on, `omni check knowledge` refuses a rule or an invariant whose `Enforced by:` is
`unenforced`: each one names a test, or `pending #<n>`. Until a repository runs its sweep,
`laws.requireProof` stays `false` and nothing changes, so a kit update never turns your checks red.

### A person answers every change to a rule

Five changes count as a change to a rule, locked or not (a locked one also needs its CODEOWNER,
[above](#lock-a-law)):

- **`law-proof`**: the law's test changes;
- **`law-text`**: a register of the knowledge base, or a decision record, changes;
- **`test-removed`**: a test file is deleted;
- **`law-demoted`**: a law's test path turns back to `pending` or `unenforced`, or a law leaves the
  knowledge base;
- **`briefing-text`**: the briefing changes (`briefing.md` in the playbook, the file its `points-to`
  names, or a file one of its `See:` lines names), in every repository that has one. It holds the
  rules every agent follows, so an agent never loosens them alone. The briefing is not a locked law:
  its CODEOWNER is asked to review, and any person may answer its question.

Each needs a question ranked `high`, one a person answers on the pull request. An account that says
`spec <where>`, or names a `medium` question the loop adopted by itself, does not count: the outbox
check stays red. Which pull request gets which check:

| Pull request | Its outbox check |
|---|---|
| a feature pull request | as always, with the five changes answered only by `high` questions |
| a fix (`/omni:bug-fix`, `/omni:visual-fix`) | `success` when it touches no law. One that does needs a small `outbox/` in the fix's folder, one `high` question per change: the fix skills raise them, and the check names the law and stays red until you answer |
| a knowledge pull request, or one `/omni:enforce` opened | never blocked: merging it is your answer. The check lists the laws it touches |

## The knowledge map

An agent about to change a file asks the knowledge base what applies. The answer is better when a
file has a **domain** and **layers**, and when a repository's **role** in its product means the same
thing in every repository. The kit ships one list of each, so `db` in one repository and `database`
in another meet. Everything in this part is optional: a repository that declares nothing narrows
nothing.

### The layers

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
  db:   [^db/migrations/, ^db/checks/]
  cli:  [^bin/]
  auth: [^src/auth/]
```

Each value is a list of regular expressions over repository paths, written as a flow area's `paths`
are ([Repository flow](/docs/flow)). A key that is not one of the ten layers is refused by name.
`omni check config` also flags a pattern that matches no tracked file, so a map that went stale
shows red instead of hiding rules.

The kinds a slice declares in `contracts.kinds` are layers too. The default stays `[api, db]`.

### The roles

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

### Domains

A product is often cut into **domains**: the parts of it a reader thinks in, such as invoicing, planning
or stock. A product's domains are one list, kept on the Omni page beside its Legal entries and Glossary,
in the **Domains** section of the product's Knowledge. Every repository of the product uses the same words
for them.

- **A domain** has a key, a name and a meaning. The key is lower-case words joined by hyphens, the same
  word as its folder, and it never changes. The name and the meaning can be edited.
- **Who decides.** An owner or a named delegate of the Domains kind decides, and while nobody is named, the
  workspace's owners do. Any other member proposes a domain, and it joins the list once someone who decides
  approves it. Nothing is deleted: a retired domain stays readable behind `Retired · n`, and its key is never
  reused in that product.
- **A term's domains are optional.** A glossary term names none, one or several of the product's active
  domains. A term that names none is cross-domain: a normal term, not a missing field. The Glossary filters
  its terms by domain.

#### How a folder comes onto the list

A repository lays out a domain as a folder directly under `domains/` in its knowledge root, for example
`.omni-loop/knowledge/domains/invoicing/` (the root is `.omni-loop/knowledge` unless the repository sets
`paths.knowledge`). The Domains section reads those folders from the newest knowledge pack of each repository
linked to the product, and lists the folders the list does not hold under **Not on the list**, with the
repositories that hold each one. Whoever decides adds a folder in one action: its key, name and meaning are
filled in from the folder, and can be changed before it is saved. Any other member proposes it the same way.

The section does not count three things:

- a folder under `repos/<target>/domains/` in a plan repository, because it belongs to another repository;
- a folder whose name cannot be a key. It is marked `Cannot be a key: rename the folder` and has no action:
  the repository renames it;
- a repository with no pack yet, which shows as `not read yet` and adds nothing to the count.

A retired domain that a repository still holds shows as `retired, still in <repo>`.

#### Nothing blocks

A folder off the list is never a failure. No check goes red for a domain, and no pull request waits for one:
the list is shown so its owner can adopt the folder. While any folder is off the list, the sub-menu's Domains
entry reads `Domains <n> · <k> not on the list` on every Knowledge section, so the owner sees it without
opening Domains. A new product starts with an empty list, and its folders appear there to adopt. Nothing is
seeded.

### Old words

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
