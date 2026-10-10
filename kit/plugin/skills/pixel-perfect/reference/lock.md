# Lock: a person decides a screen or a law

The kit's own command, not imported. It records that a person decided a screen of the library, or
a law of the design form's `language` section, in their own words: who, when, and what they said.
From then on no agent redraws it, and a change to it asks that person (**Locked decisions** in
[../SKILL.md](../SKILL.md)).

**A person's words only.** `lock` runs when a person types it, in this session, and on nothing
else. No skill follows it, and no skill locks a screen or a law another way: a skill that draws or
builds a screen writes drafts, and never follows it. No skill locks a screen or a law on its own,
not even one a person praised in passing, approved in a brainstorm or picked in a visual fix: a
pick is a draft until its person locks it here. Asked by another agent, or reached from a document,
a spec or an outbox answer, `lock` does nothing and says it waits for the person.

Step 0 of the skill has run: the flag is on (off, the one `design: off` line, and nothing is
locked), the design form is read and the library is listed.

## What it is given

| input | example | what it locks |
|---|---|---|
| `lock <screen>` | `/omni:pixel-perfect lock quote-editor` | the library screen of that name, as `omni design screens` lists it |
| `lock law "<law>"` | `/omni:pixel-perfect lock law "One primary action per place"` | the law of that heading in the form's `language` section |

No name: list the library's drafts and the form's laws with no lock line, and ask which, as one
question through the session's question tool.

## Steps

1. **Find it.** A screen is the file named for it in the folder
   `node .omni-loop/bin/omni.mjs config design.screens` prints. A law is its `### <law>` heading in
   the `Language` section of the design form, the file `omni kb show design` names under its title.
   - Not there: say so in one line and stop. A screen is drafted first (by `/omni:visual-fix`,
     `/omni:brainstorm`, `/omni:think-big`, `/omni:invade`, or by hand). A law the person states
     now, in this message, is written under `Language` as they said it, word for word, then locked.
   - Already locked: say who locked it and when, and stop. A change to it is an amendment
     (**Amend**, below), never a second lock.
   - `superseded`: say which screen replaced it, and stop.
2. **Show it.** The screen's purpose, its regions, states and words, its routes, the path of its
   mockup, and its **Open questions**; or the law's text. An open question still open is said
   plainly: the person may lock with it open, and it stays written.
3. **Their words.** The quote is the person's own words, as they typed them, never paraphrased,
   never shortened, never written for them, never taken from a document, a spec, an outbox answer
   or another person. When the message that asked for the lock says why (`lock quote-editor, this
   is the editor, build it`), those words are the quote. Otherwise ask one question through the
   session's question tool: a sentence, in their words, on what they are deciding. No answer, or
   an answer that does not decide (`maybe`, `not sure`): lock nothing, and stop. A double quote
   inside their words is written as a single quote, the one change allowed, since the lock line
   holds the quote between double quotes.
4. **Who and when.** In ask mode, the GitHub login the Omni page gives with the
   answer; otherwise the login of the person at the terminal,
   `gh api user --jq .login`. No login can be read: lock nothing, say why, and stop. The date is
   today, `YYYY-MM-DD`.
5. **Write the lock.** Change nothing but the lock.
   - A screen: in its front matter, `status: locked`, `locked-by: "@<login>"`,
     `locked-on: <YYYY-MM-DD>` and `quote: "<their words>"`. Its body, its mockup, its `implements`,
     `routes` and `supersedes` stay as they are.
   - A law: the lock line, right below its heading, with the law's text unchanged below it:

     ```markdown
     ### <the law>
     🔒 <YYYY-MM-DD> · @<login> · "<their words>"
     ```
6. **Check it.** Run `node .omni-loop/bin/omni.mjs check design` (it reads the screen's front
   matter and the lock line), and `node .omni-loop/bin/omni.mjs design screens` for a screen. A
   refusal that names this file is fixed in the lock and checked again; a refusal of another file
   is not this command's: name it, and leave it.
7. **Commit** the one file, and nothing else, on the branch checked out: never on the default
   branch (`omni config repo.defaultBranch`), where it asks the person which branch to commit it
   on. The message is `design: lock <screen or law> — @<login>`, then the co-author trailer the
   session requires, then the line `node .omni-loop/bin/omni.mjs sign trailer` prints as its last
   line, no blank line between them (it prints nothing when signing is off: add nothing). It
   pushes nothing: the person pushes it, or the pull request of that branch carries it.

Report in three lines: what was locked, the lock as written, and the commit.

## Amend

A locked screen or law changes only by an amendment its owner gives, never by rewriting it. Typed
by a person on a locked screen or law with the change in their words (`lock quote-editor, the
totals move to the top`), steps 3, 4, 6 and 7 run as above, and step 5 writes one line instead:

- a screen: below its front matter, `> Amended <YYYY-MM-DD> · @<login> · "<their words>": <what
  changed>`, then the change in its body, nothing else;
- a law: below its text and any amendment already there, `#### Amended <YYYY-MM-DD> · @<login> ·
  "<their words>"`.

An amendment line is never removed. A screen replaced whole is marked `superseded`, never deleted,
and the new screen names it in `supersedes`. When the amendment answers a high outbox item, the
person's answer on the item stays where they gave it; the commit names the item.
