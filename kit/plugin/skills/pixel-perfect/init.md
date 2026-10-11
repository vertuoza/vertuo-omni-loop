# Init: write the repository's DESIGN.md

The kit's own command, not imported. It writes the repository's design system as one file,
`DESIGN.md` in [Google's DESIGN.md format](https://github.com/google-labs-code/design.md): the tokens,
a closed list of parts every screen is built from, and the reference screens a builder copies. Every
drawing and building skill reads that file, and `omni design parts` lists it.

Typed by a person, never followed by a skill: once per repository, and again after the system
moves. Step 0 of the skill has run: the flag is on (off, the one line
`design: off — set design.enabled: true in .omni-loop/config.yml to turn design craft on`, and
nothing is read and nothing is written), the design form is read and the library is listed.

## Steps

1. **Where it goes.** Run `node .omni-loop/bin/omni.mjs config design.system`: the path of the
   file, `DESIGN.md` at the repository's root unless the repository names another. Run
   `node .omni-loop/bin/omni.mjs design parts`: it prints `parts: no <path> (run /omni:pixel-perfect init)`
   when there is none yet, or the parts a file already there lists, and every line of it that does
   not read.
2. **Which path.** Look for a design system the repository already has: token or theme files, CSS
   custom properties, a Tailwind or theme config, a component folder, stories, a shadcn
   `components.json`, a Figma link in a page. Found one: follow **Reading**. Found none: follow
   **Starters**. A repository with some of both (tokens and no components, say) reads what it has
   and asks the rest as questions; it never mixes a starter into a system that exists.
3. **Write** the file as **DESIGN.md** says, its reference screens as **Reference screens** says,
   and the form's pointer as **The design form** says.
4. **Check and open** it as **The pull request** says.

## Reading

A repository with a design system: read its tokens, theme files, component folders, Storybook, a
shadcn `components.json` and any Figma links into DESIGN.md, and each entry names the file it was
read from (`Code` on a part, a source line under a token group). What the files do not say (a
component's states, its accessibility, when not to use it) is a `TODO(human)` question, never
invented, written where the answer goes. A link to an existing tool (a Figma library, a Storybook
site) is linked, never copied: DESIGN.md names it, and the tool stays the source of what it holds.

Only what the repository holds counts: never a habit of your own, never a craft-floor rule written
in as the product's. A part is what the code has as a component; a component that exists only on a
screen is an open question, never a part made up to fill the list.

## Starters

A repository with none. Every screen would otherwise start from the model's defaults, which is the
generic look itself: the person picks a direction once, and every screen after it follows.

1. **Ask about the product,** one question at a time through the session's question tool: who uses
   it, on what screens and under what light, its voice, and one product it admires. What the design
   form's `product` section already says is not asked again.
2. **The page.** Draw **two or three starter directions** as **one self-contained HTML page**, written to the
   session's scratchpad directory, never the repository yet: inline CSS and inline SVG, no script,
   no remote asset, no base64 raster image. Each direction is a full set: about thirty semantic
   tokens, in light and dark; eight to twelve components with every state (default, hover,
   focus-visible, active, disabled, and loading, error and empty where it shows data); and two or
   three reference screens built only from them. Each direction is a real direction, not a shade of
   the same one, and each draws from the product's answers, never from the category's habit. Mark
   each reference screen with `data-screen`, each primary action with `data-primary` and each part
   with `data-part="<name>"`; the page's own explanation sits outside every marked screen.
3. **Check each direction** against the craft floor ([reference/craft-floor.md](reference/craft-floor.md)),
   its refuse list above all, before the page is shown: a direction that reaches for one of its
   defaults (gradient text, a card grid as the page, glass as decoration…) without the product's
   answers asking for it is redrawn. Then run `node .omni-loop/bin/omni.mjs design words <page>`
   and fix each finding in the screen it names, never silenced.
4. **Ask which one,** as one question through the session's question tool, the directions as its
   options; the person may answer "another round", with a note, as `/omni:visual-fix` does. Another
   round writes a new page beside the old one, under the same rules. The skill never picks for the
   person. Note who picked and the day.

## DESIGN.md

Written at the path `design.system` names, in the format's order. Its YAML front matter holds the
token groups `colors`, `typography`, `rounded`, `spacing` and `components`. Then its prose sections:
Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts, and
omni-loop's own section after them, Reference screens.

- **Semantic tokens only** reach a screen: `colors.primary`, never a hex value. Primitives exist for
  semantic tokens to point at, as `{colors.blue-600}`.
- **Components, a closed list.** Each part is one `###` entry under Components, with the lines
  `Summary` (one line), `Variants`, `States`, `Tokens` (the tokens it binds), `Accessibility`, `Do`
  and `Don't`, and `Code` (the paths of its implementation; none yet after a starter, and it says
  so). A part not on the list is proposed later, by an outbox item, never invented.
- **Parts are not screens.** A part is a component a screen is built from (a button, a table, a
  badge). Structure several pages share (an app shell, notifications, a sign-in page) is a shared
  screen of the library (`kind: shared`), never a part.
- **Reference screens:** two or three library screens a builder copies, each one line on what it
  shows (a list with its empty, loading and error states; a form; a detail or a dashboard). A shared
  screen may be one: the shell every page is built inside.

A DESIGN.md already there in another shape is kept: `init` proposes the missing sections, each a
`TODO(human)` question or a reading naming its file, and rewrites nothing a person wrote. Run again
after the system moved, it proposes the fixes `omni check design` warns about, the same way.

Then run `node .omni-loop/bin/omni.mjs design parts` again: every part lists, and a line that does
not read is fixed. When `npx @google/design.md lint` is already among the repository's
dependencies, run it too; never install it.

## Reference screens

Each reference screen is a **draft** screen of the library, in the folder
`node .omni-loop/bin/omni.mjs config design.screens` prints: `<name>.md`, `<name>` its short
kebab-case name, with `status: draft`, its `kind`, `implements` and `reads` (both empty after a
starter, since nothing is built yet), its `routes` when the product has them, `supersedes: null`,
and the body every library screen has (**Purpose**, **Regions**, **States**, **Words**,
**Refusals**, **Open questions**, **Source**). **Source** names this run in one line:
`/omni:pixel-perfect init, <read from the repository | starter <letter> picked by @<login>> on <YYYY-MM-DD>`.
A screen the library already holds is named, never redrawn. Its mockup is drawn by `mock`
([mock.md](mock.md)), steps 2 to 7, from DESIGN.md's parts and tokens: after a starter, the picked
direction's screen is what it draws. One rule splits the two lists, in four lines:

- A file whose change can change what a person sees on this screen goes in `implements`, the data
  files that hold its words included.
- A file the screen only depends on goes in `reads`.
- Structure several pages share is a shared screen of its own (`kind: shared`); each page lists its
  files in `reads`.
- A view file two pages share, and that is not structure, goes in `reads` on each.

Every screen it writes is a draft: only a person locks, through `/omni:pixel-perfect lock`.

## The design form

The form's System slot becomes the one line `See: <design.system>` (`See: DESIGN.md` unless the
repository names another path), in place of the slot's `TODO(human)` question or of what invade
wrote there. A System slot a person wrote (its marker says ` · by: human`) is never replaced: the
`See:` line is proposed in the pull request's body instead. The Product, Deliberate, Review and Language slots stay as they are: the
product still wins over the craft floor.

## The pull request

1. **The branch.** Cut a worktree on `branches.knowledge`, with `{topic}` = `design-system`, from the
   default branch (`omni config repo.defaultBranch`). Every step writes there.
2. **Check.** Run `node .omni-loop/bin/omni.mjs check design`, `node .omni-loop/bin/omni.mjs design screens`
   and `node .omni-loop/bin/omni.mjs check kb` until none names a file of this run.
3. **Commit** DESIGN.md, the draft screens and their mockups, and the design form, as
   `docs(design): the design system in DESIGN.md`, then the co-author trailer the session requires,
   then the line `node .omni-loop/bin/omni.mjs sign trailer` prints as its last line, no blank line
   between them (it prints nothing when signing is off: add nothing). Push.
4. **Open** one docs-only pull request into the default branch through `/omni:pr`, as a standalone
   PR. Its body says which path ran (read, or the starter picked, by whom and when), lists each
   `TODO(human)` question as a checkbox and each draft screen for its owner to read, change or lock,
   says that turning the tokens into CSS or a theme is the first ordinary slice after it
   (DESIGN.md's `export` writes that file), and ends with the line
   `node .omni-loop/bin/omni.mjs sign footer` prints, as a paragraph of its own above the session's
   attribution lines. A person merges it; never merge it yourself.

## Never

- Never locks a screen or a law, and never writes a lock line: every reference screen is a draft.
- Never writes code: no CSS, no theme file, no component. Turning the tokens into code is the first
  ordinary slice after it, through `/omni:brainstorm`.
- Writes only DESIGN.md, the screen library and the design form: nothing else enters its pull
  request.
- Never invents what the files do not say on the reading path, and never picks a starter for the
  person.

## What it reports

The pull request's link, which path ran, the parts and reference screens written, the questions
left as `TODO(human)`, the starter picked (by whom, when), and each check run with its result.
