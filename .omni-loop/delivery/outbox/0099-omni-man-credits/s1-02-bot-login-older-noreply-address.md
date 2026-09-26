---
id: s1-02-bot-login-older-noreply-address
prd: 99
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When the kit works out which GitHub account a signing address belongs to, should it also understand GitHub's older private addresses, which carry the account name but no number?

## The decision, in plain words

The kit reads the account name from both kinds of GitHub private address, the current one with a number and the older one with the name alone. Any other address belongs to no account.

## The intro, for fun

Some addresses were handed out before GitHub started numbering them.

## The punchline, for fun

Old addresses still get their mail, so they get a name too.

## The options, in plain words

A. Read the account name from both noreply shapes, the option built.
B. Read it only from the current shape, between the plus sign and the at sign, and treat an older address as no account.

## What I had to decide

What `botLogin` in `kit/lib/signature.mjs` returns for a noreply address with no numeric id. The spec (`omni credits`, What it reads) names the bot account as "the login in the email, between `+` and `@`", and its test seams say "the bot login read from a noreply address and `null` from any other". GitHub hands out two noreply shapes: `<id>+<login>@users.noreply.github.com` today, and `<login>@users.noreply.github.com` for accounts that set it before the id was added. The first sentence covers only the first shape; the second covers both.

## What I did meanwhile

`botLogin` matches `^(?:\d+\+)?([^\s@+]+)@users\.noreply\.github\.com$` (case-insensitive): `omni-loop-invader[bot]` from the default address, `octocat` from either shape, `null` for every other address. Tested in `kit/lib/signature.test.mjs` (the bot login block). Only `omni credits` (slices s3 and s4) will call it; nothing in this slice does.

## What it costs to change later

One regular expression and one test in `kit/lib/signature.mjs`. Dropping the older shape later only changes `omni credits` for a repository whose signature address is an older noreply one, which the default is not.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a signature address may be an older noreply address with no id, or what `omni credits` should do with one.
