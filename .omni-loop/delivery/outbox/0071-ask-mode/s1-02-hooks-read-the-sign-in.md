---
id: s1-02-hooks-read-the-sign-in
prd: 71
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The hooks need the person's sign-in to talk to the page, but the sign-in itself is built by a later slice. Should the hooks read the saved sign-in on their own now, or wait for that slice?

## The decision, in plain words

The hooks read the saved sign-in themselves, and save a renewed one when the server asks for it, in the layout the spec describes. The later sign-in slice must write the same layout.

## The intro, for fun

Two slices need the same key, and only one of them is allowed to cut it.

## The punchline, for fun

So the first one borrowed the spare and left a note on the door.

## The options, in plain words

A. The hooks read and renew the saved sign-in themselves, in the layout the spec describes, the option built.
B. The hooks make no call until the sign-in slice connects its own store to them.
C. Widen the sign-in slice's ground so that it connects its store to the hooks itself.

## What I had to decide

Where the hooks get their access token. The plan gives `kit/lib/ask/credentials` (the store `omni signin` writes) to s3, and `kit/bin/commands/ask.mjs`, where the hooks are wired, to s1 and s5 only, so s3 cannot connect its store to the hooks; yet s1's done-when needs "a 401 refreshes once and retries", which means reading and rewriting the stored tokens.

## What I did meanwhile

`kit/lib/ask/client-tokens.mjs` reads `~/.config/omni/credentials.json`, keyed by the host of `ask.url`, each entry the token exchange's reply as the spec gives it (`{access_token, refresh_token, expires_at, email}`), and writes it back at mode 0600 after a refresh, keeping every other host. The client takes the store as a small port (`read(host)`, `write(host, tokens)`), so s3's module can replace it where the hooks are wired. With no entry for the host, the hooks make no call and stay silent.

## What it costs to change later

If s3 chooses another file layout, one of the two modules changes to match it; nothing is stored in a repository.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s3 will key the file by host alone or by host and account
- whether the hooks should also refresh ahead of `expires_at` rather than only on a 401
