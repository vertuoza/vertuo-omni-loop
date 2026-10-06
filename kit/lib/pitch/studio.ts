// `omni pitch studio <dir>` (PRD 1108's spec, "The engine, the studio and the render"): the run's
// storyboard served on a local page with the player's keys — space plays, the arrows step a frame, page up
// and page down jump between scenes — that reloads whenever the storyboard or the settings change.
//
// It writes the page's `input.json` as the render does, then watches the run's folder: a change to
// `storyboard.json` or `settings.json` writes it again and reloads the page. A storyboard the check refuses
// is not shown: each error is one line, and the page keeps the last one that read, until it is fixed.
// Clips play from their files; the music is the render's business, not the studio's.
import { watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { checkRunFolder, findingLine } from './check.ts';
import type { Warn } from './providers/registry.ts';
import type { Fetch } from './providers/types.ts';
import { RUN_SETTINGS, RenderRefused, runSettings, runStoryboard, writePageInput } from './render-input.ts';
import { serveRun } from './render-server.ts';
import { STORYBOARD_FILE } from './storyboard.ts';

/** How long the studio waits for a burst of changes to end before it reloads. */
const SETTLE_MS = 150;
/** The files whose change reloads the page. */
const WATCHED = Object.freeze([STORYBOARD_FILE, RUN_SETTINGS]);

export type Studio = { url: string; close: () => Promise<void> };

/** Writes the page's input from the run's storyboard and settings; false, with each error said, when they do not read. */
export async function refreshInput(dir: string, { fetch, warn }: { fetch: Fetch; warn: Warn }): Promise<boolean> {
  const { errors } = checkRunFolder(dir);
  for (const finding of errors) warn(`error: ${findingLine(finding)}`);
  if (errors.length > 0) return false;
  try {
    await writePageInput(dir, { storyboard: runStoryboard(dir), settings: runSettings(dir), credits: [], fetch, warn });
  } catch (error) {
    if (!(error instanceof RenderRefused)) throw error;
    for (const line of error.lines) warn(`error: ${line}`);
    return false;
  }
  return true;
}

/** Calls `run` once a burst of calls has been quiet for `ms`. */
function debounced(run: () => void, ms: number): () => void {
  let timer: NodeJS.Timeout | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(run, ms);
  };
}

/** Serves the run in `dir` with the player's keys, reloading the page on each change; its address. */
export async function openStudio(dir: string, { fetch, warn, onReload }: { fetch: Fetch; warn: Warn; onReload?: () => void }): Promise<Studio> {
  if (!(await refreshInput(dir, { fetch, warn }))) throw new RenderRefused([`${STORYBOARD_FILE} cannot be shown yet: fix the errors above`]);
  const server = await serveRun({ dir });
  const reload = debounced(() => {
    void refreshInput(dir, { fetch, warn }).then((fresh) => {
      if (!fresh) return;
      server.notify();
      onReload?.();
    });
  }, SETTLE_MS);
  const watcher: FSWatcher = watch(dir, (_, name) => {
    if (name !== null && WATCHED.includes(name)) reload();
  });
  return {
    url: server.page({ studio: true, events: '/events' }),
    close: async () => {
      watcher.close();
      await server.close();
    },
  };
}
