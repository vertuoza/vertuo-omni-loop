// What the status line reads besides Claude Code's JSON (PRD 324's spec, "How it is built"): the one
// module that touches git and the disk, so that `input.mjs` and `render.mjs` stay pure. Each fact is
// read on its own, and one that cannot be read counts as absent: nothing here prints, fetches, runs
// `gh` or writes a file.
//
// - `installed` — a config loads in the checkout of the session's folder (`input.currentDir`, else
//   the process's own folder): the loop is installed there, and line 2 is printed.
// - `askOn` — ask mode is on in the checkout Claude Code was launched from: the file the ask hooks
//   read, under `input.projectDir`, read with the kit's own `readMode`. Nothing is called to know it.
import { readMode } from '../ask/local-state.mjs';
import { loadConfig } from '../config.mjs';
import { createContext } from '../context.mjs';
import { findRoot } from '../init/repo.mjs';

/** The context of the checkout `folder` sits in, or `null` when it is no repository or its config does not load. */
function checkoutContext(folder, exec) {
  try {
    const root = findRoot(folder, exec);
    return createContext(root, loadConfig(root));
  } catch {
    return null;
  }
}

function askModeOn(projectDir) {
  if (!projectDir) return false;
  try {
    return readMode(projectDir) !== null;
  } catch {
    return false;
  }
}

/**
 * @param {{ currentDir: string | null, projectDir: string | null }} input `parseInput`'s result
 * @param {{ cwd: string, exec: Function }} options the process's own folder, and `execFileSync`
 * @returns {{ installed: boolean, askOn: boolean }}
 */
export function readFacts(input, { cwd, exec }) {
  const ctx = checkoutContext(input.currentDir ?? cwd, exec);
  return { installed: ctx !== null, askOn: askModeOn(input.projectDir) };
}
