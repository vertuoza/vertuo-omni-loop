---
name: help
description: Explains the Omni Loop and every one of its commands — the loop's six stages from idea to retro, its principles, the slash commands a person types in Claude, the commands a person types in the terminal and the ones only the skills run — or, given one name, that command or skill alone, with its usage, who runs it and what it does. Runs omni help, passing the name the person gave, and prints its output as is. Triggers on "what is the Omni Loop", "how does the loop work", "which commands are there", "what does /omni:yolo do", "explain omni board", "omni help", "/omni:help", "/omni:help yolo".
---

# Help: the loop and every command

`omni` below is `node .omni-loop/bin/omni.mjs`. This skill only runs `omni help` and prints what it
printed. It changes nothing and calls nothing on the network. The text is the kit's own, and it
names this repository's folders and default branch, so it is never answered from memory.

## Input

- **Nothing:** run the overview: the loop, its principles and every command, on one screen.
- **One name:** a command of the terminal (`board`), a skill (`yolo`) or a slash command
  (`/omni:yolo`). Pass it as the person gave it: `omni help` takes both forms. A name that is both
  a command and a skill (`plan`, `ask`, `status`, `help`) prints both entries, the command's first.
- **A question in words** ("what does the yolo do?"): pass the one name it asks about.
- **Several names:** run it once per name, in the order they were given, and print each output in
  a block of its own.

## Run

```bash
node .omni-loop/bin/omni.mjs help
```

or, with the name the person gave:

```bash
node .omni-loop/bin/omni.mjs help <name>
```

Add nothing else to either line.

| exit | what you do |
|---|---|
| `0` | Print its output as is, in a text block (below). Add nothing to it. |
| `2` | It printed one line on stderr. `omni help: no command "<name>"; …` means the name is neither a command nor a skill: print the line as is, then say that `/omni:help` with no name lists them all, and stop. Any other line: print it as is and stop. |
| anything else | The command failed. Print its first line as is and stop. With no `.omni-loop/bin/omni.mjs` in this repository, the kit is not installed here. |

## The text block

The columns line up only in a fixed-width font, so the output goes in a fenced block marked
`text`, never as Markdown:

```text
<what omni help printed, every line and every blank line exactly as it came>
```

Never reword, shorten, translate or reorder it, never turn its rows into a table or a list, and
never add a line inside the block. A long output stays whole.

## Never

- Never answer from memory in place of running it, and never add a command or a skill it did not
  print.
- Never run any other command the output names: this skill explains them, the person runs them.
