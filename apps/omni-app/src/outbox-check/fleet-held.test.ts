import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, assert, describe, expect, it } from 'vitest';
import { parseConfig } from 'omni-loop/kit/lib/config.ts';
import { createContext } from 'omni-loop/kit/lib/context.ts';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { settleByFleet } from 'omni-loop/kit/lib/outbox/fleet.ts';
import type { Verdict } from '../evaluate/evaluate.ts';
import { withFleetHeld } from './fleet-held.ts';

// PRD 2896 s10, BR-PRODUCT-5: an item a fleet answered reads as answered for the mission branch only. A feature pull request into
// the default branch is held on it until a person answers it, the override label aside.

const config = parseConfig('kit: 1\n', '.omni-loop/config.yml');
const INBOX = '.omni-loop/delivery/inbox/0042-widgets';
const OUTBOX = '.omni-loop/delivery/outbox/0042-widgets';
const ITEM = 's1-01-keep-the-cap';
const item = [
  '---', `id: ${ITEM}`, 'prd: 42', 'slice: s1', 'rank: high', 'bears-on: none', 'raised: 2026-11-16', 'wave: 1', '---', '',
  '## The question, in plain words', '', 'Five?', '',
  '## The decision, in plain words', '', 'Five.', '',
  '## The options, in plain words', '', 'A. Five (built).', 'B. Ten.', '',
  ...['What I had to decide', 'What I did meanwhile', 'What it costs to change later', 'What I could not know'].flatMap((heading) => [`## ${heading}`, '', '(author) x', '']),
].join('\n');

const heads: string[] = [];
afterEach(() => {
  for (const head of heads.splice(0)) rmSync(head, { recursive: true, force: true });
});

/** A head whose PRD 42 holds one high item, answered by the fleet when `answered`. */
function headWith(answered: boolean): string {
  const head = mkdtempSync(join(tmpdir(), 'omni-fleet-held-'));
  heads.push(head);
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(head, path)), { recursive: true });
    writeFileSync(join(head, path), text);
  };
  write(`${INBOX}/spec.md`, '# Widgets\n');
  write(`${OUTBOX}/${ITEM}.md`, item);
  if (answered) {
    const verdicts = [{ role: 'pm', answer: 'yes', sentence: 'Fine.' }];
    const settled = settleByFleet({ ctx: createContext(head, config), prd: parsePrd(42), item: ITEM, answer: { fleet: 'blue', option: 'A', branch: 'mission/1-x', at: '2026-11-16', pr: parsePr(43), verdicts } });
    assert(settled.ok);
    write(settled.settledFile, settled.text);
    for (const file of settled.deletes) rmSync(join(head, file));
  }
  return head;
}

const green: Verdict = { conclusion: 'success', title: 'Outbox clear', summary: 'outbox-status — PRD #42: no open item.', comment: null };
const pr = (labels: string[] = []) => ({ baseRef: 'main', headRef: 'feat/widgets', headSha: 'abc', labels });

describe('withFleetHeld', () => {
  it('holds a feature pull request into the default branch on an item a fleet answered', () => {
    const held = withFleetHeld(green, { config, head: headWith(true), pr: pr() });
    expect(held.conclusion).toBe('failure');
    expect(held.title).toBe('1 item answered by a fleet: a person answers it first');
    expect(held.summary).toContain(`  - ${ITEM} (fleet blue)`);
  });

  it('changes nothing when no fleet answered an item', () => {
    expect(withFleetHeld(green, { config, head: headWith(false), pr: pr() })).toEqual(green);
  });

  it('lets the override label wave it through, saying so', () => {
    const waved = withFleetHeld(green, { config, head: headWith(true), pr: pr([config.labels.outboxGo]) });
    expect(waved.conclusion).toBe('success');
    expect(waved.summary).toContain('answered by a fleet, not by a person');
  });

  it('leaves a skipped check, and a pull request that is no feature pull request, as they are', () => {
    const skipped: Verdict = { ...green, conclusion: 'skipped' };
    expect(withFleetHeld(skipped, { config, head: headWith(true), pr: pr() })).toEqual(skipped);
    expect(withFleetHeld(green, { config, head: headWith(true), pr: { ...pr(), headRef: 'chore/x' } })).toEqual(green);
    expect(withFleetHeld(green, { config: null, head: headWith(true), pr: pr() })).toEqual(green);
  });
});
