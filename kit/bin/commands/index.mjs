// Every `omni` subcommand, by name. Each is `{ run(args, { ctx, stdout, stderr, exec, env }) → exit code }`;
// one marked `withoutContext` (init, ask, heartbeat, signin, signout, whoami, dossier, proof, pitch, business, decide, version, update, help, statusline)
// gets `{ cwd, stdout, stderr, exec, env }` instead, plus whatever a caller injects (init's `stdin`, `bundle`
// and `ask`; ask's `stdin`, `tokens` and `limits`; heartbeat's `stdin`, `tokens`, `fetch` and `now`; signin's `home`, `openBrowser`, `fetch` and `waitMs`;
// signout's and whoami's `home`; dossier's `tokens`, `home`, `fetch`, `callMs` and `now`; proof's `tokens`, `home`, `fetch` and `callMs`;
// pitch's `tokens`, `home`, `fetch`, `callMs`, `now` and `screenshot`;
// business's and decide's `tokens`, `home`, `fetch` and `callMs`; version's `kit`;
// update's `kit` and `bundle`; statusline's `stdin`, `now`, `readFacts` and `spawn`).
import { adopt } from './adopt.mjs';
import { answers } from './answers.mjs';
import { ask } from './ask.mjs';
import { board } from './board.mjs';
import { care } from './care.mjs';
import { business } from './business.mjs';
import { bug } from './bug.mjs';
import { check } from './check.mjs';
import { comment } from './comment.mjs';
import { concept } from './concept.mjs';
import { config } from './config.mjs';
import { credits } from './credits.mjs';
import { decide } from './decide.mjs';
import { dossier } from './dossier.mjs';
import { harvest } from './harvest.mjs';
import { heartbeat } from './heartbeat.mjs';
import { help } from './help.mjs';
import { init } from './init.mjs';
import { item } from './item.mjs';
import { kb } from './kb.mjs';
import { knowledge } from './knowledge.mjs';
import { phase0 } from './phase0.mjs';
import { plan } from './plan.mjs';
import { prd } from './prd.mjs';
import { pitch } from './pitch.mjs';
import { proof } from './proof.mjs';
import { replies } from './replies.mjs';
import { rework } from './rework.mjs';
import { settle } from './settle.mjs';
import { signin, signout, whoami } from './signin.mjs';
import { ship } from './ship.mjs';
import { sign } from './sign.mjs';
import { status } from './status.mjs';
import { targets } from './targets.mjs';
import { statusline } from './statusline.mjs';
import { update } from './update.mjs';
import { version } from './version.mjs';
import { visual } from './visual.mjs';

export const COMMAND_TABLE = Object.freeze({ config, prd, status, settle, adopt, replies, answers, comment, ship, harvest, check, knowledge, kb, item, plan, board, care, rework, phase0, visual, bug, concept, init, ask, heartbeat, signin, signout, whoami, sign, credits, dossier, proof, pitch, business, decide, version, update, help, statusline, targets });
