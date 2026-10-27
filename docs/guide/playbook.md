---
title: Playbook
description: The rulebook every agent reads before it works in a repository — one page per question, four levels from this repository to the kit's default, the plan repository's two roles, and the two screens that show it on the Omni page, Settings › Playbook and Knowledge › Repositories.
---

The **playbook** is the rulebook an agent reads before it works in a repository. It has one page per
question the agent asks while it delivers: how we test, how we fix a bug, when work is done, how we
answer a review comment, what must be green before a push. A page is called a **form**, and each
form is cut into **sections**, one per sub-question.

This page shows where the playbook lives, how its four levels decide which text an agent follows,
and how to see and try the two screens that show it on the Omni page.

## What the playbook is

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

## Levels

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
neither copy reads exactly as it did before levels existed.

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

## A name that means two things

"Plan repository" is used for **two different roles**. They are set in two different places, and
they feed two different levels.

| | a product's plan repository | the workspace's plan repository |
|---|---|---|
| **what it is** | the repository that holds one product's plans and delivery | the repository that carries the workspace's PRD issues |
| **where it is set** | the product home's **Repositories & approvers** tab, **Plan repository** card, by a workspace owner | the workspace's row in the Omni page's database; no screen sets it (see below) |
| **its level in the playbook** | level 2, the plan repository | level 3, the Omni settings: it is also the **settings repository** |
| **what is read from it** | its own playbook, `.omni-loop/knowledge/playbook/` | its settings folder, `.omni-loop/settings/` |

So the workspace's plan repository plays a second role: it is the **settings repository**. Its
`.omni-loop/settings/` folder holds the playbook every repository of the workspace reads where its
own pages are silent. That folder sits beside its own knowledge folder, never inside it: the
repository's own playbook is still its own, level 1 for itself.

The two roles can be the same repository or two different ones. A workspace with no plan repository
named has no settings repository, and level 3 is empty for every repository.

## Settings › Playbook

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

**With no settings repository.** The page shows a card, **No settings repository yet**:
*Name a plan repository for this workspace: its plain files hold the playbook every repository
reads.* No page is listed. When the workspace names a settings repository the Omni app cannot reach,
the page names it and says why instead: *The Omni app is not installed where `<owner>/<name>`
lives.*, or *The Omni app cannot read `<owner>/<name>`.* A settings repository that holds no page yet shows a line
saying so, and lists every page as the kit's first default.

**How to set the settings repository.** It is the workspace's plan repository, the `plan_repo`
column of the workspace's row in the Omni page's database. **No screen sets it today**: the
**Plan repository** card on a product's Repositories & approvers tab sets the product's plan
repository, not this one. Whoever runs the Omni page's database sets it, for example in the
Supabase SQL editor:

```sql terminal
update public.workspaces set plan_repo = '<repository name>' where slug = '<workspace slug>';
```

The value is a repository name under the workspace's GitHub account (`plans`), or a full
`<owner>/<name>`.

## Knowledge › Repositories

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

## Try it

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

**The local demo.** Both screens have a demo with fictional data, which opens nothing on GitHub.
From the root of a clone of this repository, with no Supabase variables in
`apps/galaxy/.env.local` (no file at all is fine), start the arcade:

```bash terminal
pnpm galaxy:dev
```

Then open:

- `http://localhost:3000/app/settings/playbook`: two pages, one in the settings repository and one
  on the kit's first default, seen as an owner. **Open pull request** shows **Pull request #1** and
  opens nothing.
- `http://localhost:3000/app/products/demo-product-1/knowledge/repositories`: two repositories, one
  whose pages read every level, one with no knowledge pack.

The demo runs in development whenever `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are not set; with them set, the arcade uses that database and its
real sign-in instead.

## The first defaults

The kit ships a first version of the Omni settings playbook for a settings repository to start from:
four pages, **Review** (fix, push back, ask), **Definition of done**, **Verification** and
**Bug fixing**. This repository holds them in its own `.omni-loop/settings/playbook/`, the same text
the kit carries. Settings › Playbook shows them as **The kit's first default** until the settings
repository holds its own copy of each page.

Each page names its owners on an `owner:` line in its header; `owner: null`, as the first defaults
ship, means the law owners of the settings repository. The copy a checkout reads leaves that line
out.

## Read next

- [Knowledge map](/docs/knowledge-map): layers, roles, and the short summary of these levels.
- [Several repositories](/docs/several-repositories): plan repositories and their targets.
- [Invade](/docs/invade): how a repository's playbook is filled from evidence.

[Next → Knowledge map](/docs/knowledge-map)
