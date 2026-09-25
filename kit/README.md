# The Omni Loop kit

The `omni` CLI (`kit/bin/`, shipped bundled as `kit/dist/omni.mjs`, which `pnpm kit:build` rebuilds)
and the `omni` plugin for Claude Code (`kit/plugin/`: its skills and hooks). A repository installs
both to run the Omni Loop; everything specific to that repository is read from its
`.omni-loop/config.yml`.

**Ask mode** puts the questions Claude asks through `AskUserQuestion` on a web page: sign in once per
computer with `omni signin`, then `/omni:ask on` in a checkout prints the page's link, and
`/omni:ask off` turns it off. It needs `ask.url` in the config (`null` by default, which leaves it
off), and whenever the page cannot answer, the question shows in the terminal as usual.
