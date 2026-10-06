// Every HTML-comment marker the outbox writes, derived from one configured prefix. The regexes carry
// no flags, exactly as upstream's literals did.
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function makeMarkers(prefix: string) {
  const p = escape(prefix);
  return Object.freeze({
    prefix,
    any: `<!-- ${prefix}`,
    comment: `<!-- ${prefix} -->`,
    prComment: `<!-- ${prefix}-pr -->`,
    // The status comment `/omni:pr` keeps on every pull request, read by the Engineering board (PRD 714).
    status: `<!-- ${prefix}-status -->`,
    settledOpen: (id: string): string => `<!-- ${prefix}-settled: ${id} -->`,
    settledClose: (id: string): string => `<!-- /${prefix}-settled: ${id} -->`,
    settledOpenRe: new RegExp(`^<!-- ${p}-settled: (.+?) -->$`),
    announcedPrefix: `<!-- ${prefix}-announced: `,
    announcedSuffix: ' -->',
    announcedRe: new RegExp(`<!-- ${p}-announced: (.*?) -->`),
    numbersPrefix: `<!-- ${prefix}-numbers: `,
    numbersSuffix: ' -->',
    numbersRe: new RegExp(`<!-- ${p}-numbers: (.*?) -->`),
    round: (n: number, numbers: readonly number[]): string => `<!-- ${prefix}-round: ${n} ${numbers.join(',')} -->`,
    roundRe: new RegExp(`<!-- ${p}-round: (\\d+) ([\\d,]*) -->`),
  });
}
