# Ask rules

## BR-PRODUCT-12

A round moves only from open to answered, from open to abandoned, or from abandoned to answered from the terminal, and an answer never changes. A session is deleted only by its owner, its rounds with it; the hourly clean-up closes idle sessions and deletes nothing.

Serves: P-PRODUCT-11
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s2-04-round-moves-forward, PRD #71
Enforced by: apps/galaxy/src/ask/rounds-sql.test.ts
Governs: ^apps/galaxy/src/ask/rounds-sql\.test\.ts$, ^supabase/migrations/
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73
Kept id: moved from product, PRD 2346

## BR-PRODUCT-13

The ask page offers to send an answer only while the newest round is open, readable and younger than HOOK_WAIT_MS (540 s) by the server's clock. After that it shows the question as moved to the terminal, even without an abandon.

Serves: P-PRODUCT-12
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s4-02-question-moves-on-time, PRD #71
Enforced by: apps/galaxy/src/ask/page/view.test.ts
Governs: ^apps/galaxy/src/ask/page/view\.
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73
Kept id: moved from product, PRD 2346

## BR-PRODUCT-14

When a multi-select question has ticked choices and typed Other text, Claude receives the ticked labels in the order the options are listed, then the typed text, joined with ", ". For a single choice, typing an Other answer replaces the choice.

Serves: P-PRODUCT-13
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s4-03-own-answer-with-several-choices, PRD #71
Enforced by: apps/galaxy/src/ask/answer-model.test.ts
Governs: ^apps/galaxy/src/ask/answer-model\.
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73
Kept id: moved from product, PRD 2346

## BR-PRODUCT-15

omni ask on opens no session and closes none, so switching it on in one terminal never touches another. omni ask off closes every terminal's session of this checkout and always stops ask mode there, exiting 0, with one warning line per session the page could not be told; that session closes by itself after 12 hours without a call.

Serves: P-PRODUCT-14
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s5-02-switching-when-the-page-is-away, PRD #71
Enforced by: kit/bin/ask.test.ts
Governs: ^kit/lib/ask/, ^kit/bin/commands/ask\.ts$, ^kit/bin/ask\.test\.ts$
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73
Kept id: moved from product, PRD 2346

## BR-PRODUCT-29

Ask mode is open to any workspace member, whatever the account's email or with none: membership is the only gate, never an email domain. A session goes to the workspace that owns its repository, and is refused when the person is not a member of it; a repository no workspace owns goes to the person's first workspace. An account in no workspace is refused. Every member of a workspace reads its sessions and rounds; only a session's owner keeps, closes or deletes it.

Serves: P-PRODUCT-27
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry fix-s1-01-migration-after-ask-mode-01-ask-mode-crew-is-any-workspace, PRD #100
Enforced by: apps/galaxy/src/ask/workspace-gate-sql.test.ts
Governs: ^apps/galaxy/src/ask/workspace-gate-sql\.test\.ts$, ^supabase/migrations/
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #101
Kept id: moved from product, PRD 2346

## BR-PRODUCT-38

Each question's cost uses the price list's per-million-token prices. Cache reads cost 0.1× and cache writes 1.25× the input price unless the model's own entry says otherwise. A model not on the list shows no cost, never a guess.

Serves: P-PRODUCT-36
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s1-03-price-table-values, PRD #144
Enforced by: apps/galaxy/src/ask/prices.test.ts
Governs: ^apps/galaxy/src/ask/prices\.
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #147
Kept id: moved from product, PRD 2346

## BR-PRODUCT-39

An ask session that belongs to no workspace is kept, and nobody can read it, its owner included, until a person moves it into a workspace by hand. The change never deletes such a session.

Serves: P-PRODUCT-27
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s2-02-session-of-owner-in-no-workspace, PRD #144
Enforced by: apps/galaxy/src/ask/workspace-sql.test.ts
Governs: ^apps/galaxy/src/ask/workspace-sql\.test\.ts$, ^supabase/migrations/
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #147
Kept id: moved from product, PRD 2346

## BR-PRODUCT-40

The model's guessed category is written only while no person has set one, through a function only the session's owner may call, under the asker's own sign-in. A category a person set is never replaced by the guess.

Serves: P-PRODUCT-37
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s3-02-model-guess-never-overrides, PRD #144
Enforced by: apps/galaxy/src/ask/category-sql.test.ts
Governs: ^apps/galaxy/src/ask/category-sql\.test\.ts$, ^supabase/migrations/
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #147
Kept id: moved from product, PRD 2346

## BR-PRODUCT-41

The share list and the already-answered note name each workspace member by their arcade name, or by their email address when they have none. The list is given only to members of that same workspace.

Serves: P-PRODUCT-38
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s4-01-teammates-named-by-email, PRD #144
Enforced by: apps/galaxy/src/ask/members-sql.test.ts
Governs: ^apps/galaxy/src/ask/members-sql\.test\.ts$, ^supabase/migrations/
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #147
Kept id: moved from product, PRD 2346

## BR-PRODUCT-94

Every ask call the terminal makes also accepts the page's own sign-in when the request carries no terminal token. An answer marked as given on the page is taken only from the page's sign-in, never from a terminal token.

Serves: P-PRODUCT-66
Source: .omni-loop/delivery/shipped/1318-layered-data-access/outbox/settled.md, entry s3-01-cookie-session-on-every-ask-route, PRD #1318
Enforced by: apps/galaxy/src/ask/api.test.ts
Governs: ^apps/galaxy/src/ask/api\.
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-09
Decided: @pierrederval, 2026-10-09
Kept id: moved from product, PRD 2346
