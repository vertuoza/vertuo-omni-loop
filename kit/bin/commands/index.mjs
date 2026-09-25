// Every `omni` subcommand, by name. Each is `{ run(args, { ctx, stdout, stderr, exec, env }) → exit code }`;
// one marked `withoutContext` (init) gets `{ cwd, stdout, stderr, exec, env, stdin, bundle, ask }` instead.
import { adopt } from './adopt.mjs';
import { board } from './board.mjs';
import { check } from './check.mjs';
import { comment } from './comment.mjs';
import { config } from './config.mjs';
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
import { ship } from './ship.mjs';
import { status } from './status.mjs';

export const COMMAND_TABLE = Object.freeze({ config, prd, status, settle, adopt, replies, comment, ship, check, knowledge, kb, item, plan, board, rework, phase0, init });
