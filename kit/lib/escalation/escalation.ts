// Who is asked about a thing that waits on a person (PRD 1794): a locked law `law-locked` still holds,
// or an open `high` or `human-action` item of a feature PR. Pure: the held things, the time each was
// first held, now and the repository's settings in; for each thing its step, who is asked at it and
// when the next step falls due out. It reads no file and makes no request.
//
// Asking never decides: nothing here approves, adopts, answers, labels or sets a verdict, so its
// output has no field that could. Only a person ends a held thing, by answering it.
//
// | step | when                                   | a held law             | a held item                      |
// |------|----------------------------------------|------------------------|----------------------------------|
// | 0    | first held                             | its CODEOWNERS (today) | the PR and the PRD's opener      |
// | 1    | `workingDays` working days later       | each owner's delegate  | each owner and each delegate     |
// | 2    | `workingDays` more working days later  | + leadership           | + leadership                     |
//
// Step 0's people are asked as before, outside this module: `asked` names only whom the loop adds.

/** An entry of `laws.owners`: a plain owner (a login or `<org>/<team>`), or an owner with a delegate login. */
export type EscalationOwner = string | { readonly login: string; readonly delegate: string };

/** What escalation reads from the config: `laws.owners`, `laws.leadership`, `limits.escalationWorkingDays`. */
export type EscalationSettings = {
  readonly owners: readonly EscalationOwner[];
  readonly leadership: readonly string[];
  readonly workingDays: number;
};

/** What waits on a person: a locked law, by its id, or an outbox item, by its id. */
export type HeldKind = 'law' | 'item';

/** A thing that waits on a person, the instant it was first seen held, and whether a person answered it. */
export type HeldThing = {
  readonly thing: string;
  readonly kind: HeldKind;
  /** ISO 8601, as the record keeps it. */
  readonly firstHeld: string;
  readonly answered: boolean;
};

/** The escalation step: 0 as today, 1 and 2 widen who is asked. */
export type Step = 0 | 1 | 2;

/** Where a held thing stands now. */
export type Decision = {
  readonly thing: string;
  readonly kind: HeldKind;
  readonly firstHeld: string;
  readonly step: Step;
  /** Every login (or team) the loop asks at this step, beyond step 0's people, without `@`. */
  readonly asked: readonly string[];
  /** Those of `asked` this step adds to the step before: the people an ask comment mentions. */
  readonly newlyAsked: readonly string[];
  /** When the next step falls due, ISO 8601 to the second; `null` when no step follows. */
  readonly nextDue: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SATURDAY = 6;
const SUNDAY = 0;

const isWeekend = (date: Date): boolean => date.getUTCDay() === SATURDAY || date.getUTCDay() === SUNDAY;

/** Monday 00:00 UTC after a weekend instant; any weekday instant as it is. */
function workingStart(date: Date): Date {
  if (!isWeekend(date)) return date;
  const days = date.getUTCDay() === SATURDAY ? 2 : 1;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

/**
 * `days` working days after `start`: Monday to Friday, in UTC, with no holidays. A start on a weekend
 * counts from Monday 00:00 UTC, so two working days after Friday 15:00 is Tuesday 15:00.
 */
export function addWorkingDays(start: Date, days: number): Date {
  let at = workingStart(start);
  for (let left = days; left > 0; ) {
    at = new Date(at.getTime() + DAY_MS);
    if (!isWeekend(at)) left -= 1;
  }
  return at;
}

const bare = (login: string): string => login.replace(/^@/, '');

const loginOf = (owner: EscalationOwner): string => bare(typeof owner === 'string' ? owner : owner.login);

const delegatesOf = (owners: readonly EscalationOwner[]): string[] =>
  owners.flatMap((owner) => (typeof owner === 'string' ? [] : [bare(owner.delegate)]));

/** Whether the settings ask anyone: a repository with no delegate and no leadership escalates nothing. */
export function escalates(settings: EscalationSettings): boolean {
  return delegatesOf(settings.owners).length > 0 || settings.leadership.length > 0;
}

/** `logins` without a repeat, compared without case or `@`, in first-seen order. */
function unique(logins: readonly string[]): string[] {
  const seen = new Set<string>();
  return logins.filter((login) => {
    const key = login.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Whom the loop asks at `step`, for a thing of `kind`. */
function askedAt(kind: HeldKind, step: Step, settings: EscalationSettings): string[] {
  if (step === 0) return [];
  const first = kind === 'law' ? delegatesOf(settings.owners) : settings.owners.flatMap((owner) => {
    const login = loginOf(owner);
    return typeof owner === 'string' ? [login] : [login, bare(owner.delegate)];
  });
  return unique(step === 1 ? first : [...first, ...settings.leadership.map(bare)]);
}

/** An instant as the record writes it: ISO 8601 to the second. */
const instant = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

function parseInstant(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`escalation: firstHeld ${JSON.stringify(iso)} is not an instant`);
  return date;
}

/** The step a thing first held at `first` has reached at `now`, and when the next one falls due. */
function stepAt(first: Date, now: Date, workingDays: number): { step: Step; nextDue: string | null } {
  const due1 = addWorkingDays(first, workingDays);
  if (now < due1) return { step: 0, nextDue: instant(due1) };
  const due2 = addWorkingDays(due1, workingDays);
  if (now < due2) return { step: 1, nextDue: instant(due2) };
  return { step: 2, nextDue: null };
}

/** The step before `step`. */
const previous = (step: Step): Step => (step === 2 ? 1 : 0);

/** Where `held` stands at `now`. An answered thing, or a repository that escalates nothing, asks nobody. */
function decideOne(held: HeldThing, now: Date, settings: EscalationSettings): Decision {
  const base = { thing: held.thing, kind: held.kind, firstHeld: held.firstHeld };
  const { step, nextDue } = stepAt(parseInstant(held.firstHeld), now, settings.workingDays);
  if (held.answered) return { ...base, step, asked: [], newlyAsked: [], nextDue: null };
  if (!escalates(settings)) return { ...base, step: 0, asked: [], newlyAsked: [], nextDue: null };
  const asked = askedAt(held.kind, step, settings);
  const before = new Set(askedAt(held.kind, previous(step), settings).map((login) => login.toLowerCase()));
  return { ...base, step, asked, newlyAsked: asked.filter((login) => !before.has(login.toLowerCase())), nextDue };
}

/** Where each held thing stands at `now`, in the order given. */
export function decide(held: readonly HeldThing[], now: Date, settings: EscalationSettings): Decision[] {
  return held.map((one) => decideOne(one, now, settings));
}
