// A person's Agree with a fleet decision, written to the ledger (PRD omni-loop-21 s12). Kept apart from `overturn.ts`, which the
// arcade's Missions tab bundles for the browser: it reads the ledger through `../outbox/settle.ts`, which imports `node:fs`.
// Pure all the same: it takes `settled.md`'s text and answers the new one. The Omni app's `settle.ts` calls it.
import { parseItem, parseSettledEntries, renderSettledEntry, type Markers } from '../outbox/settle.ts';

/** The ledger's markers, as an Agree reads and writes them. */
type AgreeMarkers = Pick<Markers, 'settledOpenRe' | 'settledClose' | 'settledOpen'>;

/** What an Agree did to the ledger: its new text and the entry it appended, or why none was appended (`gone`: nothing to agree with). */
export type Agreed = { ok: true; text: string; entry: string } | { ok: false; why: string; gone?: true };

/**
 * The ledger once a person agreed with the fleet's answer to item `item` (pure, over `settled.md`'s text): one more entry, appended,
 * the item as raised and the option the fleet took, `Approved by: <login>`. Refused, `gone`, when the item's latest entry is no
 * fleet's: a person settled it already, or it was never settled here.
 */
export function agreeEntry({ settled, markers, item, login, at }: { settled: string; markers: AgreeMarkers; item: string; login: string; at: string }): Agreed {
  const latest = parseSettledEntries(settled, markers).find((entry) => entry.id === item);
  if (latest === undefined) return { ok: false, why: `${item}: it has no settled entry on the mission branch`, gone: true };
  const by = latest.fields['Approved by'] ?? '';
  if (!by.startsWith('fleet ')) return { ok: false, why: `${item}: ${by === '' ? 'its latest entry names nobody' : `${by} answered it already`}`, gone: true };
  const parsed = parseItem(latest.itemText, null);
  if (!parsed.ok) return { ok: false, why: `${item}: the item the ledger kept does not read: ${parsed.errors.join('; ')}` };
  const option = latest.answerText.split('\n')[0] ?? '';
  const entry = renderSettledEntry({
    item: parsed.item,
    itemText: latest.itemText,
    answer: { text: [option, '', `${login} agreed with the answer ${by} gave, on the mission pull request.`].join('\n'), approvedBy: login, approvedAt: at, channel: null },
    judgement: { verdict: 'agreed', basis: 'person', reason: `${login} agreed with the answer ${by} gave for the mission branch` },
    markers,
  });
  return { ok: true, text: `${settled}${settled.endsWith('\n') ? '\n' : '\n\n'}${entry}`, entry };
}
