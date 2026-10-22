# Product rules

## BR-PRODUCT-1

In a phase-0 pull request, a path under the delivery folder, the knowledge root or the decision-record folder, or equal to the glossary or a context file, counts as documentation. Any other path that is not a PRD-folder or acceptance file counts as source.

Serves: P-PRODUCT-1
Source: .omni-loop/delivery/shipped/0003-omni-loop-kit/outbox/settled.md, entry s13-01-phase-0-docs-kind, PRD #3
Enforced by: kit/lib/policy/phase-0.test.ts
Governs: ^kit/lib/policy/phase-0\.
Stated: 2026-09-25
Decided: @claude-code-session (delegated by pierre-derval) via PRD issue #3, 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #4

## BR-PRODUCT-2

When a pull request's head commit date cannot be read, the claimed-stale check treats the claim as having moved on, so the slice is never marked stale on that signal alone.

Serves: P-PRODUCT-2
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s3-03-unknown-head-commit-date-reads-as-not-stale, PRD #7
Enforced by: kit/lib/board.test.ts
Governs: ^kit/lib/board\.
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9

## BR-PRODUCT-4

Every slice is claimed by a draft pull request before it is built, however it is started, except in a plan of fewer slices than `wave.inlineBelow`, which is built on its feature branch and whose feature PR is the record of every slice: the wave claims under --in-wave, and do-work run alone opens the claim itself when none exists.

Serves: P-PRODUCT-4
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s5-02-claim-first-alone, PRD #7
Enforced by: kit/test/plugin.test.ts
Governs: ^kit/plugin/skills/(do-work|wave|pr)/, ^kit/test/plugin\.test\.ts$
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9

## BR-PRODUCT-8

When a kit default names {config:<key>} and the key is unknown, set to null, or holds a list or a section, the placeholder stays in the text exactly as written and a problem line is reported.

Serves: P-PRODUCT-7
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s1-01-kit-default-names-an-unset-setting, PRD #45
Enforced by: kit/lib/playbook/resolve.test.ts
Governs: ^kit/lib/playbook/resolve\.
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46

## BR-PRODUCT-9

A form section holding repository text beside TODO(human) lines reads as text: the text shows as written, labelled [repo], and each TODO(human) line is still listed as an open question. A section holding only HTML comments reads as empty.

Serves: P-PRODUCT-8
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s1-02-section-with-text-and-open-questions, PRD #45
Enforced by: kit/lib/playbook/resolve.test.ts
Governs: ^kit/lib/playbook/resolve\.
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46

## BR-PRODUCT-10

Invade rewrites a knowledge-page section only when it is empty, holds nothing but TODO(human) lines, or its marker says by: invade; any other written section, labelled or not, is a person's and is left alone.

Serves: P-PRODUCT-9
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s5-03-terraform-treats-an-unmarked-section-as-a-persons, PRD #45
Enforced by: kit/test/plugin.test.ts
Governs: ^kit/plugin/skills/(invade)/, ^kit/test/plugin\.test\.ts$
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46

## BR-PRODUCT-11

Invade marks a form state: filled with invaded: <today> when any section holds text, a See: line or a TODO(human) question; only a wholly empty form stays state: blank with invaded: null.

Serves: P-PRODUCT-10
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s5-05-terraform-marks-a-form-holding-only-questions-filled, PRD #45
Enforced by: kit/test/plugin.test.ts
Governs: ^kit/plugin/skills/(invade)/, ^kit/test/plugin\.test\.ts$
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46

## BR-PRODUCT-16

A retro field the model wrote is dropped when it exceeds its cap in rules or holds any refused word. The refused words are both kit question-pool lists: the game words and the person-or-team words.

Serves: P-PRODUCT-15
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s2-04-prose-caps-and-refused-words, PRD #72
Enforced by: apps/omni-app/src/retro/guard.test.ts
Governs: ^apps/omni-app/src/retro/guard\.
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-17

A failing test is named by its file, groups and title joined by ' > ', with whitespace collapsed and line numbers and retry marks dropped, whatever tool ran it. Only final failures count; a test that passes on a retry within the run does not.

Serves: P-PRODUCT-16
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s3-03-one-name-per-failing-test, PRD #72
Enforced by: apps/omni-app/src/retro/kinds/ci-logs.test.ts
Governs: ^apps/omni-app/src/retro/kinds/ci-logs\.
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-18

Retro churn counts only commits of pull requests merged into the feature branch, walked in merge order and skipping merge commits. A line range is churned when 3 commits wrote it, its first writing included.

Serves: P-PRODUCT-17
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s4-01-churn-counts-merged-work, PRD #72
Enforced by: apps/omni-app/src/retro/kinds/churn.test.ts
Governs: ^apps/omni-app/src/retro/kinds/churn\.
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-19

Retro churn leaves out known lockfiles by name at any depth and paths the root .gitattributes marks linguist-generated at the merge. When no commit could be read, the churn section is left out, never shown as zeros, and retro.json records what was not read.

Serves: P-PRODUCT-7
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s4-03-churn-leaves-out-tool-written-files, PRD #72
Enforced by: apps/omni-app/src/retro/kinds/churn.test.ts
Governs: ^apps/omni-app/src/retro/kinds/churn\.
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-20

When the retro grades a territory breach, shared ground is only the prefixes that two slices both declare in the plan's table. A path the plan's sharing note merely mentions is not shared, so a breach under it is still a finding.

Serves: P-PRODUCT-18
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s5-01-shared-ground-is-computed, PRD #72
Enforced by: apps/omni-app/src/retro/kinds/delivery.test.ts
Governs: ^apps/omni-app/src/retro/kinds/delivery\.
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-21

In retro prose, a backtick span is set aside only when it holds a letter and appears verbatim in the evidence or is a finding id; only evidence URLs pass as links. A refused field is replaced by a fixed reason line, never the refused words.

Serves: P-PRODUCT-19
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s6-03-what-the-guard-counts-as-copied, PRD #72
Enforced by: apps/omni-app/src/retro/guard.test.ts
Governs: ^apps/omni-app/src/retro/guard\.
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-22

A bug counts against a request when it has the bug label, was opened within 14 days of the merge and names #<prd>. It is fixed by a PR merged to the default branch in that window that closes it, and is tied to churn when its changed lines overlap a range, or by file when no patch is sent.

Serves: P-PRODUCT-20
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s8-05-what-ties-a-bug-to-the-prd, PRD #72
Enforced by: apps/omni-app/src/retro/kinds/after-merge.test.ts
Governs: ^apps/omni-app/src/retro/kinds/after-merge\.
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-23

The config refuses a signature.name or signature.email that is empty, holds a line break, or holds < or >, with an error naming that key. signature.footer only has to be non-empty.

Serves: P-PRODUCT-21
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s1-01-signature-name-address-shape, PRD #99
Enforced by: kit/lib/config.test.ts
Governs: ^kit/lib/config\., ^kit/lib/signature\.
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #103

## BR-PRODUCT-24

When any gh search for omni credits fails, the run prints one line and exits 2 with no report. When a pull request named by a signed commit cannot be opened, that pull request is left uncounted with a warning, unless gh is missing, logged out or rate limited.

Serves: P-PRODUCT-22
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s3-02-credits-other-github-failures, PRD #99
Enforced by: kit/bin/credits.test.ts
Governs: ^kit/lib/credits/, ^kit/bin/commands/credits\.ts$, ^kit/bin/credits\.test\.ts$
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #103

## BR-PRODUCT-25

In omni credits, an issue or pull request opened by the signature's bot account is counted only on its own 'Opened by the app' line, never in the PR or PRD issue counts, and never marks when signing started in a repository.

Serves: P-PRODUCT-23
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s4-01-credits-app-items-counted-apart, PRD #99
Enforced by: kit/lib/credits/classify.test.ts
Governs: ^kit/lib/credits/classify\.
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #103

## BR-PRODUCT-26

With signing off, omni credits prints PRD issues as a bare count and omits the app and co-authored commit lines; with no bot account for the address, only the app line goes. Under --json those totals are null, never zero.

Serves: P-PRODUCT-24
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s4-03-credits-lines-not-looked-for, PRD #99
Enforced by: kit/bin/credits.test.ts
Governs: ^kit/lib/credits/, ^kit/bin/commands/credits\.ts$, ^kit/bin/credits\.test\.ts$
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #103

## BR-PRODUCT-31

The public /design page dresses its heroes only in the six built-in fleets of the demo galaxy, never in any workspace's own fleets, whoever is viewing.

Serves: P-PRODUCT-29
Source: .omni-loop/delivery/shipped/0141-design-system/outbox/settled.md, entry s6-01-design-page-shows-the-built-in-fleets, PRD #141
Enforced by: apps/galaxy/src/design/render.test.ts
Governs: ^apps/galaxy/src/design/
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #153

## BR-PRODUCT-45

On HOME, pressing Enter runs PRESS START unless the focus is on a button, link or field, which then does what that control does. PRESS START opens the app last picked, or SELECT YOUR APP when none is remembered.

Serves: P-PRODUCT-42
Source: .omni-loop/delivery/shipped/0261-home/outbox/settled.md, entry s3-02-enter-on-focused-controls, PRD #261
Enforced by: apps/galaxy/src/home/start.test.ts
Governs: ^apps/galaxy/src/home/start\.
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #263

## BR-PRODUCT-50

The dashboard's waiting-for-you tile counts the same questions the page's sidebar lists, each once, even one that is both yours and shared with you. When that list cannot be read, the tile says it could not load and the rest of the dashboard still shows.

Serves: P-PRODUCT-47
Source: .omni-loop/delivery/shipped/0657-snappy-pages/outbox/settled.md, entry s2-02-waiting-count-from-the-shared-list, PRD #657
Enforced by: apps/galaxy/src/dashboard/stream/home.test.ts
Governs: ^apps/galaxy/src/dashboard/stream/home\.
Stated: 2026-09-29
Decided: nobody — adopted when raised (medium), 2026-09-29
Merged: @pierrederval, 2026-09-29, PR #664

## BR-PRODUCT-51

A person's name links to their profile page only when they are a member of the workspace; the name of someone outside it, such as an outside contributor, is shown without a link.

Serves: P-PRODUCT-48
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s1-01-chip-links-members-only, PRD #698
Enforced by: apps/galaxy/src/people/chips.test.ts
Governs: ^apps/galaxy/src/people/
Stated: 2026-09-29
Decided: nobody — adopted when raised (medium), 2026-09-29
Merged: @pierrederval, 2026-09-29, PR #699

## BR-PRODUCT-52

On a person's profile, each PRDs stage count opens the PRD list at that stage filtered to that person, never to everyone's or the viewer's own PRDs.

Serves: P-PRODUCT-49
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s3-02-profile-stage-links, PRD #698
Enforced by: apps/galaxy/src/profile/select.test.ts
Governs: ^apps/galaxy/src/profile/select\.
Stated: 2026-09-29
Decided: nobody — adopted when raised (medium), 2026-09-29
Merged: @pierrederval, 2026-09-29, PR #699

## BR-PRODUCT-53

When the PRD list is narrowed to one person, it shows only the PRDs that person started in the app, the same rule as for your own PRDs. Who opened the GitHub issue never counts, and a PRD with no recorded starter shows under nobody.

Serves: P-PRODUCT-50
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s4-01-prd-opener-rule, PRD #698
Enforced by: apps/galaxy/src/dossier/page/history.test.ts
Governs: ^apps/galaxy/src/dossier/page/history\.
Stated: 2026-09-29
Decided: nobody — adopted when raised (medium), 2026-09-29
Merged: @pierrederval, 2026-09-29, PR #699

## BR-PRODUCT-54

On a person's profile, a PRD, bug fix or visual update is listed for the chosen week, month or season when its latest activity falls within that period, even if it was started earlier; one started in the period with no activity since is judged by that latest activity.

Serves: P-PRODUCT-51
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s5-01-profile-work-period-by-activity, PRD #698
Enforced by: apps/galaxy/src/profile/select.test.ts
Governs: ^apps/galaxy/src/profile/select\.
Stated: 2026-09-29
Decided: nobody — adopted when raised (medium), 2026-09-29
Merged: @pierrederval, 2026-09-29, PR #699

## BR-PRODUCT-55

A person's profile lists only the PRDs and fixes of the workspace the profile is about, as its board does. See all opens the full list, covering every workspace the viewer and that person both belong to.

Serves: P-PRODUCT-52
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s5-02-profile-work-one-workspace, PRD #698
Enforced by: apps/galaxy/src/profile/profile.test.ts
Governs: ^apps/galaxy/src/profile/profile\.
Stated: 2026-09-29
Decided: nobody — adopted when raised (medium), 2026-09-29
Merged: @pierrederval, 2026-09-29, PR #699

## BR-PRODUCT-62

When more than one workspace tracks a repository, the canon check reads the business of the workspace whose GitHub organisation owns the repository; when none does, it reads the workspace that started tracking it first.

Serves: P-PRODUCT-57
Source: .omni-loop/delivery/shipped/0839-canon-check/outbox/settled.md, entry s1-01-app-read-workspace-choice, PRD #839
Enforced by: apps/omni-app/src/canon/business-pick-sql.test.ts
Governs: ^apps/omni-app/src/canon/business-pick-sql\.test\.ts$, ^supabase/migrations/
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #840

## BR-PRODUCT-67

A product's Statement is a single line of at most 400 characters, and its owner can remove it and write a new one. Never line numbers count per product, so each product's first Never line is number one.

Serves: P-PRODUCT-59
Source: .omni-loop/delivery/shipped/0871-product-constituents/outbox/settled.md, entry s1-02-statement-shape-and-never-numbers, PRD #871
Enforced by: apps/galaxy/src/constituents/constituents-sql.test.ts
Governs: ^apps/galaxy/src/constituents/constituents-sql\.test\.ts$, ^supabase/migrations/
Stated: 2026-10-01
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-01, PR #874

## BR-PRODUCT-68

The inbox check turns red for a spec break only when it can quote the spec sentence and name the Never line or Statement it breaks. Jev's answer can only confirm or clear a quoted break; with no quoted finding, the check stays green whatever Jev says.

Serves: P-PRODUCT-60
Source: .omni-loop/delivery/shipped/0871-product-constituents/outbox/settled.md, entry s5-02-jev-broken-without-quote-is-not-red, PRD #871
Enforced by: apps/omni-app/src/canon/canon.test.ts
Governs: ^apps/omni-app/src/canon/canon\.
Stated: 2026-10-01
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-01, PR #874

## BR-PRODUCT-69

The plan check accepts a slice that must come first only when it sits strictly before every other slice, ordered by landing and then wave. A slice in a later landing already waits for it, the file limit counts the paths a slice lists, and in a plan repository each repository's rows are checked against that repository's own rules (a target with no copied rules against the kit's defaults).

Serves: P-PRODUCT-61
Source: .omni-loop/delivery/shipped/1089-repo-flow/outbox/settled.md, entry s3-01-plan-rules-order-and-reach, PRD #1089
Enforced by: kit/lib/inbox/plan-grade.test.ts
Governs: ^kit/lib/inbox/plan-grade\.
Stated: 2026-10-06
Decided: nobody — adopted when raised (medium), 2026-10-06
Merged: @pierrederval, 2026-10-06, PR #1090
Reworded: @pierrederval, 2026-10-11, the plan check grades each target against its own flow since #1090

## BR-PRODUCT-70

A product's pitch look may be changed by exactly those who may edit the workspace's business, which today is every member; anyone else sees it read-only.

Serves: P-PRODUCT-62
Source: .omni-loop/delivery/shipped/0859-pitch/outbox/settled.md, entry s1-02-every-member-edits-the-look, PRD #859
Enforced by: apps/galaxy/src/products/pitch-look-sql.test.ts
Governs: ^apps/galaxy/src/products/pitch-look-sql\.test\.ts$, ^supabase/migrations/
Stated: 2026-10-06
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-06, PR #860

## BR-PRODUCT-71

When a pull request waits on another that was closed without merging, it is no longer held and care goes back to fixing it. When the awaited pull request cannot be looked up, it stays held and no fix attempt is spent.

Serves: P-PRODUCT-63
Source: .omni-loop/delivery/shipped/1118-mega-care-bug-fix/outbox/settled.md, entry s1-01-waits-on-closed-or-unreadable, PRD #1118
Enforced by: kit/lib/care/decide.test.ts
Governs: ^kit/lib/care/decide\.
Stated: 2026-10-06
Decided: nobody — adopted when raised (medium), 2026-10-06
Merged: @pierrederval, 2026-10-06, PR #1119

## BR-PRODUCT-72

The care list reads a bug's fix pull requests from its fix-plan table, one per row in table order, and takes the bug's record from the pull requests of the plan's own repository that the loop reports as closing it. A repository with no pull request yet is left off until one opens.

Serves: P-PRODUCT-64
Source: .omni-loop/delivery/shipped/1118-mega-care-bug-fix/outbox/settled.md, entry s1-02-care-list-reads-bug-fix-plan, PRD #1118
Enforced by: kit/bin/care.test.ts
Governs: ^kit/bin/commands/care\.ts$, ^kit/bin/care\.test\.ts$, ^kit/lib/loop-reads/
Stated: 2026-10-06
Decided: nobody — adopted when raised (medium), 2026-10-06
Merged: @pierrederval, 2026-10-06, PR #1119
Reworded: @pierrederval, 2026-10-12, the bug's record comes from the plan repository's closing pull requests as the Omni page reports them since #1665 (entry s4-05-law-proofs-on-loop-reads)

## BR-PRODUCT-73

A loop that has not yet said when it will wake next reads live until one hour after the last thing it pushed; only then is it shown silent and may it be taken over.

Serves: P-PRODUCT-2
Source: .omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md, entry s2-01-loop-silent-before-first-wake, PRD #1139
Enforced by: apps/galaxy/src/loop/api.test.ts
Governs: ^apps/galaxy/src/loop/api\.
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1142

## BR-PRODUCT-74

Parking a PRD records who it waits on and the loop keeps running; a later round of that PRD takes it off the parked list. A stopping loop ends parked if PRDs still wait, else stopped, and an ended loop refuses any push.

Serves: P-PRODUCT-65
Source: .omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md, entry s2-02-loop-park-and-stop, PRD #1139
Enforced by: apps/galaxy/src/loop/migration.test.ts
Governs: ^apps/galaxy/src/loop/(migration|store|state)\., ^supabase/migrations/
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1142

## BR-PRODUCT-75

A signed-out visitor to the Loop page or one loop's page is asked to sign in, the same as on the Engineering page. The demo loops show only where every page shows its demo: in development or when the demo mode is switched on.

Serves: P-PRODUCT-66
Source: .omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md, entry s5-02-loop-page-signed-out, PRD #1139
Enforced by: apps/galaxy/src/loop/page/page.test.ts
Governs: ^apps/galaxy/src/loop/page/
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1142

## BR-PRODUCT-76

omni loop push counts as off, printing off and exiting 1, only when ask.url is not set. It never reads dossier.enabled, so a repository with the dossier switched off still sends its loop state to the Loop page.

Serves: P-PRODUCT-67
Source: .omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md, entry s4-01-loop-push-off-switch, PRD #1139
Enforced by: kit/bin/loop.test.ts
Governs: ^kit/bin/commands/loop\.ts$, ^kit/bin/loop\.test\.ts$, ^kit/lib/loop/
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1142

## BR-PRODUCT-81

Any member of a roadmap's workspace may push an update to it, replacing its document and PRD rows, and the roadmap records the member who pushed last. A roadmap born on the server keeps every push as a version, adding one only for what changed.

Serves: P-PRODUCT-72
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s2-02-roadmap-any-member-pushes, PRD #1162
Enforced by: supabase/checks/roadmaps.sql, apps/galaxy/src/roadmap/migration.test.ts, kit/lib/roadmap/push.test.ts
Governs: ^supabase/checks/roadmaps\.sql$, ^apps/galaxy/src/roadmap/, ^kit/lib/roadmap/push\., ^supabase/migrations/
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1163

## BR-PRODUCT-83

The roadmap check refuses a project that installs another repository's package unless its wave comes after every project it waits on, directly or through others, that changes that repository. Projects that do not wait on each other may share a wave.

Serves: P-PRODUCT-61
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s4-01-consumer-rule-follows-blockers, PRD #1162
Enforced by: kit/lib/roadmap/grade.test.ts, kit/lib/roadmap/grade.ts
Governs: ^kit/lib/roadmap/grade\.
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1163

## BR-PRODUCT-84

The roadmap check accepts a row when its project's folder is in the inbox or the shipped folder, and compares its spec wherever it lives; only a row whose project is in neither is refused. A product roadmap's row may instead name a product PRD such as mobile-12.

Serves: P-PRODUCT-73
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s4-02-shipped-prd-still-counts, PRD #1162
Enforced by: kit/lib/roadmap/grade.test.ts
Governs: ^kit/lib/roadmap/grade\.
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1163

## BR-PRODUCT-85

In a plan repository's roadmap, every project must name at least one repository; outside a plan repository, a repositories column is refused, except in a product roadmap, which requires one naming the product's own repositories. The source line, like the product and target date, is optional.

Serves: P-PRODUCT-74
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s4-03-repos-column-and-source, PRD #1162
Enforced by: kit/lib/roadmap/parse.test.ts, kit/lib/roadmap/grade.test.ts
Governs: ^kit/lib/roadmap/(parse|grade)\.
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1163

## BR-PRODUCT-86

omni roadmap push marks a PRD building once its feature PR is open, outbox when its draft holds open questions, ready once every part is ready, merged once every part merged; a PRD not started names its first unmerged blocker. If GitHub is unreadable, nothing is pushed.

Serves: P-PRODUCT-75
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s6-01-roadmap-push-reads-the-prs, PRD #1162
Enforced by: kit/lib/roadmap/push.test.ts, kit/bin/roadmap.test.ts
Governs: ^kit/lib/roadmap/push\., ^kit/bin/commands/roadmap\.ts$, ^kit/bin/roadmap\.test\.ts$
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1163

## BR-PRODUCT-87

The steps to launch list only steps that have work to start and are not already running; a step that only waits is left out. Held names only steps a rule keeps back, never a step left out because every slot is full.

Serves: P-PRODUCT-76
Source: .omni-loop/delivery/shipped/1205-parallel-loop-steps/outbox/settled.md, entry s1-01-steps-only-act, PRD #1205
Enforced by: kit/lib/next/follow.test.ts, kit/bin/next.test.ts
Governs: ^kit/lib/next/, ^kit/bin/commands/next\.ts$, ^kit/bin/next\.test\.ts$
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1206

## BR-PRODUCT-88

A PRD runs the wave holding a live claim (a draft sub-PR in flight, not stale or stalled) on one of its slices. Otherwise, when its feature PR has the in-progress label and a status comment fresh within the claim limit, it runs its first step not done.

Serves: P-PRODUCT-77
Source: .omni-loop/delivery/shipped/1205-parallel-loop-steps/outbox/settled.md, entry s1-02-running-read, PRD #1205
Enforced by: kit/lib/next/follow.test.ts, kit/bin/next.test.ts
Governs: ^kit/lib/next/, ^kit/bin/commands/next\.ts$, ^kit/bin/next\.test\.ts$
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1206

## BR-PRODUCT-89

While a step the drive session started is not yet shown running on GitHub, the session launches no new step. It never launches a step for a PRD it already has a step agent on, and never runs more than limits.parallelSteps agents at once.

Serves: P-PRODUCT-78
Source: .omni-loop/delivery/shipped/1205-parallel-loop-steps/outbox/settled.md, entry s2-01-unseen-step-holds-pool, PRD #1205
Enforced by: kit/test/plugin.test.ts
Governs: ^kit/plugin/skills/(drive)/, ^kit/test/plugin\.test\.ts$
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1206

## BR-PRODUCT-90

When a session's branch names a feature or a fix, the session shows that work, even if its record says it last worked on something else. Only on a branch that names nothing does it show the last recorded work.

Serves: P-PRODUCT-79
Source: .omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md, entry s2-01-branch-before-record, PRD #1208
Enforced by: kit/lib/now/now.test.ts
Governs: ^kit/lib/now/now\.
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1210

## BR-PRODUCT-91

The status line refreshes the links of the work a session is on when they are missing or a minute old and no refresh holds them, for a PRD not yet shipped (in review included) and a fix not yet merged; finished work is never refreshed.

Serves: P-PRODUCT-80
Source: .omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md, entry s5-03-links-refresh-for-any-live-work, PRD #1208
Enforced by: kit/bin/statusline.test.ts, kit/lib/statusline/board-cache.test.ts
Governs: ^kit/lib/statusline/, ^kit/bin/commands/statusline\.ts$, ^kit/bin/statusline\.test\.ts$
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1210

## BR-PRODUCT-92

The dashboard counts only PRDs and fixes. A concept stored in the workspace is read without failing the dashboard and is left out of its counts, since concepts have their own list.

Serves: P-PRODUCT-30
Source: .omni-loop/delivery/shipped/1272-concepts-page/outbox/settled.md, entry s2-01-dashboard-skips-concepts, PRD #1272
Enforced by: apps/galaxy/src/data/dossiers.test.ts
Governs: ^apps/galaxy/src/data/dossiers\.
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-09, PR #1282

## BR-PRODUCT-93

A concept's review state is unknown when no facts are stored for it, or its stored pull request is unread or missing. The concepts list reads only stored facts and never asks GitHub; the sync or the concept's own page fills them in.

Serves: P-PRODUCT-7
Source: .omni-loop/delivery/shipped/1272-concepts-page/outbox/settled.md, entry s4-02-concept-state-unknown-until-read, PRD #1272
Enforced by: apps/galaxy/src/concepts/state.test.ts, apps/galaxy/src/concepts/list.test.ts
Governs: ^apps/galaxy/src/concepts/(state|list)\.
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-09, PR #1282

## BR-PRODUCT-95

With 'every law names its test' switched on, the knowledge check refuses only this repository's confirmed rules and invariants that name no test. Proposed entries and knowledge copied from other repositories may stay untested.

Serves: P-PRODUCT-81
Source: .omni-loop/delivery/shipped/1342-laws-with-their-test/outbox/settled.md, entry s1-01-require-proof-skips-proposed-and-copies, PRD #1342
Enforced by: kit/lib/knowledge/check-knowledge.test.ts
Governs: ^kit/lib/knowledge/check-knowledge\.
Stated: 2026-10-10
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-10, PR #1343

## BR-PRODUCT-109

When omni design touched cannot read the base branch it compares against, it answers ui: unknown, names the base it could not read, and exits 0. A wrong number of arguments still exits 2.

Serves: P-PRODUCT-7
Source: .omni-loop/delivery/shipped/1369-design-craft/outbox/settled.md, entry s2-01-unreadable-base-reads-unknown, PRD #1369
Enforced by: kit/bin/design.test.ts, kit/lib/design/touched.test.ts, kit/lib/design/base.test.ts
Stated: 2026-10-11
Decided: nobody — adopted when raised (medium), 2026-10-10
Merged: @pierrederval, 2026-10-11, PR #1371

## BR-PRODUCT-119

On the Constellation, choosing a repository keeps the lit PRD, and choosing a PRD keeps the open repository card. 'Everything' clears only the lit PRD and leaves the open repository as it was.

Serves: P-PRODUCT-100
Source: .omni-loop/delivery/shipped/2129-constellation-tab/outbox/settled.md, entry s2-01-filter-and-star-together, PRD #2129
Enforced by: apps/galaxy/src/product-home/constellation.test.ts, apps/galaxy/src/product-home/tabs.test.ts
Stated: 2026-10-17
Decided: nobody — adopted when raised (medium), 2026-10-16
Merged: @pierrederval, 2026-10-17, PR #2130

## BR-PRODUCT-121

Any member of a concept's workspace may mark the concept done, or reopen it, through the Omni page's route, whatever its review state: the route does not refuse a concept whose concept PR has not merged, since the page's Mark done button shows only where it applies. Someone who cannot read the concept still gets the same not-a-member answer whether or not it exists.

Serves: P-PRODUCT-7
Source: .omni-loop/delivery/shipped/2213-concept-shipped/outbox/settled.md, entry s3-01-mark-done-guards, PRD #2213
Enforced by: apps/galaxy/src/concepts/done.test.ts
Governs: ^apps/galaxy/src/concepts/done
Stated: 2026-10-20
Decided: @pierrederval, 2026-10-20

## BR-PRODUCT-123

A repository's Runner skills block lists a folder only when it holds a skill file whose name is valid and equals the folder's name, and that name is not one of the loop's own skills; any other folder is left out.

Serves: P-PRODUCT-101
Source: .omni-loop/delivery/shipped/2313-runner-repo-skills/outbox/settled.md, entry s3-02-s3-which-folders-are-skills, PRD #2313
Enforced by: apps/galaxy/src/repositories/skills.test.ts, apps/galaxy/src/runners/runners.skills.migration.test.ts
Stated: 2026-10-21
Decided: nobody — adopted when raised (medium), 2026-10-21
Merged: @pierrederval, 2026-10-21, PR #2316
Proposed: harvest 2026-10-22
