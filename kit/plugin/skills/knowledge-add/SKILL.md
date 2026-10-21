---
name: knowledge-add
description: Adds or edits one item of a product's knowledge from the terminal, one item at a time — a Statement or Never line (constituent), a Legal entry or a Glossary term. Turns what the person said into exactly one item, asks for every field they did not give and never fills one, shows the item whole and asks Yes / Change / Cancel, writes only on Yes with omni constituents or omni kb legal and glossary --json, prints the line and link, and only then takes the next item. Never writes under OMNI_UNATTENDED, never removes or retires. Triggers on "add a legal entry", "add a never line", "add a glossary term", "change the statement", "edit L-GDPR-5", "/omni:knowledge-add".
---

# Knowledge add: one item, shown whole, written on Yes

`omni` below is `node .omni-loop/bin/omni.mjs`. A product's Knowledge tab holds its Constituents (a
Statement and its Never lines), its Legal entries and its Glossary terms. This skill adds or edits
**one** of them per Yes, from the terminal, with the commands that exist for it. The rules are the
page's: the commands apply or propose as the section's owner decides, and this skill never decides
that.

Run `omni session start` first, and read its briefing.

## Never

- **Never write under `OMNI_UNATTENDED`.** When it is set, there is nobody to say Yes: write nothing,
  say so in one line, and stop.
- Never write before a Yes for that item. Never write two items from one Yes.
- Never fill in a field the person did not give: a Legal entry's source law, a term's meaning, a
  statement's text. Ask for it.
- Never edit an item the person did not name, and never remove or retire anything: those stay on the
  Knowledge tab.

## 1. One item

Turn what the person said into **exactly one** item: its kind, whether it is an add or an edit, and
its fields.

| kind | add | edit |
|---|---|---|
| Statement | `omni constituents add --statement "<text>" --json` | `omni constituents edit statement --text "<text>" --json` |
| Never line | `omni constituents add --never "<text>" --json` | `omni constituents edit never#<n> --text "<text>" --json` |
| Legal entry | `omni kb legal add --code <CODE> --statement "<text>" --source "<law>" --json` | `omni kb legal edit L-<CODE>-<n> [--statement "<text>"] [--source "<law>"] --json` |
| Glossary term | `omni kb glossary add --term "<term>" --meaning "<text>" [--avoid <a,b>] --json` | `omni kb glossary edit "<term>" [--meaning "<text>"] [--avoid <a,b>] --json` |

Add `--product <name>` only when the repository is in more than one product and the person named one.
A Statement is one line of at most 400 characters.

Said more than one thing ("add these three")? Keep the list, take the first item through steps 2 to 4,
and the next only after the last one's line printed (step 5).

## 2. Ask for what is missing

A field the person did not give is asked for, in one plain question, and never filled in by you: a
Legal entry's code, statement and source law; a Glossary term's term and meaning; the text of a
Statement or a Never line; for an edit, the item's id and at least one field to change. **Avoid
words** are left empty unless the person names them. To read an item's current id or text before an
edit, run `omni constituents`, `omni kb legal` or `omni kb glossary`: the reads print them.

## 3. Show it whole, ask Yes / Change / Cancel

Show the item whole: its kind, whether it adds or edits, the id it will get or edits (an add's id is
shown as given by the product once saved, a Legal entry's as `L-<CODE>-<next number>` only when the
read shows it), and every field with the exact words that will be written. Then ask **Yes / Change /
Cancel**, with the tool your agent has for asking.

| answer | you do |
|---|---|
| **Yes** | step 4 |
| **Change** | take what they change, ask for any field it leaves open, show the item whole again, ask again |
| **Cancel** | write nothing for this item; take the next one if there is one |

## 4. Write it, only on Yes

Run the one command of the table with `--json`, with the person's words quoted exactly as shown. Then
print what it said:

- exit `0`, `done: applied`: `added <id> · <url>` or `edited <id> · <url>`;
- exit `0`, `done: proposed`: `proposed · waits for @<owner> · <url>` (a member who is not the
  section's owner or delegate proposes: say that it waits for the owner);
- exit `1`: print the one line as is (a refusal in the database's own words, signed out
  (`omni signin`: the person runs it), unreachable). Do not retry in another way;
- exit `2`: the usage was wrong: fix the command from its usage line and ask again before running it.

## 5. The next item

Only after the line of step 4 printed does the next item start, from step 1. One Yes writes one item.
