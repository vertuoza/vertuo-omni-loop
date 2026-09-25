// Where a PRD lives. The folder is the status: `inbox/<prd>-<topic>/` is approved and not shipped,
// `shipped/<prd>-<topic>/` is merged. Every other module asks this one and never builds a delivery
// path itself. It also names where the playbook's forms live: the playbook folder, its parent (the
// front door of the knowledge), and each form's file.
import { existsSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { DECISIONS_FORM, FORM_IDS } from './playbook/forms.mjs';

const FOLDER = /^(\d{4,})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function padPrd(prd) {
  return String(Number(prd)).padStart(4, '0');
}

export function parseFolderName(name) {
  const match = FOLDER.exec(name);
  return match ? { prd: Number(match[1]), topic: match[2] } : null;
}

export function foldersLayout(root, paths) {
  const base = paths.delivery;
  const dirs = {
    inbox: `${base}/inbox`,
    outbox: `${base}/outbox`,
    shipped: `${base}/shipped`,
    archive: `${base}/archive`,
  };

  function folders(dir) {
    const absolute = join(root, dir);
    if (!existsSync(absolute)) return [];
    return readdirSync(absolute, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && parseFolderName(entry.name))
      .map((entry) => entry.name)
      .sort();
  }

  function find(dir, prd) {
    const wanted = Number(prd);
    return folders(dir).find((name) => parseFolderName(name).prd === wanted) ?? null;
  }

  function whereIs(prd) {
    const inbox = find(dirs.inbox, prd);
    if (inbox) return { name: inbox, state: 'inbox', dir: `${dirs.inbox}/${inbox}` };
    const shipped = find(dirs.shipped, prd);
    if (shipped) return { name: shipped, state: 'shipped', dir: `${dirs.shipped}/${shipped}` };
    return null;
  }

  const frontDoor = posix.dirname(paths.playbook);

  const inFolder = (file) => (prd) => {
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
    formPath(form) {
      if (!FORM_IDS.includes(form)) return null;
      return form === DECISIONS_FORM ? `${frontDoor}/adr/README.md` : `${paths.playbook}/${form}.md`;
    },
    whereIs,
    specPath: inFolder('spec.md'),
    planPath: inFolder('plan.md'),
    beforeAfterPath: inFolder('before-after.html'),
    outboxDir(prd) {
      const where = whereIs(prd);
      if (where?.state === 'shipped') return `${where.dir}/outbox`;
      if (where) return `${dirs.outbox}/${where.name}`;
      const orphan = find(dirs.outbox, prd);
      return orphan ? `${dirs.outbox}/${orphan}` : null;
    },
    outboxDirs() {
      const out = folders(dirs.outbox).map((name) => ({ prd: parseFolderName(name).prd, dir: `${dirs.outbox}/${name}`, shipped: false }));
      for (const name of folders(dirs.shipped)) {
        const dir = `${dirs.shipped}/${name}/outbox`;
        if (existsSync(join(root, dir))) out.push({ prd: parseFolderName(name).prd, dir, shipped: true });
      }
      return out;
    },
    specFiles() {
      return folders(dirs.inbox).map((name) => `${dirs.inbox}/${name}/spec.md`);
    },
  });
}
