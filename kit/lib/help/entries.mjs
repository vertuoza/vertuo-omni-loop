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

const deepFreeze = (value) => {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
};

/** The loop, stage by stage: a name, one line, and the folder that holds it, when one does. The
 * names are the kit's stage words (`STAGE_WORDS` in `kit/lib/status/format.mjs`), in its order. */
export const STAGES = deepFreeze([
  { name: 'idea', line: 'talked through with /omni:brainstorm, or /omni:think-big if vast' },
  { name: 'PRD', line: 'spec, plan and before/after, in a phase-0 PR a person reviews' },
  { name: 'inbox', line: 'phase-0 PR merged: approved, ready to build', folder: '{inbox}' },
  { name: 'building', line: 'first sub-PR merged into the feature branch: built in waves' },
  { name: 'outbox', line: 'feature PR ready: the change and its outbox wait for you' },
  { name: 'shipped', line: 'feature PR merged: the change is on {defaultBranch}', folder: '{shipped}' },
  { name: 'retro', line: 'a retro PR tells how it went; a knowledge PR keeps what it taught' },
]);

export const PRINCIPLES = deepFreeze([
  'The folder is the status.',
  'Only a person merges into {defaultBranch}.',
  'Every decision an agent takes alone becomes an outbox item that you answer or adopt.',
]);

/** The skills grouped by what you want to do (PRD 580), in the order the docs show them. */
export const SKILL_GROUPS = deepFreeze([
  { id: 'start', title: 'Start a change' },
  { id: 'build', title: 'Build it' },
  { id: 'setup', title: 'Set up a repository' },
  { id: 'multi-repo', title: 'Several repositories' },
  { id: 'everyday', title: 'Every day' },
  { id: 'run-by-skills', title: 'Run by other skills' },
]);

export const ENTRIES = deepFreeze([
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
      'omni care reply --verdict <v> --body <text> [--thread <id>]',
      'omni care reply --verdict <v> --file <path> [--thread <id>]',
    ],
    summary: "PRD n's feature PR as PR care sees it, and its marked replies",
    detail:
      "state prints PRD n's feature PR as one document: its checks, whether it conflicts, each review " +
      'thread with its verdict, whether a wave holds claims, and the next actions of a round. reply ' +
      'writes a reply ending with the care marker; with --thread it posts it and resolves the thread ' +
      'unless the verdict is asked. Needs gh logged in.',
  },
  {
    name: 'check',
    kind: 'command',
    who: 'you',
    usage: ['omni check [inbox|outbox|knowledge|kb|releases|coverage|all]', '  [--base <ref>] [--prd <n>]'],
    label: 'omni check [all]',
    summary: "the repository's guards",
    detail:
      "The repository's guards, each printing its violations or one line saying it passed: inbox " +
      '(the PRDs waiting to be built), outbox (the open items), knowledge (the registers), kb (the ' +
      "playbook's forms), releases (the release notes) and coverage (every risky change of a branch " +
      'accounted for, against --base). all, the default, runs every one, and skips coverage when ' +
      '{remote}/{defaultBranch} has not been fetched. Exit 1 on any violation.',
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
    usage: ['omni knowledge <id>'],
    label: 'omni knowledge <id>',
    summary: 'one rule of the knowledge base',
    detail:
      'One entry of the knowledge base, a principle, a rule or an invariant, by its id (such as ' +
      'P-PRODUCT-1), with every entry that serves it. A proposed entry says who proposed it and ' +
      'when: it describes the product, but it is no law until a person confirms it.',
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
    usage: ['omni dossier open "<title>"', 'omni dossier push <n> [--kind visual|bug]', 'omni dossier link <n> [--kind visual|bug]', 'omni dossier status'],
    label: 'omni dossier …',
    summary: "a PRD's dossier on the Omni page",
    detail:
      "A PRD's dossier on the Omni page, where the whole workspace reads every version of its " +
      'spec, plan and before/after. open opens a draft for an idea and prints its link; push sends ' +
      "PRD n's files and adds a version only where a file changed; link prints PRD n's page, on " +
      'any computer, or none when it has no dossier, and writes nothing; status says whether ' +
      'dossiers are on here. With --kind visual or --kind bug, push and link work on issue n\'s fix ' +
      'instead: its visual update or bug fix page, filled from its folder. It never holds up the ' +
      'skill that runs it: anything that stops it exits 1 with one line.',
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
    usage: ['omni plan check <prd>', 'omni plan moved <prd> [--json]'],
    summary: "grade a PRD's plan, or see what moved in its targets",
    detail:
      "check grades PRD n's plan.md before anyone builds from it: every blocker names a slice of the " +
      'same plan in an earlier wave, no id is used twice, and no two slices of one wave share ground. ' +
      'It prints the slices, the waves and where they meet, then every violation; exit 1 on any. ' +
      "moved, in a plan repository, compares each target's read at with its default branch today: " +
      'moved with the files changed under its slices\' territories, ok, or unreachable; exit 0 ' +
      'whatever the states, 1 with not a plan repository.',
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
      'board, the debate and an area map of PRD-sized areas, and ends with one ' +
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
      "concept in the inbox: the area's brief, the vision and the verdict.",
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
      'PR stays a draft with the outbox questions posted on it. It never merges into {defaultBranch}.',
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
    usage: ['/omni:pr-care <n>'],
    label: '/omni:pr-care <n>',
    summary: "look after a PRD's feature PR until it is merged",
    detail:
      "Looks after PRD n's feature PR, round by round, until it is merged or closed or you stop it: " +
      'it merges {defaultBranch} on a conflict, fixes red CI, then judges each review comment against ' +
      "the repository's review form and fixes it, pushes back with a reason, or leaves it for the " +
      'PM. A reviewer who answers again gets the PM, not an argument. It pushes nothing while a ' +
      'wave is building, shows on the PRD page that it is watching, and never merges.',
    group: 'build',
    when: 'Use it when a feature PR is ready and you want CI, conflicts and review comments handled while you do other things.',
    example: {
      type: '/omni:pr-care 790',
      result: 'each review comment fixed, pushed back with a reason, or left for you, and the PR kept green',
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

  // Skills other skills run.
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
    usage: ['/omni:dossier-push <n> [--kind visual|bug]'],
    summary: "send a PRD's files to its dossier",
    detail:
      "Sends PRD n's spec, plan and before/after page to its dossier on the Omni page, adding a " +
      'version only where a file changed. /omni:brainstorm runs it after each of its pushes, and ' +
      '/omni:plan after it pushes the plan; /omni:visual-fix and /omni:bug-fix run it with --kind ' +
      'visual or --kind bug for their fix\'s page. It never stops the skill that runs it.',
    group: 'run-by-skills',
    when: "Use it when a PRD's spec, plan or before/after page changed and its dossier should show it.",
    example: {
      type: '/omni:dossier-push 580',
      result: "the dossier's link and the versions it added",
    },
  },
]);
