// `render`: pure. The harvest's result in, the knowledge PR's title, body and commit out (PRD 82, "The
// knowledge PR"); and the pipeline's edit set turned into what the shared git writer commits.
//
// The body lists every decision the run looked at: the proposed principles first (a person's call),
// then one table row per placed decision, matching its ledger line, then the ones not placed as
// checkboxes, then what the merge settled and shipped and how the checks came out.

/** The line every harvest commit carries, which a replay reads to know it already committed. */
export function commitMarker(prNumber) {
  return `The knowledge harvest of #${prNumber}.`;
}

/** `docs(knowledge): PRD <n> — <title>` */
export function knowledgeTitle(prd) {
  return `docs(knowledge): PRD ${prd.number} — ${prd.title}`;
}

/** The commit message: the title, then the marker a replay looks for. */
export function commitMessage({ prd, merge }) {
  return `${knowledgeTitle(prd)}\n\n${commitMarker(merge.pr)} Merged by @${bare(merge.by)}.`;
}

const bare = (who) => String(who ?? '').replace(/^@/, '');
const day = (value) => String(value ?? '').slice(0, 10);
const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/** Where a placed decision landed, as its row says it. */
export function landedAs(entry) {
  if (entry.kind === 'stays-here') return 'stays here';
  if (entry.kind === 'covered') return `covered by ${entry.landedAs.join(', ')}`;
  const standing = entry.kind === 'adr' ? entry.status : entry.proposed ? 'proposed' : 'confirmed';
  return `${entry.landedAs.join(', ')} (new, ${standing})`;
}

/** Who decided, short: the `Decided:` line without its date, "nobody — adopted" for a medium item. */
export function decidedShort(decided) {
  const text = String(decided ?? '').replace(/,\s*\d{4}-\d{2}-\d{2}$/, '');
  if (text.startsWith('nobody')) return 'nobody — adopted';
  return text;
}

function checkMark(name, violations) {
  return violations.length === 0 ? `omni check ${name} ✓` : `omni check ${name} ✗ (${violations.length})`;
}

/** A path under the delivery folder, relative to it. */
function underDelivery(path, delivery) {
  const prefix = `${delivery.replace(/\/+$/, '')}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/**
 * The knowledge PR's body.
 * @param {{ prd: { number: number }, merge: { by: string, at: string, pr: number },
 *   settled: { id: string, from: 'open' | 'drift' }[], shipped: { from: string, to: string }[],
 *   placed: object[], notPlaced: { id: string, reason: string }[],
 *   checks: { knowledge: string[], outbox: string[] }, delivery: string }} input
 */
export function knowledgeBody({ prd, merge, settled, shipped, placed, notPlaced, checks, delivery }) {
  const by = `@${bare(merge.by)}`;
  const lines = [`Refs #${prd.number} · Knowledge from #${merge.pr}, merged by ${by} on ${day(merge.at)}`, ''];

  const principles = placed.filter((entry) => entry.kind === 'rule' && entry.landedAs.length > 1);
  if (principles.length > 0) {
    const list = principles.map((entry) => `${entry.landedAs.slice(1).join(', ')} (serves ${entry.landedAs[0]})`);
    lines.push(`**Proposed principles — a person's call:** ${list.join(' · ')}`, '');
  }

  if (placed.length > 0) {
    lines.push('| Decision | Landed as | Decided | Why there |', '|---|---|---|---|');
    for (const entry of placed) {
      lines.push(`| ${cell(entry.id)} | ${cell(landedAs(entry))} | ${cell(decidedShort(entry.decided))} | ${cell(entry.reason)} |`);
    }
    lines.push('');
  }

  if (notPlaced.length > 0) {
    lines.push('**Not placed:**');
    for (const entry of notPlaced) lines.push(`- [ ] ${entry.id} — ${String(entry.reason).split('\n')[0]}`);
    lines.push('');
  }

  const facts = [];
  if (settled.length > 0) {
    const open = settled.filter((entry) => entry.from === 'open').length;
    const drift = settled.length - open;
    const parts = [`${open} open item${open === 1 ? '' : 's'}`];
    if (drift > 0) parts.push(`${drift} drift${drift === 1 ? '' : 's'} never reworked`);
    facts.push(`Settled at merge: ${parts.join(', ')}, adopted by ${by} (merged over a red outbox)`);
  }
  if (shipped.length > 0) {
    const [folder] = shipped;
    facts.push(`Shipped at merge: ${underDelivery(folder.from, delivery)} → ${underDelivery(folder.to, delivery)}`);
  }
  facts.push(`Checks: ${checkMark('knowledge', checks.knowledge)} · ${checkMark('outbox', checks.outbox)}`);
  lines.push(...facts, '');

  lines.push('Proposed entries resolve but bind nothing until a person deletes their `Proposed:` line.');
  return `${lines.join('\n')}\n`;
}

/**
 * The pipeline's edit set as the shared git writer commits it. The pipeline moves whole folders and
 * then writes some of the moved files (the ledger, the plan's rewritten paths); the writer moves by
 * reusing blobs. So a folder move becomes one move per file under it, leaving out the files the edit
 * set deletes, and a moved file the edit set writes becomes a delete of its old path and a write of
 * its new one: no path is ever both moved and written in one tree.
 *
 * @param {{ deletes: string[], moves: { from: string, to: string }[], writes: { path: string, text: string }[] }} edits
 * @param {string[]} filesBefore every file of the tree the edits apply to, before them
 * @returns {{ files: { path: string, content: string }[], moves: { from: string, to: string }[], deletes: string[] }}
 */
export function toCommit(edits, filesBefore) {
  const deleted = new Set(edits.deletes);
  const written = new Set(edits.writes.map((write) => write.path));
  const moves = [];
  const deletes = [...edits.deletes];
  for (const move of edits.moves) {
    const under = filesBefore.filter((file) => file === move.from || file.startsWith(`${move.from}/`));
    for (const file of under) {
      if (deleted.has(file)) continue;
      const to = file === move.from ? move.to : `${move.to}${file.slice(move.from.length)}`;
      if (written.has(to)) deletes.push(file);
      else moves.push({ from: file, to });
    }
  }
  return {
    files: edits.writes.map(({ path, text }) => ({ path, content: text })),
    moves,
    deletes,
  };
}
