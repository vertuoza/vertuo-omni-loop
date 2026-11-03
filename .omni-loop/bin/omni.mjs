#!/usr/bin/env node
// This repository's `omni`: a shim onto the live kit source, so the skills always run today's code.
// A terraformed repository carries the bundle here instead (kit/dist/omni.mjs).
//
// The kit's source needs the dependencies, and a worktree Claude Code makes for a subagent runs no git
// hook, so `.githooks/post-checkout` never installed it (#2613). Every skill starts by running this
// file: it installs what is missing first, its output kept off stdout, which is the command's own.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
if (!existsSync(`${root}node_modules/yaml`)) {
  const install = spawnSync('pnpm', ['install', '--frozen-lockfile', '--silent'], { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });
  if (install.status !== 0) process.stderr.write('omni: pnpm install failed here: run pnpm install --frozen-lockfile\n');
}

import('../../kit/bin/omni.ts').then(({ main }) => main(process.argv.slice(2))).then(
  (code) => process.exit(code),
  (error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exit(1);
  },
);
