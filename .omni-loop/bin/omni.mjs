#!/usr/bin/env node
// This repository's `omni`: a shim onto the live kit source, so the skills always run today's code.
// A terraformed repository carries the bundle here instead (kit/dist/omni.mjs).
import { main } from '../../kit/bin/omni.ts';

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exit(1);
  },
);
