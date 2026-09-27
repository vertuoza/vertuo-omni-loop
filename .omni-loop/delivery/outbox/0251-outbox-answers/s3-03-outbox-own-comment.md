---
id: s3-03-outbox-own-comment
prd: 251
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

How does the GitHub helper tell its own comments apart, so rewriting its question list does not start another check forever?

## The decision, in plain words

It skips a comment written by its own robot account, and still checks again on a person's comment, even one sent from the Omni page with its help.

## The intro, for fun

A helper that answers its own echo never gets any rest.

## The punchline, for fun

So it learned its own name, and nothing else.

## The options, in plain words

A. Recognise its own robot account by name (as built).
B. Recognise it by the App's numeric id, set as a setting on the deployment.
C. Check again on every comment, its own included, and rely on the delay to absorb the echo.

## What I had to decide

The spec says a comment the App wrote itself does nothing. A reply sent from the Omni page is posted as the person but is marked as made with the App, so the App's involvement alone cannot be the test.

## What I did meanwhile

The webhook ignores an issue_comment whose author login is `omni-loop[bot]`, the registered name plus GitHub's bot suffix; a test ties that login to `app.yml`'s name. A person's comment made with the App is still checked.

## What it costs to change later

One constant. If the App is registered under another name, the constant and the manifest change together; the test fails until they agree.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the App is registered in production under the name omni-loop, which the manifest says but I cannot see.
