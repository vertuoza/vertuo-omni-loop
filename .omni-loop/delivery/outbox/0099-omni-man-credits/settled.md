# Settled outbox items — PRD 99

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-signature-name-address-shape -->

## s1-01-signature-name-address-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-signature-name-address-shape
prd: 99
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When a repository renames who signs the loop's work, should the kit accept any name and address, or refuse one that would break the signature line?

## The decision, in plain words

The kit refuses a name or an address that holds a line break or an angle bracket, and says which one, because either would break the line that credits the signer. Anything else is accepted, and the footer is free text.

## The intro, for fun

A signature is a small thing until someone puts a line break in it.

## The punchline, for fun

Angle brackets belong around the address, not inside the name.

## The options, in plain words

A. Refuse a name or address holding a line break or an angle bracket, and accept anything else, the option built.
B. Accept any non-empty name and address, and let a broken signature line go out as written.
C. Also require the address to look like an e-mail address, refusing more configs.

## What I had to decide

How strict the `signature` config section is about `name` and `email`. The spec (The signature) says an unknown key under `signature` is refused, as everywhere in the config, and that `omni sign trailer` prints `Co-authored-by: <name> <email>`; it says nothing about what a name or an address may hold. A name like `Omni <Man>` or an address with a newline would make `omni sign trailer` print a line no git or GitHub reader takes for a co-author, and `omni phase0` would then look for that broken line.

## What I did meanwhile

`kit/lib/config.mjs`: `signature.name` and `signature.email` must be non-empty, one line, with no `<` or `>` (`trailerPart`); a violation is a config error naming `signature.name` or `signature.email`, like any other bad key. `signature.footer` only has to be non-empty. Tested in `kit/lib/config.test.mjs` (the signature section block).

## What it costs to change later

One regular expression in `kit/lib/config.mjs` and one test. Loosening it later breaks no config that parses today; tightening it further (say, a real e-mail shape) could refuse a config a repository already wrote.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a repository may sign with a name or an address that is not a valid co-author line, or whether the kit should check the address is an e-mail at all.

```

<!-- /omni-outbox-settled: s1-01-signature-name-address-shape -->

<!-- omni-outbox-settled: s1-02-bot-login-older-noreply-address -->

## s1-02-bot-login-older-noreply-address — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s1-02-bot-login-older-noreply-address -->
