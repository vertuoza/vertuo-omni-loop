// @ts-nocheck
// Every `omni` subcommand, by name. Each is `{ run(args, { ctx, stdout, stderr, exec, env }) → exit code }`;
// one marked `withoutContext` (init, ask, heartbeat, signin, signout, whoami, dossier, proof, business, decide, version, update, help, statusline)
// gets `{ cwd, stdout, stderr, exec, env }` instead, plus whatever a caller injects (init's `stdin`, `bundle`
// and `ask`; ask's `stdin`, `tokens` and `limits`; heartbeat's `stdin`, `tokens`, `fetch` and `now`; signin's `home`, `openBrowser`, `fetch` and `waitMs`;
// signout's and whoami's `home`; dossier's `tokens`, `home`, `fetch`, `callMs` and `now`; proof's `tokens`, `home`, `fetch` and `callMs`;
// business's and decide's `tokens`, `home`, `fetch` and `callMs`; version's `kit`;
// update's `kit` and `bundle`; statusline's `stdin`, `now`, `readFacts` and `spawn`).
import { adopt } from './adopt.ts';
import { answers } from './answers.ts';
import { ask } from './ask.ts';
import { board } from './board.ts';
import { care } from './care.ts';
import { business } from './business.ts';
import { bug } from './bug.ts';
import { check } from './check.ts';
import { comment } from './comment.ts';
import { concept } from './concept.ts';
import { config } from './config.ts';
import { credits } from './credits.ts';
import { decide } from './decide.ts';
import { dossier } from './dossier.ts';
import { harvest } from './harvest.ts';
import { heartbeat } from './heartbeat.ts';
import { help } from './help.ts';
import { init } from './init.ts';
import { item } from './item.ts';
import { kb } from './kb.ts';
import { knowledge } from './knowledge.ts';
import { phase0 } from './phase0.ts';
import { plan } from './plan.ts';
import { prd } from './prd.ts';
import { proof } from './proof.ts';
import { replies } from './replies.ts';
import { rework } from './rework.ts';
import { settle } from './settle.ts';
import { signin, signout, whoami } from './signin.ts';
import { ship } from './ship.ts';
import { sign } from './sign.ts';
import { status } from './status.ts';
import { targets } from './targets.ts';
import { statusline } from './statusline.ts';
import { update } from './update.ts';
import { version } from './version.ts';
import { visual } from './visual.ts';

export const COMMAND_TABLE = Object.freeze({ config, prd, status, settle, adopt, replies, answers, comment, ship, harvest, check, knowledge, kb, item, plan, board, care, rework, phase0, visual, bug, concept, init, ask, heartbeat, signin, signout, whoami, sign, credits, dossier, proof, business, decide, version, update, help, statusline, targets });
