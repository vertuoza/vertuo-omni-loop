# Mock: draw a screen's mockup

The kit's own command, not imported. It draws the mockup of one screen of the library: one
self-contained HTML file beside the screen's file, the picture a lock is made against, the page the
word pass reads and the one `omni design gallery` shows. A mockup is HTML, never a screenshot: the
word pass and a lock read text, never pixels, and no image goes into git.

A person may type it, and a skill may follow it on a screen its work draws. Step 0 of the skill has
run: the flag is on (off, the one `design: off` line, and nothing is drawn), the design form is read
and the library is listed.

## What it is given

| input | example | what it draws |
|---|---|---|
| `mock <screen>` | `/omni:pixel-perfect mock quote-editor` | the mockup of the library screen of that name, as `omni design screens` lists it |

No name, typed by a person: list the library's screens with no mockup (`mock: null`), and ask
which, as one question through the session's question tool. Followed by a skill, the skill names it.

## Steps

1. **Find it.** The screen is the file `<screen>.md` in the folder
   `node .omni-loop/bin/omni.mjs config design.screens` prints. Not there: say so in one line and
   stop; a screen is drafted first (by `/omni:visual-fix`, `/omni:brainstorm`, `/omni:think-big`,
   `/omni:invade`, or by hand). `superseded`: say which screen replaced it, and stop.
2. **Read what it is drawn from.** The screen's file: its **Purpose**, **Regions**, **States**,
   **Words**, **Refusals** and **Open questions**. Its `implements`: the files it is drawn from,
   its layout, its styles and its words, read in full. Its `reads`: the code behind it (engines,
   data, rules), read for what the screen shows of it, its data shapes and its states. One rule
   splits the two lists, in four lines:
   - A file whose change can change what a person sees on this screen goes in `implements`, the
     data files that hold its words included.
   - A file the screen only depends on goes in `reads`.
   - Structure several pages share is a shared screen of its own (`kind: shared`); each page lists
     its files in `reads`.
   - A view file two pages share, and that is not structure, goes in `reads` on each.

   An entry on the wrong list is said in the report; `mock` never moves it. A shared screen (an app
   shell, notifications, a sign-in page, a dialog, a toast) is drawn on its own, as one marked
   screen; it names the pages it appears on in `routes` when it has none of its own. A page that
   shows one draws only its own part in detail. And the
   design form, `node .omni-loop/bin/omni.mjs kb show design`: its `product`, `system`,
   `deliberate` and `language` sections, which win over any habit of your own.
3. **Look at it, when the app runs.** Take a screenshot of the screen at its routes, as the design
   form's `review` section says (its widths, 390 and 1440 when it names none; how to sign in),
   through the session's browser tool. The screenshot is a reference for the drawing, kept in the
   session's scratch, never committed. When the app cannot run or be seen here, draw from the
   source, and say so in the report (**Standing in**, below).
4. **Draw it.** Write **one self-contained HTML file**, `<screen>.html`, beside `<screen>.md`:
   inline CSS and inline SVG, **no script**, no remote asset (no external stylesheet, font, image
   or `@import`), **no base64 raster image** (a `data:image/` URL that is not SVG). It draws the
   screen as the product builds it: its tokens, its components, its real words from `implements`,
   each region and the state the screen is mostly seen in. Nothing the screen's file and its code
   do not show is invented: what they leave open stays under the screen's **Open questions**. What
   a self-contained file cannot carry (the product's fonts, its images, its data) is stood in for
   as **Standing in** says, below.
   - **The marks.** The screen is one element with `data-screen="<screen>"`; each primary action
     inside it carries `data-primary`, the convention every mockup the kit's skills write uses. An
     explanation of the mockup, when it needs one, sits outside the marked screen: the word pass
     reads only marked screens.
5. **The word pass.** Run `node .omni-loop/bin/omni.mjs design words <screen>.html`; it exits 0
   whatever it finds. Fix each finding in the screen (a shorter label on the control, one primary
   action, a sentence that stands at rest cut or moved, an avoided word replaced) and run it again.
   The rule is fixed in the screen, never silenced: never drop a mark, unmark a primary action or
   reword the finding away. A finding that is what the product shows now is said in the report,
   never drawn away.
6. **Set `mock`.** In the screen's front matter, `mock: <screen>.html`. Nothing else in the file
   changes: its body, its `implements`, `reads`, `routes` and `supersedes` stay as they are. A draft
   with a mockup already is redrawn in place: a draft changes freely.
7. **Check it.** Run `node .omni-loop/bin/omni.mjs check design` and
   `node .omni-loop/bin/omni.mjs design screens`: a refusal that names this screen is fixed and
   checked again; a refusal of another file is not this command's: name it, and leave it.
8. **Commit,** typed by a person: the screen's file and its mockup, and nothing else, on the branch
   checked out, never on the default branch (`omni config repo.defaultBranch`), where it asks the
   person which branch to commit them on. The message is `design: mock <screen>`, then the co-author
   trailer your agent adds, if it adds one (in Claude: the `Co-Authored-By` line its session gives),
   then the line `node .omni-loop/bin/omni.mjs sign trailer` prints as its last line, no blank line
   between them (it prints nothing when signing is off: add nothing). It pushes nothing. Followed by
   a skill, the skill commits them with its own work.

## Standing in

What a self-contained mockup cannot carry is stood in for, never guessed at and never left out:

- **Fonts:** name the product's faces first in each `font-family`, with the fallbacks the product
  itself uses; never load a font.
- **Pixel art and images:** an inline SVG placeholder at the image's real size, labelled with what it
  stands for.
- **Example data:** allowed, and expected for a screen that shows data. Take it from the product's
  own demo data or fixtures when they exist, keep it realistic, put it inside `data-content`, and
  say outside the marked screen that the figures are examples.
- **No screenshot:** draw from the source and say so outside the mark, and in the report.
- **No gallery yet:** open the `.html` file directly.
- **An undecided primary action:** mark the one the screen's own words point to, say so outside the
  mark, and keep the question in the screen's **Open questions**.

## A locked screen

A locked screen's file and mockup are its owner's decision (**Locked decisions** in
[SKILL.md](SKILL.md)): `mock` **never overwrites** a locked screen's mockup and never edits its file.
It writes the new mockup as a **draft amendment** instead: a new draft screen `<screen>-next.md`,
with `status: draft`, its `mock` the new `<screen>-next.html` drawn by steps 2 to 5, its
`implements`, `reads` and `routes` copied from the locked screen, `supersedes: null`, its body
copied from the locked screen, and under its **Open questions** the locked screen it would change,
the change, and who locked it (its `locked-by` and `locked-on`). Then it raises the **high** outbox
item, as any change to a locked screen does ([reference/review.md](reference/review.md), **A change
to a locked screen or law**): followed by a skill on a slice, the calling skill records it, naming
the screen, the change and who locked it; typed by a person, the report names the owner to ask, and
`/omni:pixel-perfect lock <screen>`'s **Amend** as the way that owner takes the new mockup. A
locked screen with no mockup yet is drawn the same way: its new mockup is the draft amendment's.

## What it reports

Three lines: the mockup written (its path, or the draft amendment's), what it was drawn from (the
screenshot, or the source alone, and which section of the design form was a hole), and the word
pass (findings fixed, findings left and why). Then the commit, typed by a person, or the high item
to raise, on a locked screen.
