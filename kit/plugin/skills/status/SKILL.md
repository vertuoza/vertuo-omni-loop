---
name: status
description: Prints this session's status in plain words — one block with the verdict (on track, waiting for you, or stuck), the work and its step, what the person must do, what comes next and the links. Runs omni now --status --fetch, prints its output as is, and adds one Right now sentence only when this session is the one doing the work. Changes nothing. For the overview of every PRD, use /omni:dashboard. Triggers on "status", "where are we", "what are you doing", "/omni:status".
---

# Status: where this session's work stands

`omni` below is `node .omni-loop/bin/omni.mjs`. This skill runs `omni now --status --fetch`, prints
the block it printed, and adds one plain sentence. It changes nothing: never a pull request, a label
or an approval (BR-PRODUCT-3, BR-PRODUCT-5, N-PRODUCT-15). Every word of the block comes from the
kit; the facts win on the step, the verdict, **You** and the links.

## Run

```bash
node .omni-loop/bin/omni.mjs now --status --fetch
```

Add nothing else to the line.

| exit | what you do |
|---|---|
| `0` | Print its output as is, in a text block (below). A session on nothing prints `Nothing is running in this terminal.` and `/omni:dashboard shows all your work.`: print them as is, add no Right now line. Outside the loop it prints nothing: say in one line that nothing is running in this terminal. |
| anything else | The command failed. Print its first line as is and stop. With no `.omni-loop/bin/omni.mjs` in this repository, the kit is not installed here. |

## The text block

The step line and the links line up only in a fixed-width font, so the output goes in a fenced block
marked `text`, never as Markdown:

```text
<what omni now --status --fetch printed, every line and every blank line exactly as it came>
```

Never reword, shorten, translate or reorder it, and never turn it into a table or a list.

## The Right now line

Only when this session is the one doing the work and knows what it is doing at this moment, add one
line inside the block, directly under the step line (the line of `✓`, `▶` and `○` marks):

```text
Right now: I'm waiting for the last check to finish.
```

One sentence, in plain words, in your own name as the agent ("I'm …"), never in a person's name
(L-AIACT-1), and never contradicting the block: on the step, the verdict, **You** and the links, the
facts win. After a fresh session, or when you do not know what you are doing now, leave the line out: the
facts answer alone. A stop the facts cannot see (a bug you cannot reproduce, a fix that needs a
product decision) is said here, in that one sentence.

## Never

- Never give the command another flag, and never run the repository's overview or the outbox gate
  with it: the overview is `/omni:dashboard`'s and the gate is the shipping skills'.
- Never change a file, a branch, a pull request, a label or an approval to make the block read
  differently, and never merge: **You** names the person as the one who merges.
