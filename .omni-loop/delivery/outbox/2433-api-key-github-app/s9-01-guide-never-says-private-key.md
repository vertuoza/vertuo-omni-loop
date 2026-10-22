---
id: s9-01-guide-never-says-private-key
prd: 2433
slice: s9
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

The guide may not use the word private on any page, but the attach form says Private key file and one of its refusals says private key. Should the guide quote the form's own words?

## The decision, in plain words

Not yet: the guide says the app's key and the key file, and describes the two refusals in its own words. The rule against the word is left as it stands.

## The intro, for fun

The guide has a rule against one small word, and the attach form is full of it.

## The punchline, for fun

So the guide says key file and keeps its rule.

## The options, in plain words

A. A. Keep the test as it is, and let the guide say the app's key and the key file, describing the two refusals in its own words.
B. B. Narrow the test to what it was written for, then quote the form's labels and both refusals word for word in the guide.
C. C. Add the guide's two pages to an exception list in the test, which lets the word in on those pages only.

## What I had to decide

The slice's own words for the guide are not in the spec, but a test of the docs pages (written for PRD 459, to keep the guide from asking for read access to a private repository) fails on the word private anywhere in a guide page. The attach form's label reads Private key file, one refusal reads GitHub refused this App ID and private key, and GitHub's own button says Generate a private key. I had to choose between quoting them and keeping that test as it is. Weakening a test to make a page pass would make a green check mean less, so the guide does not quote them.

Decided by: Jev (hardToRevert 0.62) · agent said false

## What I did meanwhile

Wrote the guide's new section and the Runners page without the word private: the key is called the app's key or the key file, the form's two refusals are described and not quoted, and GitHub's key button is described as generating a key for the app. The docs tests pass as they are.

## What it costs to change later

Small. If the test is narrowed to what it was written for (a private repository), the guide gets the form's exact words back in two sentences of the API page, with no other change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the test was meant to ban the phrase private key, or only a private repository (author)
