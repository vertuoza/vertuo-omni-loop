// Readers for the delivery layer's file formats. They read; they never grade — the guards in the
// engineering repositories do that (spec §8).

export function parseFrontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function numberList(value) {
  if (!value || value === 'none') return [];
  return value.replace(/[[\]]/g, '').split(',').map((s) => Number(s.trim())).filter(Number.isInteger);
}

export function parseInbox(text) {
  const fm = parseFrontMatter(text);
  return { prd: Number(fm.prd), title: fm.title ?? '', blockedBy: numberList(fm['blocked-by']), plan: fm.plan && fm.plan !== 'none' ? fm.plan : null };
}

export function parseOutboxItem(text) {
  const fm = parseFrontMatter(text);
  return { id: fm.id, rank: fm.rank, raised: fm.raised };
}

export function parseSettled(text) {
  const entries = new Map();
  const parts = text.split(/<!-- vertuo-outbox-settled: ([^\s]+) -->/);
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const body = parts[i + 1] ?? '';
    const field = (name) => body.match(new RegExp(`^- ${name}: (.+)$`, 'm'))?.[1]?.trim() ?? null;
    const approvedBy = field('Approved by') ?? '';
    const asked = approvedBy.match(/asked of ([^\s)]+)/);
    entries.set(id, { verdict: field('Verdict'), at: field('Approved at'), by: asked ? asked[1] : approvedBy.split(' ')[0], rank: field('Rank') });
  }
  return entries;
}

export function parsePlanSlices(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 8 || !/^s\d+$/.test(cells[1])) continue;
    const blocked = cells[5] === '—' || cells[5] === '' ? [] : cells[5].split(',').map((s) => s.trim());
    rows.push({ id: cells[1], blockedBy: blocked, wave: Number(cells[6]) });
  }
  return rows;
}
