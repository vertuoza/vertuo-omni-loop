---
id: s1-02-public-report-scrubs-wide-and-strict-record
prd: 2980
slice: s1
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

How much should the public bug report cut from an error message, and how strict should the App be with a repair's record before it trusts it?

## The decision, in plain words

The report cuts wide: every path, file name, repository name, login, email, link, commit hash and any name of the workspace the App knows, keeps the command without its arguments and at most 300 characters; a record that contradicts its own retro is read as unreadable.

## The intro, for fun

A bug report going public is like a postcard: anyone at the sorting office can read it.

## The punchline, for fun

So we write the weather and leave the home address off.

## The options, in plain words

A. Scrub wide, keep the command alone, cut at 300 characters, and read a self-contradicting record as unreadable (built).
B. Scrub only the spec's list (paths, repository names, logins, emails, URLs, tokens), keep the command's arguments, and read any well-formed record.
C. Scrub wide but read a self-contradicting record by trusting its retro over its other fields.

## What I had to decide

What scrub() removes beyond the spec's list, which fields it reduces, and which inconsistencies make repairLine() read a record as unreadable.

## What I did meanwhile

scrub() also takes the names the caller knows the workspace by (owner, repositories, logins) and removes them wherever they stand; it removes bare file names with a code extension, commit hashes and ids; it keeps only the leading skill or omni command (/omni:yolo, omni runner work), never its arguments; and it cuts the message at 300 characters. It refuses on any leftover path, email, URL, login or token-shaped string. repairLine() reads as unreadable a record whose class or fingerprint differs from its retro's, a fix on a class other than code, or a report on a class other than omni-loop or whose message is not clean.

## What it costs to change later

Constants and patterns in kit/lib/repair/sensitive.ts and scrub.ts, and four refinements in line.ts: each loosens with a one-line change and no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Over-scrubbing loses words a maintainer would want, such as Node.js read as a file name; nothing in the spec weighs a useful report against a safe one, so it leans safe.
- (author) An unreadable record spends one repair (spec section 4), so a strict reader charges the runner's mistakes to the cause's budget.
