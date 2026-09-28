// Every `omni` subcommand, by name. Each is `{ run(args, { ctx, stdout, stderr, exec, env }) → exit code }`;
// one marked `withoutContext` (init, ask, signin, signout, whoami, dossier, help, statusline) gets
// `{ cwd, stdout, stderr, exec, env }` instead, plus whatever a caller injects (init's `stdin`, `bundle` and
// `ask`; ask's `stdin`, `tokens` and `limits`; signin's `home`, `openBrowser`, `fetch` and `waitMs`; signout's
// and whoami's `home`; dossier's `tokens`, `home`, `fetch`, `callMs` and `now`; statusline's `stdin`, `now`,
// `readFacts` and `spawn`).
import { adopt } from './adopt.mjs';
import { ask } from './ask.mjs';
import { board } from './board.mjs';
import { check } from './check.mjs';
import { comment } from './comment.mjs';
import { config } from './config.mjs';
import { credits } from './credits.mjs';
import { dossier } from './dossier.mjs';
import { harvest } from './harvest.mjs';
import { help } from './help.mjs';
import { init } from './init.mjs';
import { item } from './item.mjs';
import { kb } from './kb.mjs';
import { knowledge } from './knowledge.mjs';
import { phase0 } from './phase0.mjs';
import { plan } from './plan.mjs';
import { prd } from './prd.mjs';
import { replies } from './replies.mjs';
import { rework } from './rework.mjs';
import { settle } from './settle.mjs';
import { signin, signout, whoami } from './signin.mjs';
import { ship } from './ship.mjs';
import { sign } from './sign.mjs';
import { status } from './status.mjs';
import { statusline } from './statusline.mjs';

export const COMMAND_TABLE = Object.freeze({ config, prd, status, settle, adopt, replies, comment, ship, harvest, check, knowledge, kb, item, plan, board, rework, phase0, init, ask, signin, signout, whoami, sign, credits, dossier, help, statusline });
