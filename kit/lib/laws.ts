// What a repository treats as law. An outbox item bearing on a law is ranked high at least, and a
// slice that would break one stops. Where laws come from is config (`laws.source`), because
// repositories disagree: a knowledge folder, the ADRs the context files list as invariants, or
// nothing.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from './context.ts';
import { ID_SHAPE, resolveId } from './knowledge/registers.ts';
import { group } from './narrow.ts';

/** Where a repository's laws come from: `laws.source` in its config. */
export type LawsSource = 'knowledge' | 'claudeMdInvariants' | 'none';

/** Whether a `bearsOn` value names something that exists, and why not when it does not. */
export type Resolution = { ok: true; reason?: undefined } | { ok: false; reason: string };

/** A repository's laws: where they come from, whether a `bearsOn` resolves, whether it floors high. */
export type Laws = Readonly<{
  source: LawsSource;
  resolve: (bearsOn: string) => Resolution;
  floorsHigh: (bearsOn: string) => boolean;
}>;

const ADR_ID = /^ADR-(\d{4})$/;

export function invariantAdrs(text: string, heading: string): Set<string> {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading.trim());
  if (start === -1) return new Set();
  const level = group(/^#+/.exec(heading.trim()), 0).length; // a heading with no leading `#` throws here, as it always has (PRD 725 outbox item s4-01-heading-without-hashes-still-crashes)
  const ids = new Set<string>();
  for (const line of lines.slice(start + 1)) {
    const next = line.match(/^(#+)\s/);
    if (next?.[1] !== undefined && next[1].length <= level) break;
    for (const match of line.matchAll(/ADR-\d{4}/g)) ids.add(match[0]);
  }
  return ids;
}

/**
 * The first of the context files (`paths.context`, in order) that exists and holds the invariants
 * heading on a line of its own, or `null` (PRD 1739). A file the list does not name is never read.
 */
export function invariantsFile(root: string, context: readonly string[], heading: string): string | null {
  const wanted = heading.trim();
  for (const name of context) {
    const file = join(root, name);
    if (existsSync(file) && readFileSync(file, 'utf8').split('\n').some((line) => line.trim() === wanted)) return name;
  }
  return null;
}

export function adrFiles(ctx: { root: string; layout: { adrDir: string } }, number: string): string[] {
  const dir = join(ctx.root, ctx.layout.adrDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.startsWith(`${number}-`) && name.endsWith('.md')).sort();
}

export function lawsFor(ctx: Context): Laws {
  const source: LawsSource = ctx.config.laws.source;
  const claudeMdHeading: string = ctx.config.laws.claudeMdHeading;
  let invariants: Set<string> | null = null;
  const invariantSet = (): Set<string> => {
    if (invariants === null) {
      const name = invariantsFile(ctx.root, ctx.config.paths.context, claudeMdHeading);
      invariants = name === null ? new Set() : invariantAdrs(readFileSync(join(ctx.root, name), 'utf8'), claudeMdHeading);
    }
    return invariants;
  };

  function resolve(bearsOn: string): Resolution {
    if (bearsOn === 'none') return { ok: true };
    const adr = ADR_ID.exec(bearsOn);
    if (adr) {
      const [, digits = ''] = adr;
      const files = adrFiles(ctx, digits);
      if (files.length === 1) return { ok: true };
      if (files.length === 0) return { ok: false, reason: `no decision record ${bearsOn} in ${ctx.layout.adrDir}` };
      return { ok: false, reason: `${bearsOn} is ambiguous: ${files.join(', ')}` };
    }
    if (ID_SHAPE.test(bearsOn)) {
      // Whether a knowledge id *exists* is asked of the folder in every profile; whether it is a
      // *law* (floors high) is laws.source's question alone — see floorsHigh.
      if (!existsSync(join(ctx.root, ctx.layout.knowledgeRoot))) {
        return { ok: false, reason: `${bearsOn}: no knowledge folder at ${ctx.layout.knowledgeRoot}` };
      }
      return resolveId(bearsOn, { ctx }) ? { ok: true } : { ok: false, reason: `${bearsOn} names no entry in ${ctx.layout.knowledgeRoot}` };
    }
    return { ok: false, reason: `${bearsOn}: not none, an ADR-NNNN or a knowledge id` };
  }

  function floorsHigh(bearsOn: string): boolean {
    // A proposed entry (PRD #68) is no law until a person removes its `Proposed:` line.
    if (source === 'knowledge') return ID_SHAPE.test(bearsOn) && !resolveId(bearsOn, { ctx })?.proposed;
    if (source === 'claudeMdInvariants') return invariantSet().has(bearsOn);
    return false;
  }

  return Object.freeze({ source, resolve, floorsHigh });
}
