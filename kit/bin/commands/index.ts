// Every `omni` subcommand, by name. Each is `{ run(args, { ctx, stdout, stderr, exec, env }) → exit code }`;
// one marked `withoutContext` (conventions, approval, wait, runner, init, ask, heartbeat, session, signin, signout, whoami, setup-token, dossier, idea, loop, proof, pitch, business, constituents, decide, version, update, help, statusline, now, targets, product, status, prd, item, adopt, settle, answers, sync, worktrees)
// gets `{ cwd, stdout, stderr, exec, env }` instead, plus whatever a caller injects (init's `stdin`, `bundle`
// and `ask`; ask's `stdin`, `tokens` and `limits`; heartbeat's `stdin`, `tokens`, `fetch` and `now`; signin's `home`, `openBrowser`, `fetch` and `waitMs`;
// signout's and whoami's `home`; setup-token's `openBrowser`, `waitMs` and `now`; dossier's and loop's `tokens`, `home`, `fetch`, `callMs` and `now`; idea's and proof's `tokens`, `home`, `fetch` and `callMs`;
// pitch's `tokens`, `home`, `fetch`, `callMs`, `now`, `launch`, `openBrowser` and `studioUntil`;
// business's, decide's, approval's, product's and status's `tokens`, `home`, `fetch` and `callMs`; item's, adopt's, settle's and answers' `tokens`, `home`, `fetch`, `callMs` and `now`; wait's `tokens`, `home`, `fetch`, `callMs`, `sleep`, `now`, `idleMs` and `deadline`; constituents' and session's `tokens`, `home`, `fetch`, `now` and `budgetMs`;
// version's `kit`; update's `kit` and `bundle`; sync's `now` and `spawn`; worktrees' `board` and `processes`; statusline's `stdin`, `now`, `readFacts` and `spawn`; now's `stdin` and `now`; runner's `tokens`, `home`, `fetch`, `terminal`, `stop`, `sleep`, `now`, `tickMs` and `backoff`).
import type { Command, FreeCommand, FreeIo } from '../io.ts';
import { adopt } from './adopt.ts';
import { answers } from './answers.ts';
import { approval } from './approval.ts';
import { wait } from './approval-wait.ts';
import { ask } from './ask.ts';
import { board } from './board.ts';
import { beforeAfter } from './before-after.ts';
import { budget } from './budget.ts';
import { care } from './care.ts';
import { business } from './business.ts';
import { bug as bugCommand } from './bug.ts';
import { ci as bugCi } from './bug-ci.ts';
import { check } from './check.ts';
import { claim } from './claim.ts';
import { comment } from './comment.ts';
import { constituents } from './constituents.ts';
import { concept } from './concept.ts';
import { config } from './config.ts';
import { conventions } from './conventions.ts';
import { credits } from './credits.ts';
import { decide } from './decide.ts';
import { design } from './design.ts';
import { dossier } from './dossier.ts';
import { e2e } from './e2e.ts';
import { flow } from './flow.ts';
import { followUp } from './follow-up.ts';
import { generated } from './generated.ts';
import { harvest } from './harvest.ts';
import { heartbeat } from './heartbeat.ts';
import { hold } from './hold.ts';
import { help } from './help.ts';
import { idea } from './idea.ts';
import { init } from './init.ts';
import { item } from './item.ts';
import { kb } from './kb.ts';
import { knowledge } from './knowledge.ts';
import { loop } from './loop.ts';
import { mission } from './mission.ts';
import { next } from './next.ts';
import { now } from './now.ts';
import { phase0 } from './phase0.ts';
import { plan } from './plan.ts';
import { prd } from './prd.ts';
import { pitch } from './pitch.ts';
import { proof } from './proof.ts';
import { replies } from './replies.ts';
import { retro } from './retro.ts';
import { rewind } from './rewind.ts';
import { roadmap } from './roadmap.ts';
import { runner } from './runner.ts';
import { rework } from './rework.ts';
import { session } from './session.ts';
import { settle } from './settle.ts';
import { setupToken } from './setup-token.ts';
import { signin, signout, whoami } from './signin.ts';
import { ship } from './ship.ts';
import { sign } from './sign.ts';
import { status } from './status.ts';
import { targets } from './targets.ts';
import { ref } from './ref.ts';
import { tier } from './tier.ts';
import { product } from './product.ts';
import { statusline } from './statusline.ts';
import { sync } from './sync.ts';
import { update } from './update.ts';
import { version } from './version.ts';
import { visual } from './visual.ts';
import { worktrees } from './worktrees.ts';

/** `omni bug ci …` is level B's command (PRD 2578); every other `omni bug …` is `./bug.ts`'s, as before. */
const bug = {
  withoutContext: true,
  run: (args: string[], io: FreeIo) => (args[0] === 'ci' ? bugCi(args.slice(1), io) : bugCommand.run(args, io)),
} satisfies FreeCommand;

export const COMMAND_TABLE: Readonly<Record<string, Command | FreeCommand>> = Object.freeze({ config, 'before-after': beforeAfter, prd, budget, approval, wait, status, settle, adopt, replies, answers, comment, ship, harvest, retro, rewind, check, claim, generated, design, knowledge, kb, item, plan, roadmap, board, care, 'follow-up': followUp, next, loop, rework, phase0, visual, bug, concept, mission, init, ask, heartbeat, signin, signout, whoami, 'setup-token': setupToken, sign, credits, dossier, idea, flow, e2e, proof, pitch, business, constituents, conventions, decide, version, update, help, statusline, now, targets, product, session, runner, tier, ref, hold, sync, worktrees });
