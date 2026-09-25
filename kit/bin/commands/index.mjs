// Every `omni` subcommand, by name. Each is `{ run(args, { ctx, stdout, stderr, exec, env }) → exit code }`.
import { adopt } from './adopt.mjs';
import { board } from './board.mjs';
import { check } from './check.mjs';
import { comment } from './comment.mjs';
import { config } from './config.mjs';
import { item } from './item.mjs';
import { knowledge } from './knowledge.mjs';
import { phase0 } from './phase0.mjs';
import { plan } from './plan.mjs';
import { prd } from './prd.mjs';
import { replies } from './replies.mjs';
import { rework } from './rework.mjs';
import { settle } from './settle.mjs';
import { ship } from './ship.mjs';
import { status } from './status.mjs';

export const COMMAND_TABLE = Object.freeze({ config, prd, status, settle, adopt, replies, comment, ship, check, knowledge, item, plan, board, rework, phase0 });
