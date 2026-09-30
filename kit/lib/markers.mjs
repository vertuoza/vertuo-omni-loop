// Every HTML-comment marker the outbox writes, derived from one configured prefix. The regexes carry
// no flags, exactly as upstream's literals did.
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function makeMarkers(prefix) {
  const p = escape(prefix);
  return Object.freeze({
    prefix,
    any: `<!-- ${prefix}`,
    comment: `<!-- ${prefix} -->`,
    prComment: `<!-- ${prefix}-pr -->`,
    // The status comment `/omni:pr` keeps on every pull request, read by the Engineering board (PRD 714).
    status: `<!-- ${prefix}-status -->`,
    settledOpen: (id) => `<!-- ${prefix}-settled: ${id} -->`,
    settledClose: (id) => `<!-- /${prefix}-settled: ${id} -->`,
    settledOpenRe: new RegExp(`^<!-- ${p}-settled: (.+?) -->$`),
    announcedPrefix: `<!-- ${prefix}-announced: `,
    announcedSuffix: ' -->',
    announcedRe: new RegExp(`<!-- ${p}-announced: (.*?) -->`),
    numbersPrefix: `<!-- ${prefix}-numbers: `,
    numbersSuffix: ' -->',
    numbersRe: new RegExp(`<!-- ${p}-numbers: (.*?) -->`),
    round: (n, numbers) => `<!-- ${prefix}-round: ${n} ${numbers.join(',')} -->`,
    roundRe: new RegExp(`<!-- ${p}-round: (\\d+) ([\\d,]*) -->`),
  });
}
