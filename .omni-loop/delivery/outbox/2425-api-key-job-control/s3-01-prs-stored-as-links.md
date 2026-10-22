---
id: s3-01-prs-stored-as-links
prd: 2425
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

A bug fix can open several pull requests. Should the server keep each one as its link alone, or as its link with the repository and the number written beside it?

## The decision, in plain words

The server keeps each pull request as its link alone. The repository and the number are read out of the link whenever a key asks for the job, so there is one fact stored and nothing that can disagree with it.

## The intro, for fun

A pull request already carries its repository and its number in its address.

## The punchline, for fun

Storing them twice would only give them a chance to argue.

## The options, in plain words

A. Keep the links alone and read the repository and the number out of each link.
B. Store each pull request as a link, a repository and a number: three facts to keep in step, and a backfill of every stored list.

## What I had to decide

The plan says a key reads each pull request as a link, a repository and a number, and the migration says only that the job keeps a list of at most 50 of them; neither says what one entry of the list is. The runner reports links, so I store the links as reported, in order, and the API derives the repository (in lower case, as a key's list of repositories is written) and the number from each link when it reads the job. A link that is no pull request link, which the report's check never lets in, is left out of the read instead of failing it.

## What I did meanwhile

Stored the links exactly as the runner reported them, and built the key's read to name each one by its link, its repository and its number.

## What it costs to change later

Changing it later means storing the repository and the number too: one backfill of the stored lists, read once from their links, and the one place that reads them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a key would also want each pull request's title or state beside its link: the plan lists none, so none is read.
