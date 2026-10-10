// What `omni help` says (PRD 315): the loop's seven stages (PRD 587), its principles, then one entry per `omni`
// command and per plugin skill. Pure data, written by hand for people (a skill's own description is
// written for Claude's trigger matching), and held to the command table and the skill folders by
// `entries.test.mjs`. `render.mjs` lays it out.
//
// An entry: `name`; `kind`, `command` or `skill`; `who` runs it, `you` or `skills`; its `usage`, one
// line per element; a one-line `summary`; a `detail` of a few sentences. One run by you shows as a
// row of the overview: a skill under IN CLAUDE, as its `label`; a command under IN THE TERMINAL, as
// its `label` when it has one, else on the closing line with the others that have none. `also` adds
// rows under a command's own. Those run by the skills are named on one line, commands then skills.
//
// A skill entry also carries what the docs' skills pages and `omni help <skill>` show (PRD 580): its
// `group`, one of SKILL_GROUPS; a one-line `when`, starting "Use it when"; and an `example`, one line
// a person types (`type`) and one line of what they get back (`result`). A command carries none.
//
// Words in braces are the repository's, filled from its config by the renderer, never spelled here:
// {delivery}, {inbox} and {shipped} (folders), {remote} and {defaultBranch}.

/** A stage of the loop: its name, one line, and the folder that holds it, when one does. */
export type HelpStage = { readonly name: string; readonly line: string; readonly folder?: string };

/** A group of skills, by what you want to do. */
export type SkillGroup = { readonly id: string; readonly title: string };

/** A command or a skill, as `omni help` and the docs' skills pages show it. */
export type HelpEntry = {
  readonly name: string;
  readonly kind: 'command' | 'skill';
  readonly who: 'you' | 'skills';
  readonly usage: readonly string[];
  readonly summary: string;
  readonly detail: string;
  readonly label?: string;
  readonly also?: readonly (readonly [string, string])[];
  readonly group?: string;
  readonly when?: string;
  readonly example?: { readonly type: string; readonly result: string };
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** The loop, stage by stage: a name, one line, and the folder that holds it, when one does. The
 * names are the kit's stage words (`STAGE_WORDS` in `kit/lib/status/format.ts`), in its order. */
export const STAGES: readonly HelpStage[] = deepFreeze([
  { name: 'idea', line: 'talked through with /omni:brainstorm, or /omni:think-big if vast' },
  { name: 'PRD', line: 'spec, plan and before/after, in a phase-0 PR a person reviews' },
  { name: 'inbox', line: 'phase-0 PR merged: approved, ready to build', folder: '{inbox}' },
  { name: 'building', line: 'first sub-PR merged into the feature branch: built in waves' },
  { name: 'outbox', line: 'feature PR ready: the change and its outbox wait for you' },
  { name: 'shipped', line: 'feature PR merged: the change is on {defaultBranch}', folder: '{shipped}' },
  { name: 'retro', line: 'a retro PR tells how it went; a knowledge PR keeps what it taught' },
]);

export const PRINCIPLES: readonly string[] = deepFreeze([
  'The folder is the status.',
  'Only a person merges into {defaultBranch}.',
  'Every decision an agent takes alone becomes an outbox item that you answer or adopt.',
]);

/** The skills grouped by what you want to do (PRD 580), in the order the docs show them. */
export const SKILL_GROUPS: readonly SkillGroup[] = deepFreeze([
  { id: 'start', title: 'Start a change' },
  { id: 'build', title: 'Build it' },
  { id: 'setup', title: 'Set up a repository' },
  { id: 'multi-repo', title: 'Several repositories' },
  { id: 'everyday', title: 'Every day' },
  { id: 'run-by-skills', title: 'Run by other skills' },
]);

export const ENTRIES: readonly HelpEntry[] = deepFreeze<readonly HelpEntry[]>([
  // Commands you type in the terminal. Their order is the overview's.
  {
    name: 'status',
    kind: 'command',
    who: 'you',
    usage: ['omni status [--fetch]', 'omni status <prd> [--labels a,b] [--base <ref> | --changes]'],
    label: 'omni status',
    summary: 'your PRDs, the inbox, the outbox, what has shipped',
    also: [['omni status <n>', 'the outbox gate for PRD n (exit 0 green, 1 red)']],
    detail:
      'With no PRD number, the overview of this repository, read from git only: how many PRDs sit ' +
      'at each stage of the loop (PRD, inbox, building, outbox, shipped, retro; an idea is a draft ' +
      'on the Omni app), a bar of ' +
      'delivered against in progress, and the PRDs that are yours, each with where it stands. It ' +
      'reads {remote}/{defaultBranch} as last fetched; --fetch fetches it first. With a PRD number, ' +
      'the outbox gate the loop runs before a feature PR merges: exit 0 when its outbox lets it ' +
      'through, 1 while an item is open, a drift is not reworked or a risky change is not accounted for.',
  },
  {
    name: 'prd',
    kind: 'command',
    who: 'you',
    usage: ['omni prd <n>'],
    label: 'omni prd <n>',
    summary: 'where PRD n lives and its files',
    detail:
      'Where PRD n lives today: its state, inbox or shipped, its folder, the files in it, its ' +
      'outbox folder and the open items waiting there. The folder is the status, so this is the ' +
      'one lookup the skills run before following any delivery path. Exit 1 when the PRD is in ' +
      'neither {inbox} nor {shipped}.',
  },
  {
    name: 'board',
    kind: 'command',
    who: 'you',
    usage: ['omni board <prd> [--json] [--repo <owner/name>]'],
    label: 'omni board <n>',
    summary: "PRD n's slices and what can run next",
    detail:
      "PRD n's slices as the loop sees them, rebuilt from GitHub on every run: each slice's state " +
      '(merged, stuck, in flight, runnable, blocked) and the wave that can run next. --json prints ' +
      'it as one document, the one /omni:wave acts on. Needs gh logged in.',
  },
  {
    name: 'care',
    kind: 'command',
    who: 'skills',
    usage: [
      'omni care state <prd> [--pr <n>] [--repo <owner/name>]',
      'omni care list <prd> [--json]',
      'omni care reply --verdict <v> --body <text> [--thread <id>]',
      'omni care reply --verdict <v> --file <path> [--thread <id>]',
    ],
    summary: "PRD n's feature PR as PR care sees it, and its marked replies",
    detail:
      "state prints PRD n's feature PR as one document: its checks, whether it conflicts, each review " +
      'thread with its verdict, whether a wave holds claims, and the next actions of a round; with ' +
      "--repo and --pr, in a plan repository, a target's PR read against that target. list, in a plan " +
      'repository, names every pull request /omni:mega-pr-care looks after, in merge order. reply ' +
      'writes a reply ending with the care marker; with --thread it posts it and resolves the thread ' +
      'unless the verdict is asked. Needs gh logged in.',
  },
  {
    name: 'next',
    kind: 'command',
    who: 'you',
    usage: ['omni next [<prd>…] [--json] [--plan]', 'omni next --roadmap <n> [--json] [--plan]'],
    label: 'omni next [<n>…]',
    summary: "the loop's next step, for PRD n or across your PRDs",
    detail:
      "PRD n's next step, read from its phase-0 PR, its feature PR, its open outbox questions and " +
      'its board: act with the skill to run (a wave, yolo, yolo-fix or one PR care round), wait ' +
      'with when to look again, park with who it waits on and the link where they act, or done. ' +
      'With no number it drives your own PRDs in inbox, building or outbox, as omni status marks ' +
      'them. --plan orders every slice of them into numbered steps (colliding territories in ' +
      'series with the reason, blocked-by held, the rest beside each other) and keeps the plan in ' +
      'this checkout; each later call returns the first step not done, and writes a new plan ' +
      'version with a one-line reason when a slice goes stuck, a slice is added or a PRD ends ' +
      "early. --roadmap <n> drives exactly roadmap n's PRDs, someone else's included: a blocked " +
      "PRD's first step is held until its blockers' feature PRs merged (in a plan repository, the " +
      'plan PR and every target PR), its why naming the pull request it waits on and its state, while ' +
      'every other step runs; a person question not answered parks only the PRDs it blocks, and a ' +
      'blocker closed unmerged parks its dependents. ' +
      'On the loop plan it also returns a pool: steps, up to limits.parallelSteps (1 to 6, default 3) ' +
      'steps to launch now, counting those running; running, the steps already running, read from ' +
      'GitHub (a live claim, or omni:in-progress with a fresh status comment), so a closed terminal ' +
      'launches nothing twice; and held, each step kept back with the rule and the step it waits on. ' +
      'A step is offered only when it passes four rules against every step running or offered: ' +
      'another PRD, no open blocker, no shared path in the same repository (generated paths never ' +
      "collide; a finish stands on all its PRD's slices) and the plan allows it. With " +
      'limits.parallelSteps: 1 it is one step per tick, as before. ' +
      'It writes nothing on GitHub; GitHub out of reach is a wait. --json prints it as one ' +
      'document: step and verdict as before, then steps, running and held. Needs gh logged in.',
  },
  {
    name: 'loop',
    kind: 'command',
    who: 'skills',
    usage: [
      'omni loop push start [--take-over]',
      'omni loop push tick --step <k> --prd <n> --action <word> --result "<line>" […]',
      'omni loop push park --prd <n> --who "<who>" --what "<what>" [--link <url>]',
      'omni loop push stop',
      'omni loop status [--json]',
    ],
    summary: "sends a loop's state to the Loop page",
    detail:
      "Sends where a loop stands to the Loop page on the Omni page, with this computer's sign-in. " +
      'start opens a loop on this repository with the loop plan omni next --plan keeps, and keeps ' +
      "the loop's id and plan in this checkout, so a loop whose terminal closed resumes with the " +
      'same ones; it refuses a second live loop here, and takes over a silent one, whose session ' +
      'died, only with --take-over. tick records one step, its result, its links, the repositories ' +
      "it touches (--repos, else the plan's) and the next wake, and carries a new plan version when " +
      'omni next wrote one; park records a PRD waiting ' +
      'on a person; stop ends the loop. status prints the loop kept here and what it is doing, and ' +
      'calls nothing. It never holds up the loop: a 5-second limit and one sign-in refresh, and ' +
      'anything that stops it exits 1 with one line (off, no sign-in, unreachable or refused).',
  },
  {
    name: 'check',
    kind: 'command',
    who: 'you',
    usage: ['omni check [config|inbox|outbox|knowledge|kb|releases|coverage|all]', '  [--base <ref>] [--prd <n>]'],
    label: 'omni check [all]',
    summary: "the repository's guards",
    detail:
      "The repository's guards, each printing its violations or one line saying it passed: config " +
      '(the config file, its flow and every hook file the flow names, each refusal naming its key), inbox ' +
      '(the PRDs waiting to be built, a spec\'s front matter included: e2e: validate is the only value of e2e), outbox (the open items), knowledge (the registers), kb (the ' +
      "playbook's forms), releases (the release notes) and coverage (every risky change of a branch " +
      'accounted for, against --base). all, the default, runs every one, and skips coverage when ' +
      '{remote}/{defaultBranch} has not been fetched. Exit 1 on any violation.',
  },
  {
    name: 'flow',
    kind: 'command',
    who: 'you',
    usage: [
      'omni flow show [<point>] [--json] [--repo <target>]',
      '  [--prd <n> --slice <id> | --path <p>]',
      'omni flow verdict <point> --from <file>',
      'omni flow check merge --pr <n> [--repo <target>] [--json]',
    ],
    label: 'omni flow show',
    summary: "this repository's areas, rules and hooks",
    detail:
      "The repository's flow, the rules, areas and hooks its config declares. show with a point " +
      '(do-work.test, pr.open…) prints the hooks to follow there, every before, the replace and ' +
      'every after, each with its area, its text with the inputs filled in and the verdict line it ' +
      'ends with, then kitStep: run, or replaced when a hook takes the kit\'s place; --prd and --slice ' +
      "read the slice's territory from its plan, --path takes one path. A hook file that is not there " +
      'is a not ok line and exit 1. show --path prints the area a path belongs to, with every rule ' +
      "and hook there; show alone, what this repository changes from the kit's defaults, area by " +
      "area. --repo reads a target's flow from its imported copy. verdict reads a hook's output: ok, " +
      'or not ok with the point and why, exit 1, and not ok … no verdict when its last line is not ' +
      "the verdict. check merge reads a sub-PR's checks, reviews and diff and applies the sub-PR rules " +
      'of its areas: ok and the merge command to run, or a not ok line per reason, exit 1.',
  },
  {
    name: 'kb',
    kind: 'command',
    who: 'you',
    usage: ['omni kb show <form> [--json]', 'omni kb status [--json]', 'omni kb graph [--json]', 'omni kb init'],
    label: 'omni kb show <form>',
    summary: 'one form of the playbook',
    detail:
      'The playbook: one form per question an agent asks while delivering (testing, architecture, ' +
      'conventions and more). show prints one form section by section, each saying where it comes ' +
      "from: this repository's own words, a page it points to, or the kit default. status prints " +
      'the map of every form and register and every open question; graph the knowledge registers ' +
      'as one graph; init lays down every missing form, blank, and changes no file that exists.',
  },
  {
    name: 'knowledge',
    kind: 'command',
    who: 'you',
    usage: ['omni knowledge <id>', 'omni knowledge judge'],
    label: 'omni knowledge <id>',
    summary: 'one rule of the knowledge base',
    detail:
      'One entry of the knowledge base, a principle, a rule or an invariant, by its id (such as ' +
      'P-PRODUCT-1), with every entry that serves it. A proposed entry says who proposed it and ' +
      'when: it describes the product, but it is no law until a person confirms it. judge is the ' +
      'sweep: it asks of every rule and invariant whose Enforced by: is unenforced whether it is ' +
      'worth a law, the model first, then omni decide law-worth. A yes opens its law issue and ' +
      'reads pending #<n>; a no leaves its register for its PRD\'s settled.md, and every entry ' +
      'still citing it is named. Once each one is judged it sets laws.requireProof: true. It ' +
      'writes the working tree only, for a knowledge PR a person opens; a second run changes ' +
      'nothing. It needs gh and OPENROUTER_API_KEY.',
  },
  {
    name: 'signin',
    kind: 'command',
    who: 'you',
    usage: ['omni signin'],
    label: 'omni signin',
    summary: 'sign in to the Omni page, once per computer',
    detail:
      "Signs you in to the Omni page, the one the config's ask.url names: it opens the page in your " +
      'browser, then keeps the sign-in in your home folder, for that host. Ask mode and dossiers ' +
      'both use it. Once per computer is enough; omni whoami says who is signed in, omni signout ' +
      'forgets it.',
  },
  {
    name: 'dossier',
    kind: 'command',
    who: 'you',
    usage: ['omni dossier open "<title>"', 'omni dossier push <n> [--kind visual|bug|concept]', 'omni dossier link <n> [--kind visual|bug|concept]', 'omni dossier status'],
    label: 'omni dossier …',
    summary: "a PRD's dossier on the Omni page",
    detail:
      "A PRD's dossier on the Omni page, where the whole workspace reads every version of its " +
      'spec, plan and before/after. open opens a draft for an idea and prints its link; push sends ' +
      "PRD n's files and adds a version only where a file changed; link prints PRD n's page, on " +
      'any computer, or none when it has no dossier, and writes nothing; status says whether ' +
      'dossiers are on here. With --kind visual or --kind bug, push and link work on issue n\'s fix ' +
      'instead: its visual update or bug fix page, filled from its folder. With --kind concept, they ' +
      'work on concept n, its issue\'s number: its page under Work › Concepts, filled from its ' +
      'concept.md, vision tour, boards and debate. It never holds up the ' +
      'skill that runs it: anything that stops it exits 1 with one line.',
  },
  {
    name: 'idea',
    kind: 'command',
    who: 'you',
    usage: ["omni idea add '<title>' --pitch '<pitch>' [--lane now|next|later]", 'omni idea list [--json]'],
    label: 'omni idea …',
    summary: "this repository's ideas board on the Omni page",
    detail:
      "This repository's ideas board on the Omni page, for a member of its workspace. add puts an " +
      'idea on the board, in the lane given or in later, and prints the board\'s link: a title of 120 ' +
      'characters at most, a pitch of 600. list prints the ideas lane by lane, Now, Next then Later, ' +
      'each with its votes and its PRD when it has one; --json prints the same as JSON. Both use your ' +
      'sign-in (omni signin). Signed out, the page unreachable or a refusal is one line, and never an ' +
      'error; a bad lane or a title or pitch too long exits 2.',
  },
  {
    name: 'proof',
    kind: 'command',
    who: 'skills',
    usage: ['omni proof push <n> <dir>', 'omni proof session [<file>]'],
    summary: "sends a proof run to a PRD's Proof tab, or signs its browser in",
    detail:
      "Sends a proof run /omni:prove recorded to PRD n's dossier on the Omni page and prints its Proof " +
      "tab's link. It reads " +
      'run.json in the folder, and refuses before sending anything a file that is not .webm, .gif, ' +
      '.ts or .txt, or one over 50 MB. Then it uploads each clip and script, and registers the run. ' +
      'It never holds up the skill that runs it: anything that stops it exits 1 with one line, as ' +
      'omni dossier link does. omni proof session writes the signed-in browser session a run films ' +
      'with, from your omni signin, to <file> or PROOF_STORAGE_STATE: set proof.setup to it.',
  },
  {
    name: 'pitch',
    kind: 'command',
    who: 'skills',
    usage: [
      'omni pitch start <n> --for customers|inside',
      'omni pitch film <dir>',
      'omni pitch check <dir>',
      'omni pitch render <dir> [--stills]',
      'omni pitch studio <dir> [--no-open]',
      'omni pitch push <n> <dir>',
    ],
    summary: "makes a shipped PRD's pitch, and sends it to its Pitch tab",
    detail:
      'The verbs /omni:pitch runs. start refuses with one line, writing nothing, a PRD not shipped, a ' +
      'proof.url that is not a fixed URL, no ffmpeg or no sign-in; otherwise it opens the run folder ' +
      "under the worktrees, writes the product's Pitch settings there as settings.json (the Arcade " +
      'preset, said in one line, when the Omni page cannot answer them), names each file they point at ' +
      "that the run's assets/ folder must hold, and prints the folder. film plays the folder's " +
      'walk.json in the browser at 1920×1080, signed in with its storage-state.json, and writes ' +
      'walk.webm and moments.json, each moment with its time, the box of its element and the camera ' +
      'that shows it; it only looks, refusing a click on a submit button or on words that save, send, ' +
      "delete or change anything, and writing nothing then. check reads the folder's " +
      'storyboard.json and stops, naming each with its path, a field the schema refuses, a media file ' +
      'missing, an intro that is not first or an outro that is not last; it warns on words over their ' +
      'count, words that take longer to read than their scene lasts and a length outside 15 to 60 ' +
      's, and writes the warnings to pitch.json. render --stills draws one image per scene and a ' +
      'contact sheet of them in stills/; render draws every frame in the browser and makes pitch.mp4 ' +
      '(1920×1080), pitch-square.mp4 (1080×1080) and pitch.gif (8 s at most, 640 px wide) with ffmpeg, ' +
      "the music its provider picks under them, and the intro's still as slide.png and slide-square.png. " +
      'studio serves the storyboard on a local page with play, frame and scene keys, opens it unless ' +
      '--no-open, and reloads it when the storyboard changes. push ' +
      "sends a pitch /omni:pitch made of shipped PRD n to its dossier on the Omni page, and prints its " +
      "Pitch tab's link, then the GIF's link that opens without signing in. It reads pitch.json in the " +
      'folder and refuses, before sending anything, a run missing one of its five files ' +
      '(slide.png, slide-square.png, pitch.mp4, pitch-square.mp4, pitch.gif) or one over 50 MB. A PRD ' +
      'that is not shipped prints not shipped. It never retries, and never holds up the skill that runs ' +
      'it: anything that stops it exits 1 with one line, as omni proof push does, and keeps every file.',
  },
  {
    name: 'business',
    kind: 'command',
    who: 'you',
    usage: [
      'omni business show [--json]',
      'omni business cited <id>… --by <skill> [--ref <text>]',
      'omni business claim add --kind <k> --value <v> --state <s> --ref <text>',
    ],
    label: 'omni business show',
    summary: 'the business this repository serves, as agents read it',
    detail:
      "What agents in this repository know of the business it serves: the confirmed claims of the " +
      "workspace's business, picked or drafted on the Settings › Business page, each with its id (such " +
      'as rival#4) under the sentence they make. A claim the evidence now contradicts, and nobody has ' +
      'answered yet, is marked as such and left out of the sentence. --json prints them for an agent, ' +
      'each with its state (confirmed or contradicted). Under the claims come the product\'s personas, ' +
      'one line each (name, stance, trade, who they are and how they use it), and --json carries them ' +
      'as personas, [] when there are none. With no business, ' +
      'no sign-in, the Omni page unreachable or a refusal, it prints one line saying so and exits 0: ' +
      'agents carry on without it. cited logs the claims an agent cited, by which skill and in which ' +
      'run, so the page shows how often each one is cited; a failed call prints a skip line and exits 0. ' +
      'claim add stores a claim a person gave as an answer (region, offering, size, trade or rival), its ' +
      'receipt the skill and the run: proposed, for a member to confirm on the Business page, or ' +
      'confirmed; a value the business already holds is named, not stored twice, and a failed call ' +
      'prints a skip line and exits 0.',
  },
  {
    name: 'constituents',
    kind: 'command',
    who: 'skills',
    usage: ['omni constituents [--json]'],
    summary: "the product's Statement and Never list, read at every session's start",
    detail:
      "Prints the constituents of the product this repository serves: its Statement (what the product " +
      'is) and its Never list (what it must never become or do, each line with its never#<n> id), as an ' +
      'owner wrote them on Settings › Business. The plugin runs it when a session starts, so they come ' +
      'before the briefing. It reads them from the Omni page with your omni signin, keeps a copy on this ' +
      'computer, and says "synced just now"; offline or failing, it prints that copy with its age. With ' +
      'no copy, no product or no sign-in it prints one line. It always exits 0 within 3 seconds. --json ' +
      'prints the same for skills: state, product, statement, never and syncedAt.',
  },
  {
    name: 'decide',
    kind: 'command',
    who: 'skills',
    usage: ['omni decide <decision> --state-file <json> --old <value> [--ref <text>] [--json]'],
    summary: "asks the workspace's Jev decision, such as outbox-risk, after the agent's own call",
    detail:
      "Asks TypeSafe's Jev, through the Omni page and the terminal's sign-in, one decision the " +
      "workspace owner put On in Settings › Jev, such as outbox-risk (is this decision hard to " +
      "revert?). The agent makes its own call first and passes it with --old; the state file holds " +
      'what the decision sends. It prints the answer and its confidence when Jev decided, and unset ' +
      'otherwise (the decision Off or in Shadow, no sign-in, a timeout, a refusal): then the agent ' +
      'keeps its own answer. --json prints who decided. It always exits 0, except on a usage error.',
  },
  {
    name: 'version',
    kind: 'command',
    who: 'you',
    usage: ['omni version', 'omni --version'],
    label: 'omni version',
    summary: 'which kit runs, and whether a newer one exists',
    detail:
      'The version of the kit this omni runs, marked (source) when it runs from the kit source, or ' +
      "(unversioned) for a build that carries none. It then asks GitHub, through gh, for the kit's " +
      'latest release, for up to 5 seconds: (latest) when it is the one running, a second line ' +
      'saying to run omni update when a newer one exists, nothing more when GitHub does not answer. ' +
      'It needs no config, and always exits 0.',
  },
  {
    name: 'update',
    kind: 'command',
    who: 'you',
    usage: ['omni update [--to <version>]'],
    label: 'omni update',
    summary: 'opens the pull request to the latest kit',
    detail:
      "Finds the kit's latest release, or the one --to names, downloads its omni and lets it do the " +
      'work: in a worktree cut from the remote {defaultBranch}, it writes the new bin, checks ' +
      'config.yml under the new version without rewriting it, creates any knowledge form the ' +
      'repository lacks and any missing loop label, then commits, pushes and opens one pull request ' +
      'for a person to merge. Your checkout is never touched. Up to date, it writes nothing; a pull ' +
      'request already open is printed instead. A release GitHub cannot find, or a config.yml the new ' +
      'version refuses, stops it before anything is committed, exit 1.',
  },
  {
    name: 'help',
    kind: 'command',
    who: 'you',
    usage: ['omni help [<name>]'],
    label: 'omni help [<name>]',
    summary: 'this page, or one command or skill',
    detail:
      'With no name, the loop, its principles and every command, on one screen. With a name, one ' +
      'command (board), skill (yolo) or slash command (/omni:yolo): its usage, who runs it and what ' +
      'it does. A name that is both a command and a skill prints both. omni --help and omni -h ' +
      "print the same screen. It needs no config: outside an installed repository it uses the kit's " +
      'defaults.',
  },
  {
    name: 'init',
    kind: 'command',
    who: 'you',
    usage: ['omni init [--force] [--test <cmd>] [--preflight <cmd>]', '  [--preflight-full <cmd>]'],
    summary: 'install the loop on this repository',
    detail:
      'Installs the Omni Loop on the repository it runs in: writes .omni-loop/config.yml, copies ' +
      'the running omni to .omni-loop/bin/omni.mjs, lays down the blank playbook forms and creates ' +
      'the loop labels the repository lacks, switches the status line on in .claude/settings.json, ' +
      'then prints the steps a person still has to take. It writes nothing outside .omni-loop/ but ' +
      "that statusLine key, and never replaces someone else's. --force writes the config, the copy " +
      "and the kit's own status line again; the other flags give the commands that test the " +
      'repository.',
  },
  {
    name: 'config',
    kind: 'command',
    who: 'you',
    usage: ['omni config [key.path]'],
    summary: "this repository's config, or one value of it",
    detail:
      "The repository's config, .omni-loop/config.yml with every default filled in, as JSON; with " +
      'a key path such as paths.delivery, that one value alone. Every skill reads its folders, ' +
      'branches, labels and commands from here rather than spelling them.',
  },
  {
    name: 'credits',
    kind: 'command',
    who: 'you',
    usage: ['omni credits [--repo <owner/name>] [--since <YYYY-MM>]', '  [--list] [--json]'],
    summary: 'what the loop worked on across the organisation',
    detail:
      "Counts what the loop's signature worked on across the organisation that owns this " +
      'repository: its pull requests, its PRD issues and the commits it co-authored on default ' +
      'branches. --repo narrows it to one repository, --since to what was created from that month ' +
      'on; --list adds one line per item, --json prints the whole report as one document. It reads ' +
      'GitHub through gh and stores nothing.',
  },
  {
    name: 'targets',
    kind: 'command',
    who: 'you',
    usage: ['omni targets [--json]'],
    summary: "a plan repository's target repositories, and where each stands",
    detail:
      "In a plan repository, one whose config has a plan section, one row per target repository, " +
      'in config order: its role, where its knowledge lives (own, imported or none), the kit ' +
      'version its default branch runs, and its state. ok; stale when an imported copy was read ' +
      'before a change to a file it was drawn from; drifted when the config no longer says what ' +
      'the repository has; unreachable when gh cannot read it. It reads GitHub through gh, clones ' +
      'nothing and refreshes nothing. --json prints the same rows as one document. Exit 0 when ' +
      'every row is ok, 1 otherwise, or 1 with not a plan repository.',
  },
  {
    name: 'whoami',
    kind: 'command',
    who: 'you',
    usage: ['omni whoami'],
    summary: 'who is signed in to the Omni page',
    detail:
      'The email signed in to the Omni page on this computer, or signed out. Past its expiry it ' +
      'renews the sign-in first; when the page refuses, it says the sign-in is no longer valid and ' +
      'exits 1.',
  },
  {
    name: 'signout',
    kind: 'command',
    who: 'you',
    usage: ['omni signout'],
    summary: "forget this computer's sign-in",
    detail: "Forgets this computer's sign-in to the Omni page the config's ask.url names. omni signin signs in again.",
  },

  // Commands the skills run. Their order is the "Run by the skills" line's.
  {
    name: 'settle',
    kind: 'command',
    who: 'skills',
    usage: [
      'omni settle <item-file> --by <who> --at <iso>',
      '  --channel prd-issue|feature-pull-request --number <n>',
      '  (--answer "<text>" | --answer-file <path>) [--url <u>]',
      '  [--verdict agreed|drifted]',
    ],
    summary: 'settle one answered outbox item',
    detail:
      "Settles one open outbox item with the answer a person gave: appends the question and the " +
      "answer, word for word, to the PRD's settled ledger, then deletes the open file. The ledger " +
      'is append-only: nothing in it is ever rewritten.',
  },
  {
    name: 'adopt',
    kind: 'command',
    who: 'skills',
    usage: ['omni adopt <item-text-file>'],
    summary: 'adopt a medium outbox item',
    detail:
      "Adopts a medium outbox item, as it is raised or once it is open: appends its entry to the PRD's " +
      'settled ledger and removes the open file. An adopted decision stands unless someone objects ' +
      "later. /omni:wave adopts a wave's medium items once the wave has merged.",
  },
  {
    name: 'replies',
    kind: 'command',
    who: 'skills',
    usage: ['omni replies --prd <n> --pr <n>', '  [--repo <owner/name>] [--post]'],
    summary: 'read the numbered answers on the feature PR',
    detail:
      'Reads the numbered replies a person left on the feature PR, settles each outbox item they ' +
      'answer, and with --post posts the next round of questions. /omni:yolo-fix starts from it.',
  },
  {
    name: 'answers',
    kind: 'command',
    who: 'skills',
    usage: [
      'omni answers ask <prd> --pr <n> [--repo <owner/name>] [--json]',
      'omni answers post --prd <n> --pr <n> --answers <file>',
      '  [--repo <owner/name>] [--print]',
    ],
    summary: 'answer the outbox from the terminal',
    detail:
      'With ask, prints the open human-action and high questions of the feature PR, in its numbering, ' +
      'at most four at a time. With post, writes the picks as one reply and posts it on the feature ' +
      'PR, where omni replies reads it; --print only prints it. /omni:yolo runs it when its gate ends red.',
  },
  {
    name: 'comment',
    kind: 'command',
    who: 'skills',
    usage: [
      'omni comment --prd <n> --branch <feature-branch>',
      '  [--repo <owner/name>] [--base <ref>] [--ref <sha>] [--labels <a,b>]',
      '  [--slack-note <file>] [--title <t>] [--owner-slack-id <id>]',
      '  [--owner-login <login>] [--pr-comment <file>]',
      'omni comment --prd <n> --pr <n> [--repo <owner/name>] [--result <file>]',
    ],
    summary: "the outbox's comments on the feature PR and the PRD issue",
    detail:
      "Writes the outbox's comments, keeping one of each up to date. With --branch, the PRD " +
      "issue's: the open items and the changes no account covers, then the Slack note file. With " +
      '--pr, the plain-words comment on the feature PR: its open, answered and adopted questions. ' +
      '/omni:yolo runs it when the gate is red.',
  },
  {
    name: 'ship',
    kind: 'command',
    who: 'skills',
    usage: ['omni ship <prd>'],
    summary: 'move a PRD from the inbox to shipped',
    detail:
      "Moves PRD n's folder from {inbox} to {shipped}, its outbox inside it, and rewrites the paths " +
      'that named them. It stages the moves and never commits. Exit 1 when it refuses, naming every ' +
      'reason (with release notes on, a missing or failing note is one); exit 2 when the delivery ' +
      'folder holds uncommitted changes.',
  },
  {
    name: 'harvest',
    kind: 'command',
    who: 'skills',
    usage: ['omni harvest <prd> --pr <feature pull request>'],
    summary: 'keep what a shipped PRD taught, as knowledge',
    detail:
      "The knowledge harvest, run on this computer: the pipeline the loop's app runs on a merged " +
      'feature PR. It asks a model where each decision of the PRD belongs in the knowledge base and ' +
      'writes the files into the working tree, staging and committing nothing. It needs gh and ' +
      'OPENROUTER_API_KEY. Exit 1 when the PR is not merged into {defaultBranch}.',
  },
  {
    name: 'item',
    kind: 'command',
    who: 'skills',
    usage: [
      'omni item new --prd <n> --slice <id> --file <file>',
      '  [--adopt | --out <dir>] [--json]',
      'omni item relay <dir> --prd <n>',
    ],
    summary: 'record a decision an agent took alone',
    detail:
      'Records one decision an agent took without asking as an outbox item, from a JSON file: the ' +
      "kit picks its rank and its id. A decision that would break a named law stops the slice " +
      "instead, and one that needs a person's action blocks it. --adopt sends a medium item " +
      'straight to the settled ledger. --out writes the item to a folder instead of the outbox, ' +
      'for a slice built in another repository, and never adopts. relay moves every item and ' +
      "account of such a folder into PRD n's outbox, checked as new items are; a refused file " +
      'stays in the folder with its reason, exit 2.',
  },
  {
    name: 'plan',
    kind: 'command',
    who: 'skills',
    usage: ['omni plan check <prd>', 'omni plan moved <prd> [--json]', 'omni plan landings <prd> [--json] [--repo <name>]'],
    summary: "grade a PRD's plan, see what moved in its targets, or list its landings",
    detail:
      "check grades PRD n's plan.md before anyone builds from it: every blocker names a slice of the " +
      'same plan in an earlier wave of the same landing, no id is used twice, no two slices of one ' +
      'wave share ground, landings run from 1 with no gap, and paths that land alone travel alone. ' +
      'It prints the slices, the waves and where they meet, then every violation; exit 1 on any. ' +
      "moved, in a plan repository, compares each target's read at with its default branch today: " +
      'moved with the files changed under its slices\' territories, ok, or unreachable; exit 0 ' +
      'whatever the states, 1 with not a plan repository. landings prints the chain of landing ' +
      'branches the PRD is opened as: each branch, the branch it is cut from, its title suffix, the ' +
      'landing it is merged after and its slices; --repo keeps one target of a plan repository.',
  },
  {
    name: 'roadmap',
    kind: 'command',
    who: 'skills',
    usage: [
      'omni roadmap check [<n>]', 'omni roadmap push <n>', 'omni roadmap answer <n> <question> "<answer>"',
      'omni roadmap prereqs <n> [--fix] [--json]', 'omni roadmap tick <n> <id>',
    ],
    summary: 'grade, push, answer or check the prerequisites of the roadmaps of the inbox',
    detail:
      "check grades every roadmap under {inbox}roadmaps/, or roadmap n alone: a milestone's PRDs, each " +
      'with its blockers, the why of each, and its wave. It refuses a table that does not parse, an id ' +
      'used twice, a blocker that is not a row, a cycle, a wave that does not follow its blockers, a ' +
      "blocker without its why, a row whose PRD has no folder or whose spec's blocked-by differs, and a " +
      'question blocking a row that does not exist; in a plan repository also a repo that is not a ' +
      'target, a read-only one, and a consumer PRD not after the provider PRD it waits on. It prints ' +
      'the PRDs wave by wave, then every violation; exit 1 on any. omni check inbox runs it too. ' +
      "push sends roadmap n, its open questions with the latest answer to each, and where each PRD " +
      'stands (waiting, building, outbox, ready, merged or closed, and the pull request a PRD not ' +
      "started waits on) to the roadmap's page on the Omni page, with this computer's sign-in. It " +
      'never holds up the loop: a 5-second limit and one sign-in refresh, and anything that stops it ' +
      'exits 1 with one line (off, no sign-in, github unreachable, unreachable or refused). answer ' +
      "posts a person's answer to one question as a comment on the roadmap's issue, with the marker " +
      "push reads the answers back from; the roadmap's page writes the same line. prereqs runs " +
      "roadmap n's Prerequisites rows on this machine, each check within 30 seconds (one that times " +
      'out or crashes is not ok), with --fix the agent rows\' fixes once, and prints one line per row ' +
      'grouped by category: ok, fixed, ticked, or waits on you with the command of its card (--json ' +
      "prints the result instead). It keeps the result as this machine's last and pushes it to the " +
      "roadmap's page with the machine's name and the time; a page it cannot reach is one line and " +
      'never changes the exit: 0 when every row is ok, fixed or ticked, 1 otherwise. tick posts the ' +
      "comment that marks a person row done on the roadmap's issue; the page's Mark as done posts the " +
      'same one.',
  },
  {
    name: 'rework',
    kind: 'command',
    who: 'skills',
    usage: ['omni rework plan <prd> [--json]', 'omni rework close <id> --prd <n> --pr <n>'],
    summary: 'what a drifted PRD needs reworked',
    detail:
      "The terminal half of /omni:yolo-fix. plan derives, from the PRD's settled ledger, every " +
      'decision a person disagreed with that still needs reworking, each as a slice; close records ' +
      'that a sub-PR reworked one.',
  },
  {
    name: 'phase0',
    kind: 'command',
    who: 'skills',
    usage: ['omni phase0 <prd> [--base <ref>]'],
    summary: 'grade a phase-0 PR',
    detail:
      "Grades a phase-0 PR's own diff: docs only, and carrying the spec, the plan and the " +
      'before/after of the one PRD it asks a person to approve. Every commit must carry the ' +
      "loop's signature, unless signing is off. --base defaults to {remote}/{defaultBranch}.",
  },
  {
    name: 'approval',
    kind: 'command',
    who: 'you',
    usage: ['omni approval <n> [--json]', 'omni approval flag [--json]'],
    summary: "whether a PRD born on the server is approved, and still what was approved",
    detail:
      "Reads PRD n's approval in force on the Omni page, with your sign-in, and compares each file " +
      'it pinned with the file of the same kind in this checkout. It prints one line: approved by ' +
      'whom and when; waiting for approval, with the PRD page link; a changed or missing file (its ' +
      'content, or its whitespace only), which refuses until you restore it or approve again; the ' +
      'server unreachable, which holds the PRD rather than failing it; or refused, when the approver ' +
      'left the workspace or the page answered an error. It exits 0 only when approved. --json ' +
      'prints the state, who, when and the pinned files. omni approval flag reads where this ' +
      "repository's new PRDs are born instead: phase 0: server (approved on the PRD's page) or " +
      'phase 0: pr (a phase-0 PR), as an owner set it on the Omni page; when it cannot be read it ' +
      'says pr, with why, and exits 1. To wait until someone approves rather than read it once, ' +
      'use omni wait approval <n> (omni help wait).',
  },
  {
    name: 'wait',
    kind: 'command',
    who: 'you',
    usage: ['omni wait approval <n> [--timeout <minutes>]'],
    summary: 'ask for approval of a PRD born on the server, and wait until it lands',
    detail:
      "Asks PRD n's approvers on the Omni page, by the phone alerts and emails each one turned on: the " +
      "product's members asked to approve, except the author, or the author when nobody else is. It " +
      'prints one waiting line naming them, then follows the approval as it streams and prints the ' +
      'approved line, who and when and how many files are pinned, and exits 0. An approval already in ' +
      'force answers at once and asks nobody. A change pushed after approval voids it: the voided line ' +
      'prints, the approvers are asked again, and it keeps waiting. A cut stream resumes where it left ' +
      'off; after three failed tries in a row it prints server unreachable · held, not failed, and keeps ' +
      'trying. With no sign-in it exits 1 (no sign-in (omni signin) · held), and so it does past ' +
      '--timeout minutes, 60 by default (held: still waiting for …). The HUD shows the same lines.',
  },
  {
    name: 'visual',
    kind: 'command',
    who: 'skills',
    usage: ['omni visual <n> [--base <ref>]'],
    summary: 'grade a visual fix branch',
    detail:
      "The proof step of /omni:visual-fix, run on its fix branch: one folder for issue <n> under " +
      "the delivery folder's visual/, holding a before-after.html and each round of variations as " +
      'variations-r<k>.html, each under the size cap with no base64 raster image, no other file, ' +
      "and every commit carrying the loop's signature, unless signing is off. Prints " +
      'ok, or not ok with one line per failed check. --base defaults to {remote}/{defaultBranch}.',
  },
  {
    name: 'bug',
    kind: 'command',
    who: 'skills',
    usage: ['omni bug <n> [--base <ref>]'],
    summary: 'grade a bug fix branch',
    detail:
      "The proof step of /omni:bug-fix, run on its fix branch: one folder for issue <n> under the " +
      "delivery folder's bugs/, holding a bug.md with its Triage, Reproduction, Fix, Guard and " +
      'Mutation sections, a risk of critical, high, medium or low, a reproduction file the branch ' +
      "changes and its red line, and every commit carrying the loop's signature, unless signing is " +
      'off. It runs no test. Prints ok, or not ok with one line per failed check. --base defaults ' +
      'to {remote}/{defaultBranch}.',
  },
  {
    name: 'concept',
    kind: 'command',
    who: 'skills',
    usage: ['omni concept <n> [--base <ref>]'],
    summary: 'grade a concept branch',
    detail:
      "The proof step of a concept, run on its concept branch: one folder for concept <n> under " +
      "{inbox}concepts/, holding a valid concept.md (its front matter, its six sections and its " +
      'Areas table), vision.html, debate.md and the boards board-r<k>.html numbered from 1 with no ' +
      'gap, and nothing else. Each page is under the size cap, holds no base64 raster image and ' +
      'loads nothing from the network; no file outside that folder changed; every commit carries ' +
      "the loop's signature, unless signing is off. Prints ok, or not ok with one line per failed " +
      'check. --base defaults to {remote}/{defaultBranch}.',
  },
  {
    name: 'sign',
    kind: 'command',
    who: 'skills',
    usage: ['omni sign trailer|footer'],
    summary: 'the line the loop signs its work with',
    detail:
      'The line the loop signs its work with: trailer ends every commit a skill makes, footer ' +
      'every pull request and issue a skill opens. With signing off in the config it prints ' +
      'nothing, so a skill runs unchanged.',
  },
  {
    name: 'ask',
    kind: 'command',
    who: 'skills',
    usage: ['omni ask on|off|status', 'omni ask hook <pre|post|prompt|end>'],
    summary: 'ask mode, as /omni:ask switches it',
    detail:
      "Ask mode in this checkout: on prints the page where Claude's questions are answered, off " +
      "closes every terminal's session there, status says which. hook is what the plugin's hooks " +
      'run around each question; with the mode off it prints nothing. /omni:ask runs on, off and ' +
      'status for you.',
  },
  {
    name: 'heartbeat',
    kind: 'command',
    who: 'skills',
    usage: ['omni heartbeat [--end]'],
    summary: 'tells the Omni page this Claude session is working',
    detail:
      "What the plugin's hooks run after every tool call: at most once a minute per Claude session, " +
      'it tells the Omni page that the session is working, and on which draft, PRD or fix. --end, ' +
      "run when the session ends, says it stopped. It sends only when you are signed in and dossiers " +
      'are on, sends no path, command or text, prints nothing and always exits 0.',
  },
  {
    name: 'generated',
    kind: 'command',
    who: 'skills',
    usage: ['omni generated <range> [--json]'],
    summary: 'which built files a range made stale, and how to rebuild them',
    detail:
      "For each output the config's generated section lists, a file the repository builds rather " +
      'than writes, says stale when a path the range changed is under one of its sources, fresh ' +
      'otherwise, with the build that rebuilds it. A wave runs the stale builds once, after merging, ' +
      'and commits the rebuilt files alone. --json prints the same as one document. Without the ' +
      'section it prints no generated files. It runs no build, and exits 0 whatever it finds.',
  },
  {
    name: 'design',
    kind: 'command',
    who: 'skills',
    usage: ['omni design touched [<base>]', 'omni design screens', 'omni design words <page.html>…'],
    summary: 'whether a branch touches a screen, the screen library, and the word pass over a mockup',
    detail:
      'Design craft is off until the config sets design.enabled to true: then the skills read the ' +
      "design form, omni kb show design (the product, where its design system lives, what it does on " +
      'purpose and how to look at a screen), and the product wins over the craft floor and the refuse ' +
      'list. touched reads what the branch changed since its merge base with <base> (by default the ' +
      "slice's feature branch, else the default branch) and prints design: off while the flag is off, " +
      'ui: yes and each changed path the design.paths globs match, ui: no when none does, or ui: ' +
      'unknown when design.paths is empty or the base cannot be read, for the agent to judge from the ' +
      "diff. On ui: yes a slice follows its design review, which runs commands.design, the repository's " +
      'design linter, when it is set. None of it ever blocks: the review never blocks a slice, a wave ' +
      'or a gate, it only reports, and touched exits 0 whatever it finds. screens lists the screen ' +
      'library, the folder design.screens names (by default design/screens/ under the knowledge ' +
      'folder): one Markdown file per screen, its front matter saying its status (draft, locked or ' +
      'superseded), who locked it, when and in which words, its mockup, the paths it implements and ' +
      'its routes. It prints one line per screen, sorted by name, with its status, who locked it and ' +
      'when, and its routes, then each file that does not read, says so when the library is empty, ' +
      'and prints design: off while the flag is off. There is no hand-kept index, and screens exits 0 ' +
      'whatever it finds. words is the word pass: it reads each mockup page given, structure never ' +
      'style, and prints every screen (an element design.words.screen matches, by default ' +
      '[data-screen]; a page with none is read whole and says so) with its visible strings, each ' +
      "control's marked, and its word count, then its findings: sentence-on-control, a button or link " +
      'whose label holds design.words.sentence words or more (default 7); two-primaries, more than one ' +
      'primary action (design.words.primary, by default [data-primary]) in one screen; ' +
      'explains-at-rest, a string outside any control longer than design.words.sentence; and ' +
      'avoided-word, a word or phrase in design.words.avoid or in the explicit list the design ' +
      "form's product section holds, one line labelled Words we avoid:, Words to avoid:, Avoided " +
      'words: or Avoid: with the words after it or one bullet each below it (prose is never read as a ' +
      'list). The selectors are tags, #ids, .classes and [attributes], comma-separated, with no ' +
      'combinator. A page it cannot read is named and the next is read; it prints design: off while ' +
      'the flag is off, and words exits 0 whatever it finds: a finding is fixed in the screen, never ' +
      'silenced.',
  },
  {
    name: 'e2e',
    kind: 'command',
    who: 'skills',
    usage: ['omni e2e status <prd>', 'omni e2e heals <prd> [--head <ref>]', 'omni e2e hold <prd>', 'omni e2e confirm <prd>', 'omni e2e reject <prd>', 'omni e2e guard <prd>'],
    summary: 'which e2e tests of a PRD have a recording, and which steps healed (beta)',
    detail:
      'status lists, as JSON, the tests tagged prd-<n> under the e2e.dir folder of the config, each ' +
      'with whether a recording of it exists in .e2e/cache, and exits 1 when one has none. A recording ' +
      'that does not read, or whose schemaVersion is not trace-1, fails the command and names the file. ' +
      'With e2e.enabled false it says so in one line and exits 1, reading no file. It runs no test, ' +
      'reaches no network and calls no model. heals pairs the recordings steps, by test id and call ' +
      'index, at the merge-base of the default branch and the head, and at the head, which is the PRD ' +
      'feature branch unless --head names another ref (a sub-PR branch): a ref git does not know is a ' +
      'usage error naming it, and on a first pass, with no recordings at the merge-base, every step is ' +
      'new. It lists each as healed ' +
      '(old and new action, and the summary), new or removed, as JSON; an identical step is not listed. ' +
      'Each healed step carries screenshots, a before and an after: the framework keeps no screenshot ' +
      'per step, so each side says kept false and why. The same refusals hold for both sides. hold moves ' +
      'each healed recording of the working tree out of the branch, into a folder inside the git ' +
      'directory that no commit holds, and puts the committed recording back, so a commit of e2e.dir ' +
      'holds only unchanged or new recordings. confirm commits the held recordings and notes them in ' +
      'e2e.dir/.e2e/confirmed.json, so heals no longer lists them until the screen changes again. ' +
      'reject drops the held recordings, leaves the committed ones and exits 1 so the test stays red. guard reads the files of e2e.dir (the .e2e/cache recordings apart) and the ' +
      'files this branch changed since the default branch, and exits 1 naming file:line and the kind, ' +
      'never the value, for a password, token, key or session-state shape; storage-state.json is ' +
      'refused by name. With e2e.enabled false it says so in one line and exits 1, reading no file.',
  },
  {
    name: 'statusline',
    kind: 'command',
    who: 'skills',
    usage: ['omni statusline', 'omni statusline --refresh <prd>'],
    summary: "Claude Code's status line: the session, then the PRD",
    detail:
      'What Claude Code runs as its status line, from the statusLine key omni init writes in ' +
      '.claude/settings.json: it reads the session on stdin and prints two lines, the model, the ' +
      "context bar, the 5-hour usage and ask mode, then the PRD this session works on, its stage, " +
      'and in the outbox its wave and slices. It never fetches, never calls GitHub and always exits ' +
      "0. --refresh is the background half: it rebuilds a PRD's board, as omni board does, into a " +
      'file the status line reads.',
  },
  {
    name: 'now',
    kind: 'command',
    who: 'skills',
    usage: ['omni now [--json] [--stdin] [--session <id>]'],
    summary: 'what this Claude session is on now, and the slices being built',
    detail:
      'The PRD this session works on, from its branch or else from the last command that named ' +
      'one, its stage (building while a slice is not merged), and the slices in flight and stuck by ' +
      'id and name. --json prints the same as one document, for the status line, the omni-hud band ' +
      "or any other agent. --stdin reads the session's folder and id from Claude Code's status line " +
      'JSON, --session names the session. It reads only this computer: it never fetches, never calls ' +
      'GitHub, writes nothing and always exits 0.',
  },

  // Skills you type in Claude. Their order is the overview's.
  {
    name: 'think-big',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:think-big <brief or n>'],
    label: '/omni:think-big',
    summary: 'a vast idea, explored by a studio, to a concept PR',
    detail:
      'For a vast idea, one that spans the whole product and would take several PRDs, before anyone ' +
      'commits to building it. A studio of agents goes wide with six to eight rendered concepts, then ' +
      'deepens the ones you keep into clickable prototypes, while a panel (a Visionary, a Craft ' +
      'critic, a Skeptic, a Value critic and real users) argues over each by name; you react at every ' +
      'round and crown one. It opens one concept PR into {defaultBranch} with the vision tour, every ' +
      'board, the debate and an area map of PRD-sized areas, sends the concept to its page under ' +
      'Work › Concepts on the Omni page, and ends with one ' +
      '/omni:brainstorm --concept <n> <area> line per area, the wedge first. A feature-sized idea is ' +
      'offered /omni:brainstorm or a lite run; a tweak gets the /omni:visual-fix line. It writes no ' +
      'code and never merges.',
    group: 'start',
    when: 'Use it when an idea spans the whole product and you want bold directions to react to before any scope is cut.',
    example: {
      type: '/omni:think-big give the app a brand new identity',
      result: 'rounds of concepts to react to, then a concept PR and one /omni:brainstorm line per area',
    },
  },
  {
    name: 'brainstorm',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:brainstorm', '/omni:brainstorm --concept <n> <area>'],
    label: '/omni:brainstorm',
    summary: 'an idea, to a design, to a PRD and its phase-0 PR',
    detail:
      'Turns an idea into an approved design, then into a PRD the loop can build: the PRD issue, ' +
      'the spec, the before/after page and the plan, in a docs-only phase-0 PR a person reviews and ' +
      'merges before any code is written. It writes no code and merges nothing, and ends with the ' +
      '/omni:yolo line that builds it. With --concept <n> <area>, it starts from one area of a ' +
      "concept in the inbox: the area's brief, the vision and the verdict. Once it fills the area's " +
      "PRD cell, it pushes the concept again, so the concept's page links that area to its PRD.",
    group: 'start',
    when: 'Use it when you have an idea for a change and want it designed before any code is written.',
    example: {
      type: '/omni:brainstorm list every skill in the docs',
      result: 'a PRD issue, its spec and plan, and a phase-0 PR for a person to review',
    },
  },
  {
    name: 'mega-brainstorm',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:mega-brainstorm'],
    label: '/omni:mega-brainstorm',
    summary: 'one PRD across repositories, from a plan repository',
    detail:
      'The brainstorm of a plan repository, one /omni:mega-invade set up: it turns one idea into ' +
      'one PRD whose plan says which slice lands in which target repository, read from a ' +
      'read-only clone of each, in which nothing runs. The spec, the plan, the draft feature PR ' +
      'and one phase-0 PR, with a table of what lands where, all live in the plan repository; it ' +
      'never writes in a target. It ends with the /omni:ultra-yolo line that builds it.',
    group: 'multi-repo',
    when: 'Use it when one idea needs changes in several repositories and this is their plan repository.',
    example: {
      type: '/omni:mega-brainstorm show invoices in the mobile app',
      result: 'one PRD whose plan says which slice lands in which repository',
    },
  },
  {
    name: 'roadmap',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:roadmap <source>'],
    label: '/omni:roadmap',
    summary: 'a milestone plan, to all its PRDs in one sitting',
    detail:
      'Turns a milestone plan (a page, a file or pasted text) into a roadmap: one PRD per item that ' +
      'delivers something, ordered by blockers that each say why. It shows one map of the PRDs, their ' +
      'waves and the open questions, and takes every answer in one message. Then it writes every ' +
      "PRD's issue, spec and before/after up front, with no plan (each is planned when the loop " +
      'reaches it), the roadmap issue and roadmap.md, checked by omni roadmap check, in one phase-0 PR ' +
      "a person merges, and pushes the roadmap's page. It ends with the /loop /omni:drive --roadmap <n> " +
      'line. In a plan repository it prints the /omni:mega-roadmap line and stops. It writes no code ' +
      'and merges nothing.',
    group: 'start',
    when: 'Use it when a milestone needs many PRDs and a plan already says what they are and in which order.',
    example: {
      type: '/omni:roadmap plans/crew.md',
      result: 'one map to answer, then every PRD and the roadmap in one phase-0 PR',
    },
  },
  {
    name: 'mega-roadmap',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:mega-roadmap <source>'],
    label: '/omni:mega-roadmap',
    summary: 'a milestone across repositories, to all its PRDs',
    detail:
      'The roadmap of a plan repository: it turns a milestone plan whose items span several target ' +
      'repositories into a roadmap whose PRDs each name the repositories they land in, read from a ' +
      'read-only clone of each, in which nothing runs. Its one map, refusing a read-only target and a ' +
      'consumer before its provider, takes every answer in one message; every spec is written up ' +
      'front with no plan, all in one phase-0 PR in the plan repository, and it never writes in a ' +
      'target. It ends with the /loop /omni:mega-drive --roadmap <n> line. Outside a plan repository ' +
      'it prints the /omni:roadmap line and stops.',
    group: 'multi-repo',
    when: 'Use it when a milestone needs PRDs in several repositories and this is their plan repository.',
    example: {
      type: '/omni:mega-roadmap https://example.com/crew-plan',
      result: 'one map to answer, then every PRD across the repositories in one phase-0 PR',
    },
  },
  {
    name: 'yolo',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:yolo <n>'],
    label: '/omni:yolo <n>',
    summary: 'build a whole PRD: plan, waves, the outbox gate, ship',
    detail:
      'Builds a whole PRD with nothing asked along the way: plans it if needed, runs /omni:wave ' +
      'until every slice is merged into the feature branch or nothing more can move, then runs the ' +
      'outbox gate. Green, it ships and marks the feature PR ready for a person to merge; red, the ' +
      'PR stays a draft with the outbox questions posted on it. When the spec says e2e: validate and ' +
      'e2e is enabled, it runs the e2e validation after ready and never changes the PR for it. ' +
      'It never merges into {defaultBranch}.',
    group: 'build',
    when: "Use it when a PRD's phase-0 PR is merged and you want it all built with nothing asked.",
    example: {
      type: '/omni:yolo 580',
      result: 'the feature PR ready for you to merge, or a draft with the outbox questions',
    },
  },
  {
    name: 'ultra-yolo',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:ultra-yolo <n>'],
    label: '/omni:ultra-yolo <n>',
    summary: 'build a PRD across repositories, one gate',
    detail:
      'Builds a PRD whose plan lands slices in other repositories, from its plan repository: ' +
      'records each target that moved since the plan was read, opens a draft feature PR in each ' +
      'target, runs /omni:ultra-wave until every slice is merged there, marks each target PR ready ' +
      "once its CI is green, then runs one outbox gate in the plan repository. Green, it ships and " +
      'marks the plan PR ready last; red, /omni:ultra-yolo-fix takes the answers. In a target it ' +
      'runs only its own committed preflight, and it never merges into any default branch.',
    group: 'multi-repo',
    when: "Use it when a multi-repository PRD's phase-0 PR is merged in its plan repository and you want it built in every target.",
    example: {
      type: '/omni:ultra-yolo 600',
      result: 'a feature PR ready in each target, then the plan PR ready last, or a draft with the outbox questions',
    },
  },
  {
    name: 'mega-pr-care',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:mega-pr-care <n> [--once]'],
    label: '/omni:mega-pr-care <n>',
    summary: 'look after every PR of a PRD across repositories',
    detail:
      'The /omni:pr-care of a plan repository: looks after the plan PR, every target and landing PR ' +
      'and every bug-fix PR linked to PRD n, round by round in merge order, until each is merged or ' +
      "closed or you stop it. Each target PR is read against the target's own default branch, " +
      "landings, wave claims and review form; a red that waits on another repository's PR spends " +
      'no attempt. In a target it runs only its own committed preflight, and it never merges. ' +
      '--once runs one round and returns, for /omni:mega-drive.',
    group: 'multi-repo',
    when: "Use it when a multi-repository PRD's pull requests are open and you want CI, conflicts and review comments handled in every repository.",
    example: {
      type: '/omni:mega-pr-care 1200',
      result: 'every target PR and the plan PR kept green, each review comment handled',
    },
  },
  {
    name: 'mega-bug-fix',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:mega-bug-fix <line or n> [--prd <prd>]'],
    label: '/omni:mega-bug-fix',
    summary: 'a bug across repositories, to one PR per target',
    detail:
      'The /omni:bug-fix of a plan repository, for a bug that shows in one target while its cause ' +
      'sits in another: the issue, its triage and a fix plan stay in the plan repository, provider ' +
      'first. Each target gets one fix PR into its default branch, red proven by its own preflight ' +
      'or its CI before the fix, saying which PR to merge first; a record PR closes the issue and is ' +
      'merged last. --prd <n> links it to a PRD, so /omni:mega-pr-care looks after its PRs. A change ' +
      "that would break today's consumer stops it, with the /omni:mega-brainstorm line. It never merges.",
    group: 'multi-repo',
    when: 'Use it when a bug shows in one target repository and its cause may sit in another.',
    example: {
      type: '/omni:mega-bug-fix the total is wrong on the invoice screen',
      result: 'one bug issue with a fix plan, one fix PR per target in merge order, and a record PR',
    },
  },
  {
    name: 'yolo-fix',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:yolo-fix <n>'],
    label: '/omni:yolo-fix <n>',
    summary: 'rework what you answered on the feature PR',
    detail:
      'Brings a PRD back in line with what a person answered on its feature PR: settles the ' +
      'replies, reworks every decision they disagreed with as its own slice, inside the bound its ' +
      'item stated, checks the whole feature, then ships it when the gate is green. It asks no ' +
      'question of its own and never merges into {defaultBranch}.',
    group: 'build',
    when: 'Use it when you have answered the outbox questions on a feature PR and want the PRD reworked.',
    example: {
      type: '/omni:yolo-fix 580',
      result: 'every decision you disagreed with reworked, then the feature PR shipped',
    },
  },
  {
    name: 'ultra-yolo-fix',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:ultra-yolo-fix <n>'],
    label: '/omni:ultra-yolo-fix',
    summary: 'rework what you answered, in each repository',
    detail:
      'The /omni:yolo-fix of a PRD built by /omni:ultra-yolo: reads and settles the answers on ' +
      'the plan PR, in the plan repository, lands each rework in the repository its decision was ' +
      'taken in, checks each target again, then runs the one gate. It asks no question of its own ' +
      'and never merges into any default branch.',
    group: 'multi-repo',
    when: "Use it when you have answered the outbox questions on a multi-repository PRD's plan PR.",
    example: {
      type: '/omni:ultra-yolo-fix 600',
      result: 'each rework landed in its repository, then the plan PR shipped',
    },
  },
  {
    name: 'visual-fix',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:visual-fix <line or n>'],
    label: '/omni:visual-fix',
    summary: 'a small visual change, to one PR',
    detail:
      'For a small visual change, such as a colour, a spacing or a label: from one line or an ' +
      'issue number, it shows today beside four or five variations, asks which one, applies the ' +
      'pick on a fix branch, looks at the real screen once and opens one PR into {defaultBranch} ' +
      'with its before/after page, every round of variations and who picked what. It sends them to ' +
      'the fix\'s page on the Omni page (/omni:dossier-push <n> --kind visual) and prints its link. ' +
      'No PRD, plan or outbox. A change that needs data, a route or a ' +
      'new screen stops it, with the /omni:brainstorm line to run instead. It never merges.',
    group: 'start',
    when: 'Use it when something on screen looks off and the fix is a colour, a spacing or a label.',
    example: {
      type: '/omni:visual-fix make the sidebar darker',
      result: 'four or five variations to pick from, then one PR with your pick',
    },
  },
  {
    name: 'bug-fix',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:bug-fix <line or n>'],
    label: '/omni:bug-fix',
    summary: 'a bug, to one PR',
    detail:
      'For a bug a user, a browser or an API caller can see: from one line or an issue, it posts a ' +
      'triage (how bad, whether a change broke it), proves a reproduction fails before any fix, ' +
      'fixes it test-first on a fix branch, adds the check that would have caught it and opens one ' +
      'PR into {defaultBranch}. It sends its record to the fix\'s page on the Omni page ' +
      '(/omni:dossier-push <n> --kind bug) and prints its link. No PRD, plan or outbox. A flaky ' +
      'check is not a bug and stops it; a ' +
      'fix that needs a product decision, a stored shape or a new screen stops it, with the ' +
      '/omni:brainstorm line to run instead. It never merges.',
    group: 'start',
    when: 'Use it when something a user can see is broken and needs a fix, not a new design.',
    example: {
      type: '/omni:bug-fix the Send button does nothing',
      result: 'a triage on the issue, then one PR with the fix and its test',
    },
  },
  {
    name: 'plan',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:plan <n>'],
    label: '/omni:plan <n>',
    summary: 'slice a PRD into waves (yolo runs it when needed)',
    detail:
      'Turns one PRD in the inbox into a plan of thin slices, each with its territory, what blocks ' +
      'it and its wave, written as plan.md beside the spec and graded by omni plan check. It commits ' +
      "the plan on the PRD's feature branch and opens the draft feature PR. It writes no code; " +
      '/omni:yolo runs it when a PRD has no plan yet.',
    group: 'build',
    when: 'Use it when a PRD is in the inbox and you want to see its slices and waves before building.',
    example: {
      type: '/omni:plan 580',
      result: 'plan.md beside the spec, and the draft feature PR',
    },
  },
  {
    name: 'wave',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:wave <n>'],
    label: '/omni:wave <n>',
    summary: "build one wave of a PRD's slices",
    detail:
      'Builds one wave of a PRD in parallel: claims every slice that can run, has one agent build ' +
      'each in a worktree of its own through /omni:do-work, then merges their sub-PRs into the ' +
      'feature branch one at a time, checks the wave together and adopts its medium decisions. ' +
      '/omni:yolo runs it for each wave. It never merges into {defaultBranch}.',
    group: 'build',
    when: "Use it when you want to build only a PRD's next wave and look at it before the next one.",
    example: {
      type: '/omni:wave 580',
      result: "the wave's sub-PRs merged into the feature branch, and a report",
    },
  },
  {
    name: 'ultra-wave',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:ultra-wave <n>'],
    label: '/omni:ultra-wave <n>',
    summary: 'build one wave across repositories',
    detail:
      'The /omni:wave of a plan repository: claims each slice that can run in its own target, has ' +
      'one agent build each there through /omni:do-work --target, merges each sub-PR into its ' +
      "target's feature branch, relays every decision into the plan repository's outbox and " +
      'adopts its medium ones. /omni:ultra-yolo runs it for each wave. It never merges into any ' +
      'default branch.',
    group: 'multi-repo',
    when: 'Use it when you want one wave of a multi-repository PRD built; /omni:ultra-yolo runs it for each wave.',
    example: {
      type: '/omni:ultra-wave 600',
      result: "the takeable slices built and merged into each target's feature branch",
    },
  },
  {
    name: 'do-work',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:do-work <n> <slice>'],
    label: '/omni:do-work',
    summary: 'build one slice of a PRD',
    detail:
      "Builds one slice of a PRD to standard: reads the repository's own context first, works " +
      "test-first, changes only the slice's territory, records every decision it takes without " +
      'asking as an outbox item, and ships the slice as a sub-PR into the feature branch. Each ' +
      'agent of /omni:wave does this job; you may run it on one slice.',
    group: 'build',
    when: 'Use it when you want one slice of a PRD built on its own, outside a wave.',
    example: {
      type: '/omni:do-work 580 s1',
      result: 'the slice built test-first, as a sub-PR into the feature branch',
    },
  },
  {
    name: 'pr',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:pr'],
    label: '/omni:pr',
    summary: 'open, watch and finish a pull request',
    detail:
      'Opens, updates, watches and finishes a pull request of the loop: a feature PR into ' +
      '{defaultBranch}, a sub-PR into a feature branch, or a standalone PR. It keeps its status ' +
      'comment current and works on it while CI is red or it conflicts. The other skills hand their ' +
      'pull requests to it.',
    group: 'build',
    when: 'Use it when a pull request needs opening or updating, or its CI is red or it conflicts.',
    example: {
      type: '/omni:pr',
      result: 'the pull request opened or updated, its status comment kept current',
    },
  },
  {
    name: 'pr-care',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:pr-care <n> [--once]'],
    label: '/omni:pr-care <n>',
    summary: "look after a PRD's feature PR until it is merged",
    detail:
      "Looks after PRD n's feature PR, round by round, until it is merged or closed or you stop it: " +
      'it merges {defaultBranch} on a conflict, fixes red CI, then judges each review comment against ' +
      "the repository's review form and fixes it, pushes back with a reason, or leaves it for the " +
      'PM. A reviewer who answers again gets the PM, not an argument. It pushes nothing while a ' +
      'wave is building, shows on the PRD page that it is watching, and never merges. --once runs ' +
      'one round and returns, for /omni:drive.',
    group: 'build',
    when: 'Use it when a feature PR is ready and you want CI, conflicts and review comments handled while you do other things.',
    example: {
      type: '/omni:pr-care 790',
      result: 'each review comment fixed, pushed back with a reason, or left for you, and the PR kept green',
    },
  },
  {
    name: 'drive',
    kind: 'skill',
    who: 'you',
    usage: ['/loop /omni:drive [<n>…]', '/loop /omni:drive --roadmap <n>'],
    label: '/omni:drive [<n>…]',
    summary: 'drive your PRDs, several steps at once',
    detail:
      'Run under /loop, it drives your own PRDs in inbox, building or outbox, or the ones you name. ' +
      'Its first tick orders every slice of them into a loop plan (omni next --plan), colliding ' +
      'territories in series with the reason, and opens the loop on the Loop page. Each tick then ' +
      'takes the first step not done and runs that one skill (/omni:wave, /omni:yolo, /omni:yolo-fix ' +
      "or /omni:pr-care --once) or waits, parks a PRD waiting on a person on its feature PR's status " +
      'comment, records the tick on the Loop page and picks when to look again. It fills a pool: ' +
      'each step omni next offers runs as its own background agent in its own worktree, up to ' +
      'limits.parallelSteps (default 3) at once, and a step that would collide is held with why; ' +
      'limits.parallelSteps: 1 runs one step per tick. Once nothing runs and every PRD is ' +
      'parked or done it stops itself and lists what waits on whom. A closed terminal resumes the ' +
      "same loop. --roadmap <n> drives exactly roadmap n's PRDs, someone else's included, holding a " +
      "blocked PRD until its blockers' feature PRs merged, naming the pull request it waits on, and " +
      "sends the roadmap's page where each PRD stands after every tick. In a plan repository it " +
      'prints the /omni:mega-drive line and stops. It never answers the outbox and never merges ' +
      'into {defaultBranch}.',
    group: 'build',
    when: 'Use it when PRDs are merged into the inbox and you want them built, finished and cared for without typing each next command.',
    example: {
      type: '/omni:drive',
      result: 'one tick: the loop plan, then its first step; under /loop, every tick until your PRDs wait on you',
    },
  },
  {
    name: 'mega-drive',
    kind: 'skill',
    who: 'you',
    usage: ['/loop /omni:mega-drive [<n>…]', '/loop /omni:mega-drive --roadmap <n>'],
    label: '/omni:mega-drive',
    summary: 'drive PRDs across repositories, steps side by side',
    detail:
      'The /omni:drive of a plan repository: run under /loop, it drives your own multi-repository ' +
      'PRDs, the ones you name, or with --roadmap <n> exactly roadmap n\'s. Its loop plan puts two ' +
      'steps in series only when they touch the same path in the same repository. Its steps run ' +
      'as a pool of background agents, up to limits.parallelSteps at once, each PRD with its own ' +
      'target clones at <worktrees>/targets/<name>@<prd>, so no two steps share a HEAD. Each step runs ' +
      'one skill (/omni:ultra-wave, /omni:ultra-yolo, which plans a PRD with no plan, ' +
      '/omni:ultra-yolo-fix or /omni:mega-pr-care --once) or waits, parks a PRD waiting on a ' +
      "person on its plan PR's status comment naming each open PR by repository, records the " +
      'repositories the tick touched on the Loop page, and under --roadmap sends the roadmap\'s ' +
      'page. Outside a plan repository it prints the /omni:drive line and stops. It never answers ' +
      'the outbox and never merges into any default branch.',
    group: 'multi-repo',
    when: 'Use it when multi-repository PRDs are merged into the inbox of a plan repository and you want them built in every target without typing each next command.',
    example: {
      type: '/omni:mega-drive',
      result: 'one tick across the repositories; under /loop, every tick until your PRDs wait on you',
    },
  },
  {
    name: 'invade',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:invade [--refresh]'],
    label: '/omni:invade',
    summary: "set up this repository's knowledge base",
    detail:
      "Sets up this repository's knowledge base from what the repository can prove: it explores it " +
      'without changing it, shows one map and takes every answer in one message, then writes ' +
      "proposed entries and fills the playbook's forms from evidence, leaving a question for a " +
      'person where proof is missing. It ends with one docs-only PR a person merges. --refresh ' +
      'redoes only what went stale.',
    group: 'setup',
    when: 'Use it when a repository has no knowledge base yet, or when its knowledge base went stale.',
    example: {
      type: '/omni:invade',
      result: 'one docs-only PR with proposed entries and the playbook filled',
    },
  },
  {
    name: 'mega-invade',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:mega-invade [--sync]'],
    label: '/omni:mega-invade',
    summary: 'make this a plan repository that knows its targets',
    detail:
      'Makes this repository a plan repository: it reads the repositories its guide names and its ' +
      'config lists through gh, without cloning, shows one map and takes every answer in one ' +
      'message: target or not, its role, and for one without its own knowledge base whether to ' +
      'import a draft of it. It writes the plan section of the config and each imported copy, from ' +
      'a read-only clone in which nothing runs, and ends with one docs-only PR a person merges. It ' +
      'never writes in a target. omni targets then reports each one; --sync redraws only what ' +
      'changed in the stale copies.',
    group: 'multi-repo',
    when: 'Use it when a change spans several repositories and you want one repository to plan them.',
    example: {
      type: '/omni:mega-invade',
      result: 'one docs-only PR with the plan section of the config and its targets',
    },
  },
  {
    name: 'ask',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:ask on|off|status'],
    label: '/omni:ask on|off',
    summary: "answer Claude's questions on a web page",
    detail:
      'Switches ask mode on or off in this checkout, or says whether it is on. While it is on, ' +
      'every question Claude asks goes to a web page, a tab per terminal, and the terminal takes ' +
      'over whenever the page cannot answer. It needs a sign-in first: omni signin, once per computer.',
    group: 'everyday',
    when: "Use it when you would rather answer Claude's questions on a web page than in the terminal.",
    example: {
      type: '/omni:ask on',
      result: 'ask mode on, and the link of the page that shows the questions',
    },
  },
  {
    name: 'status',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:status [--fetch]'],
    label: '/omni:status',
    summary: 'where your PRDs are',
    detail:
      'Runs omni status inside Claude and prints its overview as is: how many PRDs sit at each ' +
      'stage of the loop, from PRD through inbox, building and outbox to shipped and retro, and the PRDs that are ' +
      'yours, each with where it stands. It fetches first only when you ask for fresh data, and ' +
      'never runs the outbox gate of one PRD.',
    group: 'everyday',
    when: 'Use it when you want to know where your PRDs stand without leaving Claude.',
    example: {
      type: '/omni:status',
      result: 'how many PRDs shipped, wait in the inbox or the outbox, and yours',
    },
  },
  {
    name: 'help',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:help [<name>]'],
    label: '/omni:help [<name>]',
    summary: 'this page, or one command or skill',
    detail: 'Runs omni help inside Claude and prints its output as is: this page, or, given a name, one command or skill.',
    group: 'everyday',
    when: 'Use it when you want the loop explained, or what one command or skill does.',
    example: {
      type: '/omni:help yolo',
      result: 'what /omni:yolo does, when to use it and an example',
    },
  },
  {
    name: 'prove',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:prove <n>'],
    label: '/omni:prove <n>',
    summary: "film a ready PRD's acceptance criteria as proof",
    detail:
      "Records PRD n's acceptance criteria as evidence once its feature PR is ready: one headless " +
      "Playwright clip per criterion against the PR's preview, at most 10, each capped at " +
      'proof.maxSeconds, with a pass or fail verdict; a criterion no browser can show is marked ' +
      "unfilmable, with why. It sends the run to the PRD's Proof tab with omni proof push, then " +
      'posts one unsigned comment on the feature PR: a line per criterion and the link. It stops ' +
      'with one line when proof.url is not set, and never blocks: the PR keeps its state, labels ' +
      "and checks. /omni:yolo runs it after ready when the spec says proof: video.",
    group: 'everyday',
    when: "Use it when a PRD's feature PR is ready and the reviewer should see each criterion work before merging.",
    example: {
      type: '/omni:prove 798',
      result: 'a comment on the feature PR with a ✓, ✗ or — line per criterion, and the Proof tab full of clips',
    },
  },
  {
    name: 'enforce',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:enforce <n>'],
    label: '/omni:enforce <n>',
    summary: 'a law issue, to one PR with its test proven',
    detail:
      'Turns one law issue, a rule or an invariant of the knowledge base that reads Enforced by: ' +
      'pending #<n>, into one PR into {defaultBranch}: it writes the law\'s test where the testing ' +
      'form says tests live, then proves it, red with the law broken in the code and green once the ' +
      "code is restored, the break never committed. It rewrites the entry's pending #<n> to the " +
      "test's path on a law branch, and the PR closes the issue, its report showing the red and the " +
      'green. A test that cannot go red stops it, with a comment on the issue, the law left pending ' +
      'and no PR. It runs only where laws live in the knowledge base, and never merges.',
    group: 'everyday',
    when: 'Use it when a law issue waits for its test and you want one PR a person merges, without writing the test yourself.',
    example: {
      type: '/omni:enforce 1400',
      result: "one PR adding the law's test, seen red with the law broken and green restored, closing the issue",
    },
  },
  {
    name: 'validate-e2e',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:validate-e2e <n>'],
    label: '/omni:validate-e2e <n>',
    summary: 'beta: keep a PRD criteria as e2e tests',
    detail:
      "Writes one e2e test per filmable acceptance criterion of PRD n, tagged prd-n, from the spec " +
      'alone; records each once, replays it with --strict-cache, and checks the recordings with ' +
      'omni e2e status and omni e2e heals. It opens a sub-PR into the feature branch holding the ' +
      'tests, their committed recordings and a criterion, test and verdict table. It stops with one ' +
      'line when e2e.enabled is false, e2e.url is null or Node is older than 24.8, and merges ' +
      'nothing. /omni:yolo runs it by itself after ready when the spec says e2e: validate.',
    group: 'everyday',
    when: 'Use it when a PRD\'s feature PR is ready and its criteria should keep being checked after it merges.',
    example: {
      type: '/omni:validate-e2e 1233',
      result: 'a sub-PR with the e2e tests, their recordings and a verdict per criterion',
    },
  },

  {
    name: 'pitch',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:pitch <n> --for customers|inside'],
    label: '/omni:pitch <n>',
    summary: 'an animated video and GIF announcing a shipped PRD',
    detail:
      "Makes a launch video for shipped PRD n, for customers or for inside, from the product's Pitch " +
      'settings (look, voice, intro and outro, music, length): a walk-through filmed on production that ' +
      'never saves, deletes or changes anything, writing the moments it acts on; a storyboard written ' +
      'from the spec, the release note and those moments only, in the voice the settings ask for, never ' +
      'inventing a number, a name or a capability whatever the instructions say; then omni pitch check, ' +
      'one still per scene looked at before the render, pitch.mp4, pitch-square.mp4 and pitch.gif, sent ' +
      "to the PRD's Pitch tab with omni pitch push. It refuses with one line a PRD not shipped, a " +
      'proof.url that is not fixed, no ffmpeg or no sign-in, and posts no comment.',
    group: 'everyday',
    when: 'Use it when a PRD has shipped and you want to announce it to customers or at an all-hands.',
    example: {
      type: '/omni:pitch 859 --for customers',
      result: "a 20 to 40 second pitch.mp4 in the product's look, pitch-square.mp4 and pitch.gif, on the PRD's Pitch tab",
    },
  },

  // Skills other skills run.
  {
    name: 'pixel-perfect',
    kind: 'skill',
    who: 'you',
    usage: [
      '/omni:pixel-perfect critique [target]',
      '/omni:pixel-perfect audit [target]',
      '/omni:pixel-perfect polish [target]',
      '/omni:pixel-perfect harden [target]',
      '/omni:pixel-perfect typeset [target]',
      '/omni:pixel-perfect layout [target]',
      '/omni:pixel-perfect adapt [target]',
      '/omni:pixel-perfect clarify [target]',
      '/omni:pixel-perfect review',
    ],
    label: '/omni:pixel-perfect',
    summary: 'design craft on a screen, following the product',
    detail:
      'Design craft imported from impeccable (Apache-2.0) and tailored. It runs only when the config ' +
      'sets design.enabled to true (off, it says how to turn it on and stops), then reads the design ' +
      'form, omni kb show design. The product wins: the form\'s product, system and deliberate ' +
      'sections override the craft floor and the refuse list. critique and audit review a screen, ' +
      'polish and harden finish it, typeset, layout, adapt and clarify fix one side of it, and every ' +
      'edit first reads the craft floor. review is the bounded auto-review /omni:do-work and ' +
      '/omni:visual-fix follow on UI work: critique, audit, the design lint (commands.design, when ' +
      'set), screenshots at the form\'s widths (390 and 1440 by default) beside the mockup, then one ' +
      'batch of polish and one confirming look. Fixes stay inside the slice\'s territory; what it ' +
      'leaves becomes an outbox item. It never blocks a slice, a wave or a gate.',
    group: 'everyday',
    when: 'Use it when a screen should look and read like your product, before or after it is built.',
    example: {
      type: '/omni:pixel-perfect polish the quote page',
      result: 'one batch of fixes in your tokens and components, checked at mobile and desktop widths',
    },
  },
  {
    name: 'dossier-open',
    kind: 'skill',
    who: 'skills',
    usage: ['/omni:dossier-open "<one line of the idea>"'],
    summary: 'open a draft dossier for an idea',
    detail:
      'Opens a draft dossier for an idea on the Omni page, linked to this Claude session, so the ' +
      'people the idea is for can follow it before the first question is asked. /omni:brainstorm ' +
      'and /omni:think-big run it first; it never stops the skill that runs it.',
    group: 'run-by-skills',
    when: 'Use it when an idea should be followed on the Omni page before its first question.',
    example: {
      type: '/omni:dossier-open "a skills page in the docs"',
      result: 'the draft dossier\'s link, as "follow along at …"',
    },
  },
  {
    name: 'dossier-push',
    kind: 'skill',
    who: 'skills',
    usage: ['/omni:dossier-push <n> [--kind visual|bug|concept]'],
    summary: "send a PRD's files to its dossier",
    detail:
      "Sends PRD n's spec, plan and before/after page to its dossier on the Omni page, adding a " +
      'version only where a file changed. /omni:brainstorm runs it after each of its pushes, and ' +
      '/omni:plan after it pushes the plan; /omni:visual-fix and /omni:bug-fix run it with --kind ' +
      'visual or --kind bug for their fix\'s page, and a concept\'s record runs it with --kind concept ' +
      'for the concept\'s page under Work › Concepts. It never stops the skill that runs it.',
    group: 'run-by-skills',
    when: "Use it when a PRD's spec, plan or before/after page changed and its dossier should show it.",
    example: {
      type: '/omni:dossier-push 580',
      result: "the dossier's link and the versions it added",
    },
  },
]);
