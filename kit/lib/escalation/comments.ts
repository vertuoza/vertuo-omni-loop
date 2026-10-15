// The two comments escalation keeps on a pull request (PRD 1794), rendered and read back here alone so
// the App and the Omni page never redefine them:
//
// - **The record,** `<!-- omni:escalation -->`, edited in place after each outbox check run: one line
//   per held thing, when it was first held, who is asked now and when the next step falls due. It
//   mentions nobody (an edited comment notifies nobody anyway), and it is the only memory: deleting
//   it restarts the count.
// - **An ask,** a new comment per step, carrying `<!-- omni:escalation-ask <thing> <step> -->` once per
//   thing it asks about, and mentioning the people newly asked so GitHub notifies them.
import type { Decision, HeldKind, Step } from './escalation.ts';

export const RECORD_MARKER = '<!-- omni:escalation -->';

/** The marker of the ask about `thing` at `step`. */
export const ASK_MARKER = (thing: string, step: Step): string => `<!-- omni:escalation-ask ${thing} ${String(step)} -->`;

const ASK_RE = /<!-- omni:escalation-ask (\S+) ([12]) -->/g;

/** One line of the record: a decision without whom its step added, which only the ask needs. */
export type RecordLine = Omit<Decision, 'newlyAsked'>;

/** One thing an ask comment asks about, at its step. */
export type AskedStep = { readonly thing: string; readonly step: Step };

const NOBODY = 'nobody yet';
const LAST = 'no step follows';

const LINE_RE =
  /^- (?<kind>law|item) `(?<thing>[^`\s]+)` · held since (?<firstHeld>\S+) · step (?<step>[012]) · asked (?<asked>.+?) · (?:next step due (?<nextDue>\S+)|no step follows)$/;

function renderLine(one: RecordLine): string {
  const asked = one.asked.length > 0 ? one.asked.join(', ') : NOBODY;
  const next = one.nextDue === null ? LAST : `next step due ${one.nextDue}`;
  return `- ${one.kind} \`${one.thing}\` · held since ${one.firstHeld} · step ${String(one.step)} · asked ${asked} · ${next}`;
}

/** The record's body: its marker, one plain paragraph, one line per held thing. */
export function renderRecord(held: readonly RecordLine[]): string {
  return [
    RECORD_MARKER,
    '**Waiting on a person.** When nobody answers, the loop asks more people, in working days (Monday to Friday, UTC). It never approves or adopts anything: only a person ends the wait.',
    '',
    ...(held.length > 0 ? held.map(renderLine) : ['Nothing waits on a person.']),
  ].join('\n');
}

const asStep = (digit: string | undefined): Step => (digit === '2' ? 2 : digit === '1' ? 1 : 0);

const readAsked = (asked: string): string[] => (asked === NOBODY ? [] : asked.split(', '));

function readLine(line: string): RecordLine | null {
  const groups = LINE_RE.exec(line)?.groups;
  if (groups === undefined) return null;
  const field = (name: string): string => groups[name] ?? '';
  return {
    thing: field('thing'),
    kind: field('kind') === 'law' ? 'law' : 'item',
    firstHeld: field('firstHeld'),
    step: asStep(groups.step),
    asked: readAsked(field('asked')),
    nextDue: groups.nextDue ?? null,
  };
}

/** The held things a record holds, or `null` for a comment that is no record. A line out of shape is skipped. */
export function readRecord(body: string): RecordLine[] | null {
  if (!body.startsWith(RECORD_MARKER)) return null;
  return body.split('\n').flatMap((line) => {
    const one = readLine(line.trimEnd());
    return one === null ? [] : [one];
  });
}

const kindWord = (kind: HeldKind): string => (kind === 'law' ? 'The change to the locked law' : 'The open question');

/**
 * The ask comment for the things whose step just fell due: a marker per thing, one mention of each
 * person newly asked, since when each has waited, and that being asked lets nobody clear it alone.
 */
export function renderAsk(due: readonly Decision[]): string {
  const people = [...new Set(due.flatMap((one) => one.newlyAsked))];
  return [
    ...due.map((one) => ASK_MARKER(one.thing, one.step)),
    `${people.map((login) => `@${login}`).join(' ')}: this pull request waits on a person.`,
    '',
    ...due.map((one) => `- ${kindWord(one.kind)} \`${one.thing}\` has waited since ${one.firstHeld}.`),
    '',
    'Only a login CODEOWNERS lists clears a law by approving, and only a writer of the repository answers a question. Nothing has been approved or adopted for you.',
  ].join('\n');
}

/** The things and steps an ask comment asks about; none for a comment without the marker. */
export function readAsk(body: string): AskedStep[] {
  return [...body.matchAll(ASK_RE)].flatMap(([, thing, step]) =>
    thing === undefined || step === undefined ? [] : [{ thing, step: asStep(step) }],
  );
}
