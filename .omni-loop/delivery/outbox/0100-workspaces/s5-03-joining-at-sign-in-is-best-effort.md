---
id: s5-03-joining-at-sign-in-is-best-effort
prd: 100
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Every sign-in now adds the person to their company's workspace. If that step fails, should the sign-in fail with it?

## The decision, in plain words

No: the sign-in goes on, the failure is written to the server's log, and the arcade tries the joining once more when the page opens.

## The intro, for fun

The door opened, but the guest book pen ran out of ink.

## The punchline, for fun

We let the guest in and asked them to sign on the way to the coat rack.

## The options, in plain words

A. Carry on, log the failure, and let the page join once more. This is what was built.
B. Stop the sign-in and send the person back to INSERT COIN with a message asking them to try again.

## What I had to decide

What the auth callback does when `join_by_domain()` fails after a sign-in. The spec says the callback calls it after every sign-in, beside `link_github()`, and that the page calls it once more for a person with no membership; it does not say whether a failed call stops the sign-in.

## What I did meanwhile

`afterSignIn()` and `joinBeforeIssue()` in `apps/galaxy/src/data/sign-in.ts` catch the error, log it, and carry on: a plain sign-in returns to the arcade as usual, whose page joins once more (`memberWorkspace()` in `src/data/workspace.ts`); a GitHub link goes on to `link_github()`, which refuses a person in no workspace with its own message; the terminal's sign-in goes on to `ask_cli_code_issue()`, which refuses the same way. `sign-in.test.ts` pins all three.

## What it costs to change later

A few lines in `apps/galaxy/src/data/sign-in.ts` and their tests: returning a `signin_error` instead of carrying on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how often the joining could fail while the sign-in itself succeeded, since both reach the same Supabase project, is not known (author)
