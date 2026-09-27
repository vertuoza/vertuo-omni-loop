# omni-loop — the GitHub App behind the outbox check, the retro and the knowledge harvest

`apps/omni-app` is the webhook server of **omni-loop**, a private GitHub App owned by the vertuoza org
(PRD 28). It does three jobs: the **outbox check** on every pull request, and, after every feature pull
request merges, a **retro** (PRD 72) and a **knowledge harvest** (PRD 82), below. Once the app is installed on a repository, every pull
request carries one check run named **outbox** (shown as **omni-loop · outbox**):

| Situation | Conclusion |
|---|---|
| No `.omni-loop/config.yml` on the base branch | `skipped` — omni-loop is not active on this repo |
| Not a feature PR (sub-PR, other branch, no PRD folder) | `skipped` — omni-loop is not active on this PR |
| Outbox clear | `success` |
| Open items, unreworked drift or unaccounted risky changes | `failure` |
| Red, but labelled with the override label (`labels.outboxGo`) | `neutral` |
| Broken base config, snapshot over its bound, or any failure after retries | `failure` |

Nothing is added to an installed repository: no workflow, no file under `.github/`, no secret.

## The outbox, sent to the Omni page (PRD 251)

A person may answer the outbox on the Omni page, on the PRD's dossier (`/prd/<id>?tab=outbox`, in
`apps/galaxy`), as well as on the pull request. The app is what keeps that page current (ADR-0048):

- **A new event, `issue_comment`** (`created`, `edited`, `deleted`). A comment on a pull request
  re-runs the outbox check exactly as a push does: that is what shows the page an answer typed on
  GitHub. A comment on an issue, and one the app wrote itself (`omni-loop[bot]`), does nothing. A
  comment names no head, so the run reads it off the pull request. The event adds no permission.
- **The relay.** After the check and the comment are published, the `outbox-check` function takes one
  more step, `relay`: when the base branch's config has `answers.enabled` on (the kit's default) and
  `ask.url`'s host is the host of the app's `OMNI_PAGE_URL`, it sends `POST <OMNI_PAGE_URL>/api/outbox`
  what the check read: the numbering, the open items (their files verbatim), the adopted ones, what
  the replies say that nobody has settled yet (the kit's `planReplies`, on the comments the check
  already read), and the settled entries. The body is signed,
  `X-Omni-Signature: sha256=<HMAC-SHA256 of the raw body>`, keyed with `OMNI_OUTBOX_SECRET`, which the
  app and the galaxy share. With the switch off, `ask.url` on another host, or no `OMNI_PAGE_URL`,
  nothing is sent.
- **The last send.** A pull request closed, merged or not, gets one more send with `state` `merged` or
  `closed`, and nothing else: no check run and no comment on it.
- **The relay never changes the check.** Its conclusion and the comment are published before it runs;
  a send the page refuses is retried as an Inngest step, then logged
  (`omni-loop relay: <repo>#<n> was not sent to the Omni page: <reason>`), and the page keeps the last
  outbox it had.

Every door, the page's **Send** included, ends as the person's own reply on the pull request: the
page posts through a user authorisation of this app (its client id and secret live on the galaxy),
never as `omni-loop[bot]`, whose replies `omni replies` does not count.

## The retro (PRD 72)

When a feature PR merges into the default branch, the app runs a retro of its PRD, by itself: code
counts what went wrong from GitHub and from the PRD's folder, and a model writes the prose around those
facts. It ends in a **retro PR** from `branches.retro` (default `docs/retro-<topic>`) into the default
branch, labelled `labels.retro` (default `omni:retro`), adding `retro.md` and `retro.json` to the PRD's
shipped folder (`shipped/<nnnn-topic>/`, always: a PRD merged unshipped is shipped by the knowledge
harvest on the same merge), and in one **retro issue** per finding, at most five per run. A person merges the retro PR; merging keeps the retro
as history and changes nothing else.

- A merged sub-PR, a merged phase-0 PR, a retro PR, a pull request closed without merging and a
  repository without `.omni-loop/config.yml` get no retro, and nothing is posted.
- Without `OPENROUTER_API_KEY`, or when the model fails, the retro still goes out, its summary reading
  "Facts only: <reason>".
- If GitHub fails after the retries, one comment on the merged PR says "The retro could not run:
  <reason>".
- **To re-run a retro,** replay its run from Inngest's dashboard. Publishing is idempotent: the branch
  and the PR are found again, and a commit is added (never a force-push) only when the retro changed.
  A missed webhook can also be redelivered from the app's settings.
- **What leaves GitHub:** the model receives the PRD's title and problem and, per finding, its facts and
  evidence excerpts — the last lines of failed jobs' logs, the hunks of rewritten code, the text of
  stuck and review comments — with token-shaped strings masked. They go to OpenRouter and the model's
  provider. A repository that refuses this leaves `OPENROUTER_API_KEY` unset and gets facts only.

## The knowledge harvest (PRD 82)

On the same merge, the app harvests the PRD's decisions into the knowledge base. Any outbox item still
open is settled as adopted by the person who merged (a merge over a red outbox adopts what is still
open), the PRD's folder is shipped if it never was, and every settled decision not yet written back is
classified by a model and written by code: a decision record, a rule (with the principle it proposes
when none fits), an invariant, covered by an existing entry, or staying in the ledger. It all ends in
one docs-only **knowledge PR** from `branches.knowledge` (default `docs/knowledge-<topic>`) into the
default branch, labelled `labels.knowledge` (default `omni:knowledge`). A person reviews and merges it.

- Every rule about the loop's files is the kit's harvest pipeline, the one `omni harvest` runs locally.
  The app reads the files at the default branch's tip, never at the merge commit: the merge only
  supplies who merged, when, and which PR.
- The same pull requests that get no retro get no harvest, nor does a merged knowledge PR.
- One harvest at a time per repository. Ids are numbered past the default branch and past every other
  open knowledge PR, so two open knowledge PRs never share a record number or a register id.
- Without `OPENROUTER_API_KEY`, or when the model fails, settling and shipping still happen: the
  knowledge PR opens with every decision listed as not placed, saying why.
- The checks (`omni check knowledge`, `omni check outbox`) run on the result; an entry that fails is
  dropped and listed as not placed, with the check's message.
- If GitHub fails after the retries, one comment on the merged PR says "The knowledge harvest could not
  run: <reason>".
- **To re-run a harvest,** replay its run from Inngest's dashboard. The branch and the PR are found
  again: a branch that already holds the harvest's commit is never committed to again, and only the
  PR's body is rewritten. Nothing to harvest opens nothing.
- **What leaves GitHub:** per decision, the outbox item as raised and its answer, and a summary of the
  knowledge base (ids, titles, statements), with token-shaped strings masked. No code, no logs.

## How it runs

```
GitHub ── pull_request / check_run.rerequested / issue_comment ──▶ /api/github    verify signature → inngest.send → 200
             a pull_request.closed        → the outbox's last send (outbox-check, no check run, no comment)
                                            and, merged, omni-loop/retro.requested and
                                            omni-loop/knowledge.harvest.requested
             a comment on an issue, or by omni-loop[bot] → nothing
             every other handled action   → omni-loop/outbox.check.requested
Inngest ──▶ /api/inngest   function "outbox-check" (debounced per repo + PR)
              step "in-progress"  create the check run, in_progress, on the head SHA
              step "evaluate"     snapshot base config + head delivery folder into /tmp, evaluate
              step "publish"      complete the check run; rewrite the outbox comment unless the head moved on
              step "relay"        send the Omni page the outbox the check read (PRD 251), when the
                                  base config turns answers on and ask.url is on OMNI_PAGE_URL's host
            onFailure          complete the check run as failure — never left in_progress
Inngest ──▶ /api/inngest   function "retro" (one at a time per repository)
              step "qualify"          the config at the merge SHA; a feature PR; its PRD folder
              step "gather-pulls"     the sub-PRs into the feature branch
              steps "gather-<kind>"   each kind of finding's GitHub reads, one step per kind
              step "facts"            detect: the fact sheet, memoized
              step "narrate"          the model's prose, called from this Vercel function
              step "guard"            each field of prose accepted, or dropped with its reason
              step "publish-issues"   one retro issue per finding, worst first
              step "publish"          the branch, retro.md + retro.json, then the retro PR
            onFailure          one comment on the merged PR
Inngest ──▶ /api/inngest   function "knowledge-harvest" (one at a time per repository)
              step "qualify"          the merge (who, when, which commit); a feature PR, by the retro's rule
              step "settle"           the default branch's tip: settle at merge, plan the ship, list the candidates
              steps "classify:<id>"   one OpenRouter call per candidate
              step "write"            the same tip: write the knowledge, run both checks, drop what fails
              step "publish"          one commit on branches.knowledge, cut from that tip; the knowledge PR
            onFailure          one comment on the merged PR
```

| Unit | Where |
|---|---|
| `webhook` — verify and filter a delivery | `src/webhook/`, served at `api/github.mjs` |
| `snapshot` — only the listed paths, at most 2,000 files and 20 MB | `src/snapshot/` |
| `evaluate` — pure, reuses the kit's gate unchanged | `src/evaluate/` |
| `publish` — the check run and the comment | `src/publish/` |
| `outbox-check` — the Inngest function | `src/outbox-check/`, served at `api/inngest.mjs` |
| `relay` — whether the outbox goes to the Omni page, what it carries, the signed send | `src/relay/` |
| `retro` — the Inngest function wiring the retro's units | `src/retro/retro.mjs`, served at `api/inngest.mjs` |
| `qualify` — which merged PR gets a retro, and its PRD | `src/retro/qualify.mjs` |
| the kinds of finding — each one's GitHub reads, detector and section | `src/retro/kinds/` (registry: `index.mjs`) |
| `detect` — pure: plain records → the fact sheet | `src/retro/detect.mjs` |
| `narrate` and `guard` — the model's prose, and what of it is kept | `src/retro/narrate.mjs`, `src/retro/guard.mjs` |
| `render` — pure: `retro.md`, `retro.json`, the PR body | `src/retro/render.mjs` |
| the issue publisher, and `publish` — the branch, the files, the PR | `src/retro/issues.mjs`, `src/retro/publish.mjs` |
| `rules` — every threshold, the finding order, the words refused, a version | `src/retro/rules.mjs` |
| `git-write` — the shared writer: a branch, one commit (moves reuse blobs), a PR | `src/git-write/` |
| `knowledge-harvest` — the Inngest function wiring the kit's harvest pipeline | `src/knowledge-harvest/knowledge-harvest.mjs`, served at `api/inngest.mjs` |
| the harvest's GitHub reads — the merge, the tip, the ids other knowledge PRs take | `src/knowledge-harvest/github.mjs` |
| `render` — pure: the knowledge PR's title and body, the commit | `src/knowledge-harvest/render.mjs` |

The app only reads YAML, Markdown, JSON, patches and logs, as text; it never runs repository code. The
retro writes only its own `branches.retro` branches, their pull requests, its retro issues and one
comment on failure; the harvest only its own `branches.knowledge` branches, their pull requests and one
comment on failure. Neither ever force-pushes, writes to the default branch or merges.

Tests run from the repository root with `pnpm test`, against a stubbed GitHub. The retro's tests also
replay PRD 50 as GitHub returned it (`test/fixtures/prd-50/`), offline.

## Setup — human steps

None of these is taken by the code; a person does each once.

1. **Register and install the app.** An org admin registers the app from [`app.yml`](app.yml) (private
   to vertuoza) and installs it on `vertuoza/vertuo-omni-loop`. Check that the manifest's host matches
   the Vercel project's production domain (step 2) before registering; the webhook URL can also be
   corrected later in the app's settings. Keep the app's private key; it is shown once. In the app's
   settings, upload [`assets/logo.png`](assets/logo.png) as the logo (OmniMan landing on a planet,
   drawn from `@omni/sprites`) and set the badge background colour to `#07061c`.
2. **Create the Vercel project** for `apps/omni-app` (root directory `apps/omni-app`, its own project,
   separate from the galaxy) and set these environment variables:
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY` — the PEM; a value pasted with literal `\n` sequences is accepted
   - `GITHUB_WEBHOOK_SECRET` — the same secret as in the app's settings
   - `INNGEST_EVENT_KEY`
   - `INNGEST_SIGNING_KEY`

   The private key lives only there. To rotate it, generate a new key in the app's settings, replace
   the Vercel variable, redeploy, then delete the old key.
3. **Inngest.** Create (or reuse) the Inngest account and sync the app at
   `https://<production domain>/api/inngest`.
4. **Branch protection (optional).** Require the **outbox** check from the `omni-loop` app on the
   default branch.

   > **Warning.** A required check that is never posted blocks every pull request in that repository:
   > if the app is uninstalled, its deploy is broken or Inngest is down, nothing can merge. The
   > remedy is to remove the requirement in branch protection — never to fake a status. Inngest's run
   > history shows whether a run was attempted.
5. **Labels.** Run `npx github:vertuoza/vertuo-omni-loop init` in the repository: it creates the missing `omni:*` labels.

### The Omni page — human steps (PRD 251)

None of these is taken by the code. Until they are done, the Outbox tab shows questions only after a
push, and the page's **Send** fails with GitHub's reason.

1. **Set the two variables** in the app's Vercel project, then redeploy:
   - `OMNI_PAGE_URL` — the galaxy's production address (`https://vertuo-omni-loop-galaxy.vercel.app`),
     whose host must be the host of each repository's `ask.url`;
   - `OMNI_OUTBOX_SECRET` — a long random secret, the same value as on the galaxy's project
     (`openssl rand -hex 32`). A different value on either side, and the page refuses every send (401).
2. **Accept the `issue_comment` event.** An org admin updates the app from [`app.yml`](app.yml) (or
   ticks *Issue comment* under the app's settings › Permissions & events › Subscribe to events), then
   accepts the change on each installation. Until then an answer typed on GitHub reaches the page only
   with the next push.
3. **Let the page post as the person.** In the app's settings › General:
   - under *Callback URL*, add `<galaxy host>/prd/github/callback` for every galaxy host that sends
     (production, and `http://localhost:3000/prd/github/callback` for local work). GitHub brings the
     person back to the host they left from, so a host that is not listed, a preview deployment
     among them, cannot send;
   - allow users to authorise the app (the page asks each person once; after that GitHub brings
     them straight back, with no prompt);
   - generate a client secret and give the galaxy's project `GITHUB_APP_CLIENT_ID` (the app's Client
     ID) and `GITHUB_APP_CLIENT_SECRET` ([`apps/galaxy/README.md`](../galaxy/README.md)).

### The retro — human steps (PRD 72)

None of these is taken by the code. Until steps 1 and 2 are done, a merged feature PR cannot be seen
opening a retro PR live (PRD 72, acceptance criterion 1).

1. **Accept the new permissions.** The retro widened the app's permissions once: `contents: write`
   (was `read`), `issues: write` and `actions: read`. An org admin updates the app from
   [`app.yml`](app.yml) (or in the app's settings), then accepts the new permissions on each
   installation. Until then the retro fails on its first write, and its failure comment says so.
2. **Set the model's key** in the app's Vercel project: `OPENROUTER_API_KEY`, and optionally
   `OPENROUTER_MODEL` to use another model than Claude Opus 5.5. Without the key, every retro goes out
   facts only.
3. **Check the Inngest plan allows a 14-day sleep,** for the second run fourteen days after the merge.
   If it does not, the day-14 run is started by a daily scheduled Inngest function instead.
4. **Create the `omni:retro` label:** run `npx github:vertuoza/vertuo-omni-loop init` in each
   repository.

### The knowledge harvest — human steps (PRD 82)

None of these is taken by the code. The harvest needs nothing beyond the retro's permissions and
environment.

1. **The retro's steps 1 and 2 cover the app.** `contents: write` lets the harvest write its own
   branch, and the one `OPENROUTER_API_KEY` (with `OPENROUTER_MODEL`, when set) serves both the retro
   and the harvest. Without the key, every knowledge PR still settles and ships, and lists every
   decision as not placed.
2. **Create the `omni:knowledge` label** (`labels.autoCreate` is false): run
   `npx github:vertuoza/vertuo-omni-loop init` in each repository, so the label carries its colour
   and description.
3. **Review and merge each knowledge PR.** Entries from adopted decisions carry
   `Proposed: harvest <date>` and bind nothing until a person deletes that line.

## Checking it live

With the app installed on this repository, PRD 28's acceptance criteria 1–6 are re-run by hand on a
feature PR: red with an open item, green once settled, neutral under `omni:outbox-go`, skipped on a sub-PR,
skipped on a repository without `.omni-loop/config.yml`, re-evaluated by **Re-run**.

PRD 251's, once its human steps are done, on a feature PR of a repository whose `ask.url` is the
galaxy: a push shows its questions on the PRD's Outbox tab within a minute; a reply typed on GitHub
shows there as pending; the page's **Send** posts one reply under the person's own account, which
`/omni:yolo-fix` settles with that reply's link as its channel URL.
