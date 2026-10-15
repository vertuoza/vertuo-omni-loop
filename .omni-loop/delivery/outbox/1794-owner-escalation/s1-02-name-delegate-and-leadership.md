---
id: s1-02-name-delegate-and-leadership
prd: 1794
slice: s1
rank: human-action
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

Who stands in for @pierrederval when he does not answer about a law or an open question, and who is product leadership for this repository?

## The decision, in plain words

Nobody is named yet: the setting can now hold a stand-in and a leadership list, but only @pierrederval can say who they are, so this repository's settings were left as they are.

## The intro, for fun

Even the keeper of the laws takes a holiday now and then.

## The punchline, for fun

Until someone is named, the pull request just waits by the door.

## What a person must do

1. Choose one person who may approve a change to a law in your place, and the people who are product leadership.
2. In a pull request of your own, write laws.owners in .omni-loop/config.yml as `- login: pierrederval` with `delegate: <their login>`, and laws.leadership as `[<login>, ...]`.
3. Run `node .omni-loop/bin/omni.mjs kb owners` and commit the CODEOWNERS change with it.
4. Answer this item on the feature PR once that pull request is open.

## What I had to decide

@pierrederval names one delegate (a person's GitHub login) and the product leadership logins, then opens a pull request that adds them to laws.owners and laws.leadership in .omni-loop/config.yml and runs omni kb owners.

## What I did meanwhile

The repository behaves exactly as before: with no delegate and no leadership, nobody more is ever asked, and a law change still waits on @pierrederval alone.

## What it costs to change later

One small pull request: two lines of config and the CODEOWNERS block omni kb owners rewrites.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Who the delegate and the leaders are is @pierrederval's to say (author).
