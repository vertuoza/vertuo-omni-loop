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
    also: [['omni status <n>', 'the outbox gate for PRD n (exit 0 green, 1 red)'], ['omni status <key>-<n>', 'a product PRD\'s gate, read from the Omni page']],
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
    name: 'sync',
    kind: 'command',
    who: 'you',
    usage: ['omni sync [--json | --quiet | --background] [--strict]'],
    label: 'omni sync',
    summary: 'whether this checkout is in sync before you plan on it',
    detail:
      'Runs four checks and prints one line each, heaviest first: main (how far behind ' +
      '{remote}/{defaultBranch} you are, and on which branch), kit (the kit and the plugins against ' +
      "the latest release), knowledge (stale evidence, the targets' copies) and page (your sign-in, " +
      "the Omni page's copy), then a fix line. Its status is 🟢 In sync; 🟠 Needs action; 🔴 Out of " +
      'sync, which for main means a missing commit older than a day; or 🔵 Setting up, a newcomer\'s ' +
      'four steps (the two plugins, the sign-in, main pulled), shown until they first all hold. The ' +
      'sync block of the config sets the order, the highest colour each check may show, and when ' +
      'main turns red. It keeps the result for the status line and the HUD. --json prints it as ' +
      'kept, --quiet only refreshes it, --background refreshes it without waiting, and --strict ' +
      'exits 1 on 🔴; otherwise it always exits 0.',
  },
  {
    name: 'prd',
    kind: 'command',
    who: 'you',
    usage: ['omni prd <n>', 'omni prd <key>-<n> [--show <kind>]'],
    label: 'omni prd <n>',
    summary: 'where PRD n lives and its files',
    detail:
      'Where PRD n lives today: its state, inbox or shipped, its folder, the files in it, its ' +
      'outbox folder and the open items waiting there. The folder is the status, so this is the ' +
      'one lookup the skills run before following any delivery path. Where dossiers are on, its last ' +
      'line is the product its dossier on the Omni page names, product: <name> or product: none, or ' +
      'product: unknown with why when the page cannot tell. Exit 1 when the PRD is in ' +
      'neither {inbox} nor {shipped}. A product PRD, as mobile-12, is read from the Omni page: its stage ' +
      'from its approval, birthplace: server, its approval lines, its page and its product; --show <kind> ' +
      'prints its latest spec, plan, before-after or voice, read-only, as of when it was read, and the ' +
      'last copy read while the server is down. mobile, 12-mobile and Mobile-12 are refused by name.',
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
      'it as one document, the one /omni:wave acts on, with base: whether the branch the next wave ' +
      'builds on is behind the default branch (a phase-0 merged after the plan), so the wave merges ' +
      'it in first. Needs gh logged in.',
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
    usage: ['omni check [config|inbox|outbox|knowledge|kb|releases|design|', '  coverage|context|all] [--base <ref>] [--prd <n>] [--retro <prd>]'],
    label: 'omni check [all]',
    summary: "the repository's guards",
    detail:
      "The repository's guards, each printing its violations or one line saying it passed: config " +
      '(the config file, its flow and every hook file the flow names, each refusal naming its key), inbox ' +
      '(the PRDs waiting to be built, a spec\'s front matter included: e2e: validate is the only value of e2e), outbox (the open items), knowledge (the registers), kb (the ' +
      "playbook's forms), releases (the release notes), retro (the outcome of each lesson a retro " +
      'kept: a became naming a filled playbook slot, a staysHere giving its reason; with --retro, ' +
      "the PRD a retro PR carries, every kept lesson of its retro has one), coverage (every risky change of a branch " +
      'accounted for, against --base) and context (what every agent session reads, held to the ' +
      'ceilings of budgets.context.file against --base: red on a target over budget, or on a ceiling ' +
      "raised with no person's yes, a settled raise item of the branch's PRD or --prd; neutral, exit " +
      '0, when a target cannot be measured). all, the default, runs every one, skips coverage when ' +
      '{remote}/{defaultBranch} has not been fetched, and runs context only while ' +
      'budgets.context.enabled is true. Exit 1 on any violation.',
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
    usage: ['omni kb show <form> [--json] [--all]', 'omni kb status [--json]', 'omni kb graph [<id> | --paths <file>…] [--depth <1-3>] [--json]', 'omni kb graph --product <key> <id> [--depth <1-3>] [--json]', 'omni kb graph push', 'omni kb index [--json]', 'omni kb legal', 'omni kb glossary', 'omni kb legal add --code <CODE> --statement "<text>" --source "<law>"', '  [--product <name>] [--json]', 'omni kb legal edit <id> [--statement "<text>"] [--source "<law>"]', '  [--product <name>] [--json]', 'omni kb glossary add --term "<term>" --meaning "<text>" [--avoid <a,b>]', '  [--product <name>] [--json]', 'omni kb glossary edit "<term>" [--meaning "<text>"] [--avoid <a,b>]', '  [--product <name>] [--json]', 'omni kb init'],
    label: 'omni kb show <form>',
    summary: 'one form of the playbook',
    detail:
      'The playbook: one form per question an agent asks while delivering (testing, architecture, ' +
      'conventions and more). show prints one form section by section, each saying where it comes ' +
      "from: this repository's own words, a page it points to, or the kit default; show decisions " +
      'lists the latest 20 decision records, and --all every one. status prints ' +
      'the map of every form and register and every open question; graph the knowledge registers ' +
      "as one graph, or with an <id> the neighbourhood of one entry (--paths <file>… for every entry " +
      'that governs the files, --depth 2 or 3 to walk further, --json for the versioned neighbourhood ' +
      'document); graph push sends the whole repository graph, at HEAD, to the Omni page ' +
      '(a clean knowledge folder and a sign-in needed); index prints the capped block a session ' +
      "starts with (PRD 2299): the product's words with the ones to avoid, its Legal entries, its personas, " +
      'at most 3 KB, from the Omni page or the last copy with its age, one line with neither, and always ' +
      'exit 0 within 3 seconds, --json for the state and the lists; legal and glossary print ' +
      "the product's active Legal entries and its glossary " +
      'terms, one line each, read from the Omni page and kept as a local copy, which they print, ' +
      'saying so, when the page is unreachable; legal add and edit, glossary add and edit add or change ' +
      'one entry or term as you, signed in with omni signin or OMNI_TOKEN: an edit changes only the ' +
      'fields given and names its item by the id or term the reads print, and --product names the ' +
      'product when the repository is in several. They print added <id>, edited <id> or proposed (a ' +
      "member who does not own the section proposes, and waits for its owner) with the item's link; " +
      "--json prints the page's answer, a refusal exits 1 and wrong usage 2. Nothing is removed or " +
      'retired from the terminal; init lays down every missing form, blank, and ' +
      'changes no file that exists.',
  },
  {
    name: 'knowledge',
    kind: 'command',
    who: 'you',
    usage: ['omni knowledge <id>', 'omni knowledge judge [<id>]'],
    label: 'omni knowledge <id>',
    summary: 'one rule of the knowledge base',
    detail:
      'One entry of the knowledge base, a principle, a rule or an invariant, by its id (such as ' +
      'P-PRODUCT-1), with every entry that serves it. A proposed entry says who proposed it and ' +
      'when: it describes the product, but it is no law until a person confirms it. judge is the ' +
      'sweep: it asks of every rule and invariant whose Enforced by: is unenforced whether it is ' +
      'worth a law, the model first, then omni decide law-worth. A yes opens its law issue and ' +
      'reads pending #<n>; a no leaves its register for its PRD\'s settled.md, and every entry ' +
      'still citing it is named. judge <id> judges that one law alone, the same way. Once each one ' +
      'is judged it sets laws.requireProof: true. It ' +
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
    name: 'setup-token',
    kind: 'command',
    who: 'you',
    usage: ['omni setup-token [--name <name>] [--days 30|90|365]'],
    label: 'omni setup-token',
    summary: 'make a token for a cloud session',
    detail:
      "Makes a token that signs the kit in where no browser opens, such as a Claude Code cloud session: " +
      'it opens the Omni page in your browser, as omni signin does, then prints the token once, the ' +
      'day it expires, and the line to paste it by, OMNI_TOKEN=<token>, in your cloud environment\'s ' +
      'variables. It keeps the token nowhere. --name defaults to terminal and today\'s date; --days ' +
      'is 30, 90 or 365, 90 by default. Revoke a token on your profile page.',
  },
  {
    name: 'runner',
    kind: 'command',
    who: 'you',
    usage: ['omni runner --name <name> --repos <dir> [--slots 4] [--timeout 3h]', 'omni runner sender', "omni runner send '<line>' [--to <runner|fleet>]", 'omni runner follow <n>'],
    label: 'omni runner',
    summary: 'run the lines the Omni app sends, on this machine',
    detail:
      'Makes this machine a runner: it registers with the Omni page under --name, shows on its Runners ' +
      'page, and runs the /omni: lines people send it with Send to terminal, at most --slots at once (4 ' +
      'by default, 8 at most). It signs in as every omni command does (OMNI_TOKEN, else omni signin), ' +
      'holds the git checkouts right under --repos, by their origin, and refuses to start when claude ' +
      'is missing or signed out, or tmux is missing. Each job runs in a worktree ~/wt/<repo>-job-<id> ' +
      'on branch agent/job-<id>, in the tmux session job-<id>; its line goes to claude from a file, ' +
      'never a shell. claude runs with --output-format stream-json: each step becomes one readable ' +
      'line (Bash: <command>, Edit: <path>, PR: <link>, a failed call\'s ✗ with up to 20 lines of its ' +
      'output, Done: with its turns and cost), written to ~/logs/job-<id>.log and the session, while ' +
      'the raw stream stays on the machine in ~/logs/job-<id>.jsonl. Every 5 s the runner sends the ' +
      'log\'s new lines, those after the last the app accepted, at most 2,000 lines and 256 KB per ' +
      'report, sending them again when a report fails and every line left once the job ends: the ' +
      'Runners page shows them live in its Terminal panel. Only yolo, yolo-fix, pr-care, do-work, wave, bug-fix, ' +
      'mega-bug-fix, visual-fix, plan, pitch, prove, retro-apply, rewind and knowledge-add run. A job past --timeout (3h by default) is stopped; Ctrl-C ' +
      'waits for the running jobs. It also keeps the Omni plugin current, since a job runs the skills ' +
      'the plugin holds: before Claude starts, a plugin older than the omni the job\'s repository ' +
      'pins is updated (once, however many slots start together), and one still older fails the job ' +
      'with omni plugin v<x> is older than <owner/repo>\'s omni v<y> and its update\'s last line; a plugin ' +
      'not installed fails it with the line to install it; a list that does not read lets the job ' +
      'run, its log saying so. At start and once an hour it updates the plugin, printing a line only ' +
      'when its version changed or the update failed. sender prints the line /omni:pr writes in a ' +
      'pull request a job opens, naming who sent it and the runner. send "<line>" [--to <runner|fleet>] ' +
      'queues a line for this repository\'s workspace with your own sign-in and prints the job\'s id (a line no ' +
      'runner runs is refused before any call; --to names a runner, else a fleet). follow <n> finds the PRD\'s ' +
      'newest job in this repository and prints one line per milestone until it ends (queued, claimed by <runner>, ' +
      'waiting for approval, PR: <link>, <k>/<total> slices merged, then Waiting on answers, Held, Ready, Done, ' +
      'Failed: <reason>, Cancelled or Runner lost, with the PRD page link): exit 0 on done, 1 on failed, cancelled ' +
      'or runner lost; Ctrl-C stops the following only, the job runs on.',
  },
  {
    name: 'dossier',
    kind: 'command',
    who: 'you',
    usage: [
      'omni dossier open "<title>"', 'omni dossier push <n> [--kind visual|bug|concept]', 'omni dossier link <n> [--kind visual|bug|concept]', 'omni dossier status',
      'omni dossier push --product <key> --new [--from <dir>] [--title "<title>"]', 'omni dossier push <key>-<n> [--from <dir>]', 'omni dossier get <key>-<n> <kind>',
    ],
    label: 'omni dossier …',
    summary: "a PRD's dossier on the Omni page",
    detail:
      "A PRD's dossier on the Omni page, where the whole workspace reads every version of its " +
      'spec, plan and before/after. open opens a draft for an idea, tagged with the session id ' +
      "(OMNI_SESSION_ID, else Claude Code's, else one it generates and keeps for the checkout in " +
      '.omni-loop/local/session.json), and prints its link; push sends ' +
      "PRD n's files and adds a version only where a file changed; link prints PRD n's page, on " +
      'any computer, or none when it has no dossier, and writes nothing; status says whether ' +
      'dossiers are on here. With --kind visual or --kind bug, push and link work on issue n\'s fix ' +
      'instead: its visual update or bug fix page, filled from its folder. With --kind concept, they ' +
      'work on concept n, its issue\'s number: its page under Work › Concepts, filled from its ' +
      'concept.md, vision tour, boards and debate. With --product <name>, a PRD\'s push names the product ' +
      'the brainstorm asked for, for a repository in several products: the first push makes it the ' +
      'PRD\'s product, and a repository in one product or none decides alone. A product PRD, as mobile-12, ' +
      'lives on the Omni page and in no repository: push --product <key> --new creates the product\'s next ' +
      'PRD from the files of --from and prints its id; push <key>-<n> saves the edited files of --from as ' +
      'new versions; get <key>-<n> <kind> writes the latest spec, plan, before-after or voice to a scratch ' +
      'file and prints its path and its sha256, and holds while the server is down. It never holds up the ' +
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
    usage: ['omni proof push [--kind bug] <n> <dir>', 'omni proof session [<file>]'],
    summary: "sends a proof run to a PRD's Proof tab or a bug's page, or signs its browser in",
    detail:
      "Sends a proof run /omni:prove recorded to PRD n's dossier on the Omni page and prints its Proof " +
      "tab's link; with --kind bug it sends the run to the bug dossier of issue n and prints the bug " +
      "page's link, then the GIF's stable link, then, for a run that holds before.webm or after.webm, " +
      'one stable link per clip, before first: GET /api/proofs/<run>/<clip> answers a redirect to a ' +
      'signed link, any other name a 404. It reads ' +
      'run.json in the folder, and refuses before sending anything a file that is not .webm, .gif, ' +
      '.ts or .txt, or one over 50 MB. Then it uploads each clip and script, and registers the run. ' +
      'It never holds up the skill that runs it: anything that stops it exits 1 with one line, as ' +
      'omni dossier link does. omni proof session writes the signed-in browser session a run films ' +
      'with, from your omni signin, to <file> or PROOF_STORAGE_STATE: set proof.setup to it.',
  },
  {
    name: 'before-after',
    kind: 'command',
    who: 'skills',
    usage: ['omni before-after new <n> --services <name>,<name>… [--force]', 'omni before-after render <n>'],
    summary: "writes a PRD's before/after page in two tabs, and draws its diagrams",
    detail:
      'The verbs /omni:brainstorm runs. new writes before-after.html into PRD n\'s inbox folder from the ' +
      "kit's skeleton: the Functional & design tab first and open, the Technical tab second, one block " +
      'per named service in each, every section a <!-- FILL --> to replace with filled, na or gap. It ' +
      'refuses, writing nothing, a PRD with no inbox folder, a page already there unless --force, and ' +
      'a missing or empty --services, each with one line and exit 1. render replaces each ' +
      '<pre class="mermaid"> of the page with the SVG Mermaid draws for it, inline, in a headless ' +
      'Chromium from the repository\'s Playwright; it prints one line per diagram and refuses, with the ' +
      'install line, when no browser starts. omni check inbox grades a page of this shape: both tabs, ' +
      'a valid state on every section, no FILL marker, no diagram left unrendered, no external resource.',
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
    usage: ['omni constituents [--json]', 'omni constituents add --statement "<text>" | --never "<text>"', '  [--product <name>] [--json]', 'omni constituents edit statement|never#<n> --text "<text>"', '  [--product <name>] [--json]'],
    summary: "the product's Statement and Never list, read at every session's start",
    detail:
      "Prints the constituents of the product this repository serves: its Statement (what the product " +
      'is) and its Never list (what it must never become or do, each line with its never#<n> id), as an ' +
      'owner wrote them on Settings › Business. The plugin runs it when a session starts, so they come ' +
      'before the briefing. It reads them from the Omni page with your omni signin, keeps a copy on this ' +
      'computer, and says "synced just now"; offline or failing, it prints that copy with its age. With ' +
      'no copy, no product or no sign-in it prints one line. It always exits 0 within 3 seconds. --json ' +
      'prints the same for skills: state, product, statement, never and syncedAt. add and edit change them ' +
      'as you, signed in with omni signin or OMNI_TOKEN: add --statement or --never saves a Statement ' +
      'or a new Never line, edit statement or edit never#<n> with --text rewrites one, and --product ' +
      'names the product when the repository is in several. They print added <id> or edited <id> with ' +
      "the item's link; --json prints the page's answer. Only a workspace owner changes a constituent: " +
      "a member's refusal is printed in the page's words and exits 1, wrong usage exits 2. Reading " +
      'is unchanged and a change never writes its copy. Nothing is removed from the terminal.',
  },
  {
    name: 'session',
    kind: 'command',
    who: 'skills',
    usage: ['omni session start', 'omni session end'],
    summary: "a session's start and end, for any coding agent, with no hook",
    detail:
      'start is what an agent runs first: it prints the constituents (as omni constituents does), then ' +
      'the sync block (as omni sync does: from the cache when it is under 15 minutes old, else after a ' +
      'refresh of at most 15 seconds, else the cache with its age, or sync: not checked yet), then ' +
      'the briefing (as omni kb show briefing does), then a last line session: <id>. The id is ' +
      "OMNI_SESSION_ID, else CLAUDE_CODE_SESSION_ID, else the one stored for this checkout; with none, " +
      'it makes one and stores it, so every later omni command of the checkout uses the same session. ' +
      'end is what an agent runs last: it closes the session on your ask page and tells the Omni page ' +
      'the session stopped. Both print what they can and always exit 0, the Omni page reachable or not.',
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
    usage: ['omni init [--force] [--setup <cmd>] [--test <cmd>]', '  [--preflight <cmd>] [--preflight-full <cmd>]'],
    summary: 'install the loop on this repository',
    detail:
      'Installs the Omni Loop on the repository it runs in: writes .omni-loop/config.yml, copies ' +
      'the running omni to .omni-loop/bin/omni.mjs, lays down the blank playbook forms and creates ' +
      'the loop labels the repository lacks, switches the status line on in .claude/settings.json, ' +
      'then prints the steps a person still has to take. It writes nothing outside .omni-loop/ but ' +
      "that statusLine key, and never replaces someone else's. --force writes the config, the copy " +
      "and the kit's own status line again; --setup gives the command that prepares a fresh " +
      'checkout (its install), and the other flags give the commands that test the repository.',
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
    name: 'worktrees',
    kind: 'command',
    who: 'you',
    label: 'omni worktrees …',
    usage: ['omni worktrees list [--json]', 'omni worktrees prune [--prd <n>] [--dry-run]', 'omni worktrees remove <path>', 'omni worktrees hint'],
    summary: "remove the kit's worktrees once their work is pushed",
    detail:
      "A worktree is the kit's when it sits under the worktrees folder on a slice, feature or " +
      'phase-0 branch; every other one is never touched. A kit worktree is kept, with its reason, ' +
      'while it has an uncommitted change, a commit no remote branch holds, a slice still claimed or ' +
      'red while its feature PR is open, or a process working inside it. list prints every worktree ' +
      'and each verdict, safe or kept. prune removes the safe ones (of one PRD with --prd), printing ' +
      'removed or kept per worktree and the space freed; --dry-run removes nothing. remove applies ' +
      'the same rules to one worktree, a detached one included. hint prints how many could go, with no ' +
      'network. It removes with git worktree remove and git branch -d, never by force, and exits 0 ' +
      'whatever it keeps.',
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
    name: 'conventions',
    kind: 'command',
    who: 'you',
    label: 'omni conventions',
    usage: ['omni conventions [--root <dir>] [--json]'],
    summary: 'where a directory writes its conventions',
    detail:
      'Prints an index of the files where a directory, this repository or a clone given with --root, ' +
      'writes its conventions: CLAUDE.md and AGENTS.md with the files they import through @<path>, ' +
      'the files its omni config lists under paths.context, the readme of its docs folder, the readme ' +
      'of the adr folder inside it (else each ADR), and the Markdown pages those link to, one level deep and inside ' +
      'the directory. One line each: its path, its title and the file that led to it; a link to a ' +
      'file that does not exist reads missing. Read the pages that bear on a design before naming ' +
      'anything. --json prints the same entries as an array of { path, title, from, missing }. It ' +
      'reads files only and needs no omni config. Exit 1 when --root is not a directory.',
  },
  {
    name: 'product',
    kind: 'command',
    who: 'you',
    label: 'omni product …',
    usage: ['omni product import --product <name>', 'omni product which', 'omni product use <key>', 'omni product phase0 <owner/name>…'],
    summary: "plan targets into a product; this repo's products",
    detail:
      'omni product import --product <name> copies the targets of this plan repository, its ' +
      'plan.targets, into the product of that name on the Omni page, with your sign-in: each ' +
      'target becomes a repository link with its role, knowledge, read-at commit, read-only flag ' +
      'and what it consumes, an existing link is changed to match, and it prints what it added and ' +
      'changed. A second run changes nothing. It never edits the config: swap targets for ' +
      'product: <name> in the plan section yourself, and omni targets then reads the links from ' +
      'the product. Only an owner of the workspace changes its links. omni product which prints ' +
      'the products this repository is in, one per line, or none, after remembered: <key> when this ' +
      'checkout remembers one. Either exits 1, with one line saying why, when there is no Omni page ' +
      'or sign-in, or the page is unreachable or refuses. omni product use <key> remembers the ' +
      'product this checkout runs from, for every worktree of it, so a product PRD (mobile-12) is ' +
      'built from here with no plan repository. omni product phase0 <owner/name>… reads each ' +
      "repository's phase-0 flag and prints one line each, refusing by name any not on server, which " +
      'a product PRD cannot land in. Exit 0 when every one is on server, 1 otherwise.',
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
      'omni settle <item-id> --prd <key>-<n>',
      '  (--answer "<text>" | --answer-file <path>)',
      '  [--verdict agreed|drifted]',
    ],
    summary: 'settle one answered outbox item',
    detail:
      "Settles one open outbox item with the answer a person gave: appends the question and the " +
      "answer, word for word, to the PRD's settled ledger, then deletes the open file. The ledger " +
      'is append-only: nothing in it is ever rewritten. With --prd <key>-<n>, settles a product PRD\'s ' +
      'open item on the Omni page, as answered in the terminal.',
  },
  {
    name: 'adopt',
    kind: 'command',
    who: 'skills',
    usage: ['omni adopt <item-text-file>', 'omni adopt <item-id> --prd <key>-<n>'],
    summary: 'adopt a medium outbox item',
    detail:
      "Adopts a medium outbox item, as it is raised or once it is open: appends its entry to the PRD's " +
      'settled ledger and removes the open file. An adopted decision stands unless someone objects ' +
      "later. /omni:wave adopts a wave's medium items once the wave has merged. With --prd <key>-<n>, " +
      "adopts a product PRD's open medium item on the Omni page.",
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
      'omni answers ask <key>-<n> [--json]',
      'omni answers post --prd <key>-<n> --answers <file>',
    ],
    summary: 'answer the outbox from the terminal',
    detail:
      'With ask, prints the open human-action and high questions of the feature PR, in its numbering, ' +
      'at most four at a time. With post, writes the picks as one reply and posts it on the feature ' +
      'PR, where omni replies reads it; --print only prints it. /omni:yolo runs it when its gate ends red. ' +
      "On a product PRD, ask needs no PR, and post settles each answered question on the Omni page.",
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
    name: 'retro',
    kind: 'command',
    who: 'skills',
    usage: ['omni retro outcome <prd> <finding>', "  (--became <playbook/<form>#<slot>> | --stays-here '<why>')"],
    summary: "record what became of a retro's kept lesson",
    detail:
      "Records a kept lesson's outcome: --became names the playbook slot the rule was appended to, " +
      '--stays-here gives the reason it stays here. It writes the outcome in the PRD\'s retro.json, ' +
      'under the run that kept the lesson, and its line under the finding in retro.md. It refuses, ' +
      'writing nothing and exiting 1, an id that does not resolve to a filled slot, an empty reason, a ' +
      'finding the retro did not keep, and a lesson that already has an outcome: an outcome is never ' +
      'rewritten.',
  },
  {
    name: 'rewind',
    kind: 'command',
    who: 'skills',
    usage: [
      'omni rewind facts <prd> [--json]',
      'omni rewind push <prd> --file <findings.json>',
      'omni rewind outcome <finding>',
      "  (--pr <n> | --already <rule> | --asks '<question>')",
    ],
    summary: 'read a PRD\'s watch on main, send the rewind\'s findings to its page, and record what became of an approved one',
    detail:
      "facts prints the PRD's status on main per repository (watching, clean or broke), each break with its " +
      'link, and the findings already on its page; it says so when the PRD has no watch. push sends a file of ' +
      'findings (check, origin, what happened, evidence links, fix) to the PRD\'s Main tab as proposals for a ' +
      'member to approve or reject. It refuses, naming the finding and sending nothing, one with no evidence ' +
      'link, an origin other than repository, omni-setup or knowledge, a check other than main, reviews, ci, ' +
      'bodies, waves, plan, spec or knowledge, and one already proposed (the same check, origin and evidence). ' +
      'outcome records, once, what was done with a finding a member approved, on the id its card carries: ' +
      '--pr <n> names the pull request that proposes the rule, --already <rule> the rule that already says it ' +
      '(one line), --asks <question> the one question asked. The PRD\'s Main tab then shows it on the card. It ' +
      'refuses, recording nothing and exiting 1, a finding not approved and a second outcome of the same ' +
      'finding (an outcome is never rewritten), and, exiting 2, none or more than one of the three. ' +
      'All three need the terminal sign-in of a member of the PRD\'s workspace.',
  },
  {
    name: 'item',
    kind: 'command',
    who: 'skills',
    usage: [
      'omni item new --prd <n> --slice <id> --file <file>',
      '  [--adopt | --out <dir>] [--json]',
      'omni item relay <dir> --prd <n>',
      'omni item new --prd <key>-<n> … · omni item relay <dir> --prd <key>-<n>',
    ],
    summary: 'record a decision an agent took alone',
    detail:
      'Records one decision an agent took without asking as an outbox item, from a JSON file: the ' +
      "kit picks its rank and its id. A decision that would break a named law stops the slice " +
      "instead, and one that needs a person's action blocks it. --adopt sends a medium item " +
      'straight to the settled ledger. --out writes the item to a folder instead of the outbox, ' +
      'for a slice built in another repository, and never adopts. relay moves every item and ' +
      "account of such a folder into PRD n's outbox, checked as new items are; a refused file " +
      'stays in the folder with its reason, exit 2. On a product PRD (--prd <key>-<n>) the outbox is ' +
      'its rows on the Omni page: a checked item becomes a row, and while the server cannot be reached ' +
      'it holds, exit 1.',
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
      'Where the repository asks for contracts, every slice declares one, in its kinds or none, and ' +
      "each declared kind has a data-contract block on the folder's before-after.html. " +
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
    usage: ['omni approval <n> [--json]', 'omni approval restore <n>', 'omni approval flag [--json]'],
    summary: "whether a PRD born on the server is approved, and still what was approved",
    detail:
      "Reads PRD n's approval in force on the Omni page, with your sign-in, and compares each file " +
      'it pinned with the file of the same kind in this checkout. It prints one line: approved by ' +
      'whom and when; waiting for approval, with the PRD page link; a changed or missing file (its ' +
      'content, or its whitespace only), which refuses until you restore it or approve again; the ' +
      'server unreachable, which holds the PRD rather than failing it; or refused, when the approver ' +
      'left the workspace or the page answered an error. It exits 0 only when approved. --json ' +
      'prints the state, who, when and the pinned files. The omni/approved check on the PR says ' +
      'the same, from the same judge. omni approval restore <n> writes each changed or missing ' +
      'file back from the version that was approved, after checking it hashes as pinned, one line ' +
      'per file; when a version cannot be read, or the approval was voided, it says approve again ' +
      'with the PRD page link. It never commits or pushes: review the diff, then push. ' +
      'omni approval flag reads where this ' +
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
    usage: ['omni bug <n> [--base <ref>] [--body-file <file>]', 'omni bug film <n> --before <file> --after <file> [--out <dir>]'],
    summary: 'grade a bug fix branch and its pull request, or film its before and after',
    detail:
      "The proof step of /omni:bug-fix, run on its fix branch: one folder for issue <n> under the " +
      "delivery folder's bugs/, holding a bug.md with its Triage, Reproduction, Fix, Guard and " +
      'Mutation sections, a risk of critical, high, medium or low, a reproduction file the branch ' +
      "changes and its red line, and every commit carrying the loop's signature, unless signing is " +
      'off. It also checks the pull request\'s body: the file of --body-file (the body the skill is ' +
      'about to open), else the open pull request of the current branch, read through gh, else it ' +
      'says how to proceed. Its ## Proof must hold an https:// image with a "- **Before the fix**" ' +
      'and a "- **After the fix**" line, or the line GIF not produced - <reason>; a not-produced ' +
      'proof on an open pull request that is not a draft is refused. A record with a ## Fixes ' +
      'section is not checked for a proof. It runs no test. Prints ok, or not ok with one line per ' +
      'failed check; exit 2 when --body-file cannot be read. --base defaults to ' +
      '{remote}/{defaultBranch}. omni bug film makes the fix\'s ' +
      'before/after GIF. From two .txt outputs of the reproduction (red, then green) the kit draws it ' +
      'itself, with no ffmpeg: two 640×360 cards of 3 seconds each, looping, the failing and passing ' +
      'lines highlighted, the same bytes every run. From two .webm clips it stitches them with ffmpeg ' +
      '(640 pixels wide, looping), and without ffmpeg exits 1 with ffmpeg not found. It writes ' +
      'preview.gif, the two inputs and a run.json that omni proof push --kind bug sends, in --out ' +
      '(by default proof-bug-<n>/<time> under the worktrees folder), and prints that folder; for two ' +
      '.txt it exits 1 only for a folder it cannot write (could not write <path>).',
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
    usage: [
      'omni ask on|off|status',
      'omni ask question --file <q.json> [--wait <seconds>]',
      'omni ask wait <round> [--wait <seconds>]',
      'omni ask answer <round> --file <a.json>',
      'omni ask hook <pre|post|prompt|end>',
    ],
    summary: 'ask mode, and the questions any agent asks the person on the page',
    detail:
      "Ask mode in this checkout: on prints the page where the agent's questions are answered, off " +
      "closes every terminal's session there, status says which. OMNI_ASK=on turns the mode on with " +
      'no omni ask on, as a cloud session needs; OMNI_ASK=off turns it off whatever on wrote. ' +
      'question asks the person on the page from any agent, with no hook: q.json holds questions, ' +
      'as AskUserQuestion takes them, and may add lead and context. It exits 0 with { round, answers, ' +
      'shots } once answered; exits 3, printing nothing, when the agent should ask in its own chat ' +
      '(the mode off, no sign-in, the page unreachable or the round abandoned), the reason on stderr; ' +
      'exits 4 with round <id> when the wait ran out, 110 seconds by default, 10 to 540. wait resumes ' +
      'that round, with the same exits. answer sends what the person said in the chat to the page, ' +
      "marked as given via the terminal, and never fails the agent. hook is what the plugin's hooks " +
      'run around each question; with the mode off it prints nothing. /omni:ask runs on, off and ' +
      'status for you.',
  },
  {
    name: 'heartbeat',
    kind: 'command',
    who: 'skills',
    usage: ['omni heartbeat [--end]'],
    summary: 'tells the Omni page this session is working',
    detail:
      'At most once a minute per session, it tells the Omni page that the session is working, and ' +
      "on which draft, PRD or fix. The plugin's hooks run it after every tool call, and any omni " +
      'command run in a session sends it too, in the background; OMNI_HEARTBEAT=off stops that. ' +
      'With nothing on stdin it takes the session id OMNI_SESSION_ID, CLAUDE_CODE_SESSION_ID or ' +
      'the stored one gives. --end, run when the session ends, says it stopped. It sends only when ' +
      'you are signed in and dossiers are on, sends no path, command or text, prints nothing and ' +
      'always exits 0.',
  },
  {
    name: 'budget',
    kind: 'command',
    who: 'skills',
    usage: ['omni budget measure context [--json]', 'omni budget set context'],
    summary: 'how many bytes every agent session reads here, and the ceilings they are held to',
    detail:
      'measure prints one size per target: the briefing, each playbook form as omni kb show prints it, ' +
      'its pointers expanded, each file paths.context names, and session, the briefing and those files ' +
      'together, which every session loads before its first step. Bytes, with about a quarter as many ' +
      'tokens beside them. --json prints the same as one object. A target it cannot measure (a missing ' +
      'file, a pointer that leads nowhere) says why, and it exits 1. set writes a first ceiling for each ' +
      'target that has none into the file budgets.context.file names, at its size rounded up to the next ' +
      'KiB, and never raises a ceiling that exists; on a target it cannot measure it writes nothing.',
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
    name: 'claim',
    kind: 'command',
    who: 'skills',
    usage: ['omni claim check <prd> <slice>'],
    summary: "whether a takeover reuses a stale claim's branch or rebuilds the slice",
    detail:
      "Reads the slice's claim on the remote, as last fetched: its claim commit, the slice's plan row " +
      'then and on the feature branch now, and every file the branch changed since it last met the ' +
      'feature branch. Prints reuse (exit 0) when the row\'s title and territory are unchanged and ' +
      'every changed file is inside the territory (the outbox dir and generated paths always are). ' +
      'Otherwise one rebuild line, exit 1: plan row changed: territory or title, outside territory: ' +
      '<path>, no claim commit, or slice not in the plan. A wave runs it before taking over a stale ' +
      'claim. Exit 2 when the feature branch cannot be read: fetch it first.',
  },
  {
    name: 'tier',
    kind: 'command',
    who: 'skills',
    usage: ['omni tier <deep|build|light> --agent <agent>'],
    summary: 'the model and effort a slice of a tier runs on',
    detail:
      'The model and effort the config maps a tier to for one agent: a line model: and a line ' +
      'effort:, each only when set. When nothing maps the tier (no tiers in the config, no row ' +
      "for the agent, no entry for the tier) it prints inherit: the slice runs on the terminal's " +
      'model. Both exit 0. A wave runs it for each slice, on the tier its plan advises, and starts ' +
      'the slice on what it prints. An unknown tier or agent exits 2, naming it.',
  },
  {
    name: 'design',
    kind: 'command',
    who: 'skills',
    usage: ['omni design touched [<base>]', 'omni design screens', 'omni design words <page.html>…', 'omni design gallery [--out <file>]'],
    summary: 'whether a branch touches a screen, the screen library, the word pass over a mockup, and the gallery',
    detail:
      'Design craft is off until the config sets design.enabled to true: then the skills read the ' +
      "design form, omni kb show design (the product, where its design system lives, what it does on " +
      'purpose and how to look at a screen), and the product wins over the craft floor and the refuse ' +
      'list. touched reads what the branch changed since its merge base with <base> (by default the ' +
      "slice's feature branch, else the default branch) and prints design: off while the flag is off, " +
      'ui: yes and each changed path the design.paths globs match, ui: no when none does, or ui: ' +
      'unknown when design.paths is empty or the base cannot be read, for the agent to judge from the ' +
      'diff. It first drops every changed path a design.ignore glob matches (by default the test ' +
      'shapes **/*.test.*, **/*.spec.*, **/__tests__/** and **/test/**; [] drops nothing), so a change ' +
      'made only of tests reads ui: no. Its screens: line names each library screen whose implements ' +
      'the change touches, and as reads <screen> each one it reaches only through its reads, the code ' +
      'behind the screen, which never trips a lock; and mock may be stale: <screen> names a screen ' +
      "whose implements changed while its mockup did not, a note only. On ui: yes a slice follows its design review, which runs commands.design, the repository's " +
      'design linter, when it is set. None of it ever blocks: the review never blocks a slice, a wave ' +
      'or a gate, it only reports, and touched exits 0 whatever it finds. screens lists the screen ' +
      'library, the folder design.screens names (by default design/screens/ under the knowledge ' +
      'folder): one Markdown file per screen, its front matter saying its status (draft, locked or ' +
      'superseded), who locked it, when and in which words, its mockup, the paths it implements (the ' +
      'files it is drawn from), the optional reads list (the code it only depends on), its routes, and ' +
      'an optional kind: page, the default, or shared, structure several pages show (an app shell, ' +
      'notifications, a sign-in page), a screen of its own whose files each page it appears on lists in ' +
      'reads, and any other kind is refused by name; ' +
      'omni check design warns, and still passes, on an implements entry that names a folder. It prints one line per screen, sorted by name, with its status, who locked it and ' +
      'when, and its routes, with shared beside a shared screen, then each file that does not read, says so when the library is empty, ' +
      'and prints design: off while the flag is off. There is no hand-kept index, and screens exits 0 ' +
      'whatever it finds. words is the word pass: it reads each mockup page given, structure never ' +
      'style, and prints every screen (an element design.words.screen matches, by default ' +
      '[data-screen]; an unmarked page, one with none, is skipped with no finding, and says no ' +
      'screen marked: skipped) with its visible strings (two sibling blocks, or a layout of spans with no ' +
      'running text, are two strings, while a phrasing element such as code, em or span inside running ' +
      'text keeps its sentence whole, and inside a control two sibling elements are joined with a space), ' +
      "each control's marked (a button, a link, or any element design.words.primary matches), and " +
      'its word count; text inside an element design.words.content matches (by default [data-content]) ' +
      'is content the screen shows, not words it wrote: it prints content · <n> words apart and raises ' +
      'no finding. Then its findings: sentence-on-control, a button or link ' +
      'whose label holds design.words.sentence words or more (default 7); two-primaries, more than one ' +
      'primary action (design.words.primary, by default [data-primary]) in one screen; ' +
      'explains-at-rest, a string outside any control longer than design.words.sentence; and ' +
      'avoided-word, a word or phrase in design.words.avoid or in the explicit list the design ' +
      "form's product section holds, one line labelled Words we avoid:, Words to avoid:, Avoided " +
      'words: or Avoid: with the words after it or one bullet each below it (prose is never read as a ' +
      'list). The selectors are tags, #ids, .classes and [attributes], comma-separated, with no ' +
      'combinator. A page it cannot read is named and the next is read; it prints design: off while ' +
      'the flag is off, and words exits 0 whatever it finds: a finding is fixed in the screen, never ' +
      'silenced. gallery writes one self-contained HTML page of the whole library (inline styles, no ' +
      'script, no remote asset): each screen with its status, who locked it and when, its routes, and ' +
      'its mockup inline or no mockup, locked screens first, then drafts, then superseded, and the shared ' +
      'screens in a group of their own after the pages. It writes ' +
      'to a fresh folder under the system temporary folder, or to --out <file>, and prints the path; ' +
      'the page is generated each time and never committed. An empty library prints no screen yet ' +
      'and writes nothing, design: off while the flag is off, and gallery exits 0.',
  },
  {
    name: 'e2e',
    kind: 'command',
    who: 'skills',
    usage: ['omni e2e status <prd>', 'omni e2e heals <prd> [--head <ref>]', 'omni e2e hold <prd>', 'omni e2e confirm <prd>', 'omni e2e reject <prd>', 'omni e2e guard <prd>'],
    summary: 'which e2e tests of a PRD have a recording, and which steps healed (beta)',
    detail:
      'status lists, as JSON, the tests tagged prd-<n> under the e2e.dir folder of the config, each ' +
      'with whether a recording of it exists in .e2e/cache (recording) and whether one is expected ' +
      '(expected: false when the file holds no agent. call, since only an agent step records), and ' +
      'exits 1 when a test that expects a recording has none; a test with no agent step passes. Each test ' +
      'also carries level and flow: level is critical when the file carries the tag critical, else ' +
      'standard, and flow is the id of its flow-<id> tag, or null. A critical test with no flow-<id> ' +
      'tag, or whose flow is not in e2e.dir/critical-flows.md, exits 1 naming the test and the flow; a ' +
      'list that does not parse exits 1 naming the file and the flow. A recording ' +
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
      "file the status line reads. The status line and the HUD are Claude Code's alone: Codex, Cursor " +
      'and Gemini CLI show neither.',
  },
  {
    name: 'now',
    kind: 'command',
    who: 'skills',
    usage: ['omni now [--json] [--stdin] [--session <id>]'],
    summary: 'what this session is on now, and the slices being built',
    detail:
      'The PRD this session works on, from its branch or else from the last command that named ' +
      'one, its stage (building while a slice is not merged), and the slices in flight and stuck by ' +
      'id and name. --json prints the same as one document, for the status line, the omni-hud band ' +
      "or any other agent. --stdin reads the session's folder and id from Claude Code's status line " +
      'JSON, --session names the session; else it is OMNI_SESSION_ID, then CLAUDE_CODE_SESSION_ID, ' +
      'then the id omni dossier open stored for the checkout. It reads only this computer: it never fetches, never calls ' +
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
      'never writes in a target. It ends with the /omni:ultra-yolo line that builds it. With ' +
      '--product <key>, it runs from any checkout of a repository the product holds, a plan ' +
      'repository or not, and makes a product PRD (mobile-12) on the Omni page instead: no issue, ' +
      'no branch and no PR in any repository, every repository it lands in on phase 0 on the server.',
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
      'runs only its own committed setup, then its own committed preflight, and it never merges into ' +
      'any default branch.',
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
      'no attempt. In a target it runs only its own committed setup, then its own committed ' +
      'preflight, and it never merges. ' +
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
      "that would break today's consumer stops it, with the /omni:mega-brainstorm line. In a target " +
      'it runs only its own committed setup, then its own committed preflight. It never merges.',
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
      'taken in, checks each target again, then runs the one gate. It asks no question of its own; ' +
      'in a target it runs only its own committed setup, then its own committed preflight, and it ' +
      'never merges into any default branch.',
    group: 'multi-repo',
    when: "Use it when you have answered the outbox questions on a multi-repository PRD's plan PR.",
    example: {
      type: '/omni:ultra-yolo-fix 600',
      result: 'each rework landed in its repository, then the plan PR shipped',
    },
  },
  {
    name: 'yolo-runner',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:yolo-runner <n>'],
    label: '/omni:yolo-runner <n>',
    summary: 'build a PRD on a runner, and follow it from here',
    detail:
      "The /omni:yolo of a runner: follows the PRD's queued or running job when there is one, " +
      "else sends /omni:yolo <n> to a runner of the workspace, then prints the job's milestones " +
      'until it ends and hands off on the ending. It builds nothing in this terminal and never ' +
      'merges into {defaultBranch}; Ctrl-C stops the following only.',
    group: 'build',
    when: 'Use it when you want a runner to build the PRD while you follow it, or to pick up a job sent from the page.',
    example: {
      type: '/omni:yolo-runner 580',
      result: "the PRD's job followed milestone by milestone, then the hand-off on how it ended",
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
      'PR into {defaultBranch}, whose body shows the bug before and after under Proof and is checked ' +
      'by omni bug <n> --body-file before the PR opens. It sends its record to the fix\'s page on the ' +
      'Omni page (/omni:dossier-push <n> --kind bug) and prints its link. No PRD, plan or outbox. A ' +
      'reproduction that passes before any fix stops it, naming on the issue the merged PR that ' +
      'fixed the bug when it can prove one. A flaky ' +
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
      'adopts its medium ones. /omni:ultra-yolo runs it for each wave. In a target it runs only its ' +
      'own committed setup, then its own committed preflight, and it never merges into any default ' +
      'branch.',
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
    name: 'retro-apply',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:retro-apply --retro <n>'],
    label: '/omni:retro-apply',
    summary: "settle a retro PR's kept lessons",
    detail:
      "Settles every kept lesson of retro PR n on the PR's own branch, so each ends in an outcome a person " +
      'approves by merging: it appends one rule to the playbook slot it belongs in and records became, or ' +
      'records staysHere with the rule that already says it, or asks one question on the retro PR and ' +
      "records nothing. It rewrites the PR's body with a line per lesson, the rule quoted word for word " +
      'with its slot, or the reason, then Closes #<issue>. With retro.guards on it also writes the guard ' +
      'test, proved red then green; off, it writes no code. It refuses, in one line, a retro PR already ' +
      'merged or closed, and never merges. The Omni app queues it for a runner when a retro keeps a ' +
      'lesson, and the retro PR body carries the same line.',
    group: 'everyday',
    when: 'Use it when a retro PR holds a kept lesson with no outcome and no runner took the job.',
    example: {
      type: '/omni:retro-apply --retro 2300',
      result: "the retro PR's body quoting each new rule with its slot, or its reason, and omni check retro green",
    },
  },
  {
    name: 'rewind',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:rewind <n>'],
    label: '/omni:rewind <n>',
    summary: 'find where a PRD that broke main went wrong',
    detail:
      "Walks PRD n, which broke main, back from the break to its spec: it reads the breaks with omni rewind " +
      'facts, starts from the break itself, then runs seven checks in order (the reviews, the CI, the pull ' +
      'request bodies against the pull-requests form, the waves, the plan, the spec and its answers, the ' +
      'knowledge). It writes the premise every earlier fix assumed and tests it before naming the one cause. ' +
      'Each finding names its check, where it started (repository, omni-setup or knowledge), its evidence ' +
      'links and its fix, a repository fix at the strongest level that would have stopped the break: ' +
      'architecture, types, a lint, a test, docs last. It sends them with omni rewind push to the PRD\'s Main ' +
      'tab, as proposals a member approves or rejects, each signed as written by an agent. It refuses, in one ' +
      'line, a PRD that did not break main; it writes nothing to the repository and never merges. The Omni ' +
      'app queues it for a runner on the first break.',
    group: 'everyday',
    when: "Use it when a PRD's page reads Broke main, no rewind ran yet, and no runner took the job.",
    example: {
      type: '/omni:rewind 2410',
      result: "the PRD's Main tab listing each finding with its check, where it started, its evidence and its fix",
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
    name: 'knowledge-add',
    kind: 'skill',
    who: 'you',
    usage: ['/omni:knowledge-add <what to add or edit>'],
    label: '/omni:knowledge-add',
    summary: "add or edit one item of a product's knowledge",
    detail:
      "Adds or edits one Statement, Never line, Legal entry or Glossary term of the product's " +
      'Knowledge tab from the terminal. It turns what you said into exactly one item, asks for any ' +
      'field you did not give and never fills one, shows the item whole and asks Yes / Change / ' +
      'Cancel, and writes only on Yes, with omni constituents or omni kb legal and glossary. The ' +
      'next item starts only after the last one\'s line printed. It never writes unattended and ' +
      'never removes or retires anything.',
    group: 'everyday',
    when: "Use it when a product's constituents, legal entries or glossary should change without leaving the terminal.",
    example: {
      type: '/omni:knowledge-add add a never line: we never store card numbers',
      result: 'the item shown whole, then on Yes its line and link, as added never#4',
    },
  },
  {
    name: 'dossier-open',
    kind: 'skill',
    who: 'skills',
    usage: ['/omni:dossier-open "<one line of the idea>"'],
    summary: 'open a draft dossier for an idea',
    detail:
      'Opens a draft dossier for an idea on the Omni page, linked to this session, so the ' +
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
