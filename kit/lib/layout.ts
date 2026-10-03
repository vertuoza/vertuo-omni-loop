// Where a PRD lives. The folder is the status: `inbox/<prd>-<topic>/` is approved and not shipped,
// `shipped/<prd>-<topic>/` is merged. Every other module asks this one and never builds a delivery
// path itself. It also names where the playbook's forms live: the playbook folder, its parent (the
// front door of the knowledge), and each form's file.
//
// A concept (PRD 686) waits in the inbox too, one folder `<nnnn>-<slug>` per concept under
// `inbox/concepts/`. `concepts` is no `<prd>-<topic>` name, so every reader of PRD folders here skips
// it by construction: it is never a PRD's folder, spec or outbox.
import { existsSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { PrdNumberSchema } from './ids.ts';
import type { PrdNumber } from './ids.ts';
import { DECISIONS_FORM, FORM_IDS } from './playbook/forms.ts';

/** A PRD's folder name, `<nnnn>-<topic>`: the one pattern every reader of a folder name asks. */
const FOLDER = /^(\d{4,})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** The `paths` config section this module reads. */
export type LayoutPaths = { delivery: string; adr: string; knowledge: string; playbook: string };

/** Where a PRD's folder is: its name, whether it is in the inbox or shipped, and its path. */
type PrdPlace = { name: string; state: 'inbox' | 'shipped'; dir: string };

/** One outbox folder: its PRD, its path, and whether it sits inside a shipped folder. */
type OutboxDir = { prd: PrdNumber; dir: string; shipped: boolean };

export function padPrd(prd: PrdNumber): string {
  return String(prd).padStart(4, '0');
}

/** A PRD folder's number and topic, or `null` for a name that is not `<nnnn>-<topic>` (or whose
 * number is no PRD's, `0000`). */
export function parseFolderName(name: string): { prd: PrdNumber; topic: string } | null {
  const match = FOLDER.exec(name);
  if (!match) return null;
  const [, digits = '', topic = ''] = match;
  const prd = PrdNumberSchema.safeParse(Number(digits));
  return prd.success ? { prd: prd.data, topic } : null;
}

export function foldersLayout(root: string, paths: LayoutPaths) {
  const base = paths.delivery;
  const dirs = {
    inbox: `${base}/inbox`,
    outbox: `${base}/outbox`,
    shipped: `${base}/shipped`,
    archive: `${base}/archive`,
    concepts: `${base}/inbox/concepts`,
  };

  /** The PRD folders under `dir`, by name, each with its number. */
  function folders(dir: string): { name: string; prd: PrdNumber }[] {
    const absolute = join(root, dir);
    if (!existsSync(absolute)) return [];
    return readdirSync(absolute, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        const parsed = parseFolderName(entry.name);
        return parsed ? [{ name: entry.name, prd: parsed.prd }] : [];
      })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  function find(dir: string, prd: PrdNumber): string | null {
    return folders(dir).find((folder) => folder.prd === prd)?.name ?? null;
  }

  function whereIs(prd: PrdNumber): PrdPlace | null {
    const inbox = find(dirs.inbox, prd);
    if (inbox) return { name: inbox, state: 'inbox', dir: `${dirs.inbox}/${inbox}` };
    const shipped = find(dirs.shipped, prd);
    if (shipped) return { name: shipped, state: 'shipped', dir: `${dirs.shipped}/${shipped}` };
    return null;
  }

  const frontDoor = posix.dirname(paths.playbook);

  const inFolder = (file: string) => (prd: PrdNumber): string | null => {
    const where = whereIs(prd);
    return where ? `${where.dir}/${file}` : null;
  };

  return Object.freeze({
    kind: 'folders',
    dirs,
    adrDir: paths.adr,
    knowledgeRoot: paths.knowledge,
    frontDoor,
    playbookDir: paths.playbook,
    /** A form's file: the decisions form beside the decision records under the front door, every
     * other form in the playbook folder; `null` for a form the kit does not have. */
    formPath(form: string): string | null {
      if (!FORM_IDS.includes(form)) return null;
      return form === DECISIONS_FORM ? `${frontDoor}/adr/README.md` : `${paths.playbook}/${form}.md`;
    },
    whereIs,
    specPath: inFolder('spec.md'),
    planPath: inFolder('plan.md'),
    beforeAfterPath: inFolder('before-after.html'),
    outboxDir(prd: PrdNumber): string | null {
      const where = whereIs(prd);
      if (where?.state === 'shipped') return `${where.dir}/outbox`;
      if (where) return `${dirs.outbox}/${where.name}`;
      const orphan = find(dirs.outbox, prd);
      return orphan ? `${dirs.outbox}/${orphan}` : null;
    },
    outboxDirs(): OutboxDir[] {
      const out: OutboxDir[] = folders(dirs.outbox).map(({ name, prd }) => ({ prd, dir: `${dirs.outbox}/${name}`, shipped: false }));
      for (const { name, prd } of folders(dirs.shipped)) {
        const dir = `${dirs.shipped}/${name}/outbox`;
        if (existsSync(join(root, dir))) out.push({ prd, dir, shipped: true });
      }
      return out;
    },
    specFiles(): string[] {
      return folders(dirs.inbox).map(({ name }) => `${dirs.inbox}/${name}/spec.md`);
    },
  });
}

/** Where a repository's PRDs, outboxes, decision records and playbook forms live. */
export type Layout = ReturnType<typeof foldersLayout>;
