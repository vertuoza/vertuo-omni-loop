/**
 * **The environment, read as feature groups** (PRD 1059): the helpers every runtime's env module is
 * built from — the kit, the game and the scripts here, the GitHub App and the arcade beside it.
 *
 * - A **group** is the variables one feature needs, read together into one typed value: complete, or
 *   `null` when none of its variables is set (the feature is off). An empty string counts as unset.
 * - A group **half set** (one of its required variables set, another not), or a value its schema
 *   refuses (a URL that is not a URL), is a **problem** naming every variable concerned.
 * - A group required in production is a problem there when it is `null`.
 * - Every problem of one read is carried by one {@link EnvError}, which names variables and never
 *   holds a value: a secret set by mistake in the wrong variable never reaches a log.
 *
 * Pure, depending on zod only: a module reads its runtime's source (`process.env`, or a test's plain
 * object) once, with {@link envReader}, and hands each group to the code that needs it.
 */
import { z } from 'zod';

/** What a group is read from: `process.env`, or a test's plain object. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Where one member of a group is read: one variable, or a variable then its fallbacks, in order. */
export type EnvNames = string | readonly [string, ...string[]];

/** One feature's variables: its schema, the variable each member is read from, and when it is required. */
export type EnvGroup<S extends z.ZodObject> = {
  /** What the group is for, in a few plain words: `the Supabase pair`. */
  label: string;
  /** The members' schema: a member that may be left unset is `.optional()`. */
  schema: S;
  /** The variable each member of the schema is read from. */
  variables: { readonly [K in keyof S['shape']]-?: EnvNames };
  /** `production`: a read in production fails when the group is `null`. */
  required?: 'production';
};

/** One thing wrong with the environment: the variables concerned, and why, never a value. */
export type EnvProblem = { variables: string[]; reason: string };

/** Every problem one read of the environment found; its message names variables, never a value. */
export class EnvError extends Error {
  readonly problems: readonly EnvProblem[];

  constructor(problems: readonly EnvProblem[]) {
    super(`environment: ${problems.map((problem) => problem.reason).join('; ')}`);
    this.name = 'EnvError';
    this.problems = problems;
  }
}

/** A group, typed from its schema: the identity, so a module's groups are checked where they are written. */
export function envGroup<S extends z.ZodObject>(group: EnvGroup<S>): EnvGroup<S> {
  return group;
}

const listOf = (names: EnvNames): readonly string[] => (typeof names === 'string' ? [names] : names);

/** A member's variable as a sentence names it: `SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)`. */
function nameOf(names: EnvNames): string {
  const [first, ...rest] = listOf(names);
  return rest.length ? `${first} (or ${rest.join(' or ')})` : `${first}`;
}

const sentence = (names: readonly string[]): string =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
const verb = (names: readonly string[]): string => (names.length === 1 ? 'is' : 'are');

/** Every variable a group reads, as an error names them. */
export function groupVariables<S extends z.ZodObject>(group: EnvGroup<S>): string[] {
  return Object.values<EnvNames>(group.variables).map(nameOf);
}

/** The variables of a group's required members, as an error names them. */
function requiredVariables<S extends z.ZodObject>(group: EnvGroup<S>): string[] {
  return members(group).filter((member) => member.required).map((member) => member.name);
}

type Member = { key: string; names: EnvNames; name: string; required: boolean };

function members<S extends z.ZodObject>(group: EnvGroup<S>): Member[] {
  const shape: Record<string, z.ZodType> = group.schema.shape;
  return Object.entries<EnvNames>(group.variables).map(([key, names]) => ({
    key,
    names,
    name: nameOf(names),
    required: shape[key]?.safeParse(undefined).success !== true,
  }));
}

/** A member's value: the first of its variables that is set to something other than an empty string. */
function valueOf(source: EnvSource, names: EnvNames): string | undefined {
  for (const name of listOf(names)) {
    const value = source[name];
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

type Read<T> = { value: T | null; problems: EnvProblem[] };

/** One group read from `source`: its value, or `null` and the problems that stopped it. */
function readGroup<S extends z.ZodObject>(source: EnvSource, group: EnvGroup<S>, production: boolean): Read<z.output<S>> {
  const all = members(group);
  const raw: Record<string, string> = {};
  for (const member of all) {
    const value = valueOf(source, member.names);
    if (value !== undefined) raw[member.key] = value;
  }
  const set = all.filter((member) => Object.hasOwn(raw, member.key));
  if (set.length === 0) {
    if (group.required === 'production' && production) {
      const names = requiredVariables(group);
      return { value: null, problems: [{ variables: names, reason: `${sentence(names)} must be set in production (${group.label})` }] };
    }
    return { value: null, problems: [] };
  }
  const missing = all.filter((member) => member.required && !Object.hasOwn(raw, member.key));
  if (missing.length) {
    const unset = missing.map((member) => member.name);
    const given = set.map((member) => member.name);
    return {
      value: null,
      problems: [{
        variables: [...given, ...unset],
        reason: `${sentence(unset)} ${verb(unset)} not set while ${sentence(given)} ${verb(given)} (${group.label}: set all of them, or none)`,
      }],
    };
  }
  const parsed = group.schema.safeParse(raw);
  if (parsed.success) return { value: parsed.data, problems: [] };
  const byKey = new Map(all.map((member) => [member.key, member.name]));
  return {
    value: null,
    problems: parsed.error.issues.map((issue) => {
      const name = byKey.get(String(issue.path[0] ?? '')) ?? group.label;
      return { variables: [name], reason: `${name} is not valid: ${issue.message}` };
    }),
  };
}

/** How a module reads its groups: each `group()` read, then one `done()` that throws every problem at once. */
export type EnvReader = {
  group<S extends z.ZodObject>(group: EnvGroup<S>): z.output<S> | null;
  done(): void;
};

/**
 * A reader of `source`. `production` makes a group marked `required: 'production'` a problem when it
 * is `null`. Every `group()` returns the group or `null`, collecting what is wrong; `done()` throws one
 * {@link EnvError} naming every problem, or returns.
 */
export function envReader(source: EnvSource, { production = false }: { production?: boolean } = {}): EnvReader {
  const problems: EnvProblem[] = [];
  return {
    group(group) {
      const read = readGroup(source, group, production);
      problems.push(...read.problems);
      return read.value;
    },
    done() {
      if (problems.length) throw new EnvError(problems);
    },
  };
}

/**
 * A group a command cannot run without: `value` itself, or an {@link EnvError} naming the group's
 * variables and what needs them, thrown at the command's entry before any work.
 */
export function requireGroup<S extends z.ZodObject>(value: z.output<S> | null, group: EnvGroup<S>, need: string): z.output<S> {
  if (value !== null) return value;
  const names = requiredVariables(group);
  throw new EnvError([{ variables: names, reason: `${sentence(names)} ${verb(names)} not set: ${need}` }]);
}
