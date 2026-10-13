// What grew behind a budget target, read from git (PRD 1679): the files a target is made of — a
// form's own file and every file its pointers read, a context file, or, for `session`, the briefing's
// and every context file's — each with the bytes it gained since the base, and the commits of the
// range that changed them. The red message (`./message.ts`) prints it; the Omni App gathers the
// same from GitHub.
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Context, ExecText } from '../context.ts';
import { resolveForm } from '../playbook/resolve.ts';
import { formTemplate } from '../playbook/templates.ts';
import type { GrownFile, Growth } from './message.ts';
import { BRIEFING, SESSION } from './measure.ts';

type Ctx = Pick<Context, 'root' | 'layout' | 'config'>;

/** The most commits a target's growth lists. */
const MAX_COMMITS = 10;

const POINTER_LABEL = /^\[→ ([^\]#]+)(?:#[^\]]*)?\]$/;

/** A form's own file, then every file its pointers read, once each. */
function formFiles(ctx: Ctx, form: string): string[] {
  const own = ctx.layout.formPath(form);
  const resolved = resolveForm(form, { ctx, template: formTemplate(form) });
  const pointed = resolved.sections.flatMap(({ label }) => POINTER_LABEL.exec(label)?.[1] ?? []);
  return [...new Set([...(own === null ? [] : [own]), ...pointed])];
}

/** The files a target is made of. */
function targetFiles(ctx: Ctx, target: string): string[] {
  if (target === BRIEFING) return formFiles(ctx, BRIEFING);
  if (target === SESSION) return [...formFiles(ctx, BRIEFING), ...ctx.config.paths.context];
  if (target.startsWith('form:')) return formFiles(ctx, target.slice('form:'.length));
  if (target.startsWith('context:')) return [target.slice('context:'.length)];
  return [];
}

function git(ctx: Ctx, args: readonly string[], exec: ExecText): string | null {
  try {
    return exec('git', args, { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** A file's size in the checkout, `0` when it is not there; `null` for a folder. */
function headSize(ctx: Ctx, path: string): number | null {
  const file = join(ctx.root, path);
  if (!existsSync(file)) return 0;
  const stat = statSync(file);
  return stat.isFile() ? stat.size : null;
}

/** A file's size at `base`, `0` when it is not there. */
function baseSize(ctx: Ctx, base: string, path: string, exec: ExecText): number {
  const size = git(ctx, ['cat-file', '-s', `${base}:${path}`], exec);
  return size === null ? 0 : Number(size.trim());
}

/**
 * What grew behind `target` since `base` (a commit, the range's merge base): each of its files with
 * the bytes it gained, those that did not change left out, and up to ten commits of `base..HEAD` that
 * changed them. With no base, every file, with no byte count and no commit.
 */
export function targetGrowth({ ctx, target, base, exec = execFileSync }: { ctx: Ctx; target: string; base: string | null; exec?: ExecText }): Growth {
  const paths = targetFiles(ctx, target);
  if (base === null) return { files: paths.map((path) => ({ path, bytesAdded: null })), commits: [] };
  const files = paths.flatMap((path): GrownFile[] => {
    const head = headSize(ctx, path);
    if (head === null) return [{ path, bytesAdded: null }];
    const bytesAdded = head - baseSize(ctx, base, path, exec);
    return bytesAdded === 0 ? [] : [{ path, bytesAdded }];
  });
  const log = paths.length === 0 ? null : git(ctx, ['log', `--max-count=${MAX_COMMITS}`, '--format=%h%x09%s', `${base}..HEAD`, '--', ...paths], exec);
  const commits = (log ?? '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha = '', ...subject] = line.split('\t');
      return { sha, subject: subject.join('\t') };
    });
  return { files, commits };
}
