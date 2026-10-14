import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { agentsAnswer, copiesLine, copiesRefusal, needsCopies, ownedCopyPaths, parseAgents, servesClaude, takeAgentFlags } from './agents.ts';

describe('takeAgentFlags', () => {
  it('takes every --agent and its value out, in order, and leaves the rest', () => {
    expect(takeAgentFlags(['--agent', 'codex', '--force', '--agent', 'claude', '--test', 'make'])).toEqual({
      values: ['codex', 'claude'],
      rest: ['--force', '--test', 'make'],
    });
  });

  it('a --agent with no value leaves an empty name, for parseAgents to refuse', () => {
    expect(takeAgentFlags(['--agent'])).toEqual({ values: [''], rest: [] });
    expect(takeAgentFlags(['--agent', '--force'])).toEqual({ values: [''], rest: ['--force'] });
  });
});

describe('parseAgents', () => {
  it('keeps the agents in the order named', () => {
    expect(parseAgents(['gemini', 'claude'])).toEqual({ agents: ['gemini', 'claude'] });
  });

  it('refuses an unknown agent, a repeated one and none, each in one line naming it', () => {
    expect(parseAgents(['copilot'])).toEqual({ error: 'copilot is no agent the kit installs for — one of claude, codex, cursor, gemini' });
    expect(parseAgents(['codex', 'codex'])).toEqual({ error: 'codex is named twice' });
    expect(parseAgents([])).toEqual({ error: 'name at least one agent — one of claude, codex, cursor, gemini' });
  });
});

describe('agentsAnswer', () => {
  it('an empty answer is claude alone: Claude is ticked', () => {
    expect(agentsAnswer('')).toEqual(['claude']);
    expect(agentsAnswer(null)).toEqual(['claude']);
    expect(agentsAnswer('  ')).toEqual(['claude']);
  });

  it('reads commas or spaces, in any case', () => {
    expect(agentsAnswer('Codex, claude cursor')).toEqual(['codex', 'claude', 'cursor']);
  });
});

describe('servesClaude and needsCopies', () => {
  it('the plugin for claude, the copies for any other agent', () => {
    expect([servesClaude(['claude']), needsCopies(['claude'])]).toEqual([true, false]);
    expect([servesClaude(['codex']), needsCopies(['codex'])]).toEqual([false, true]);
    expect([servesClaude(['claude', 'gemini']), needsCopies(['claude', 'gemini'])]).toEqual([true, true]);
  });
});

describe('copiesRefusal', () => {
  it('none with no .agents/skills/, or only folders that are not omni-*', () => {
    expect(copiesRefusal(makeRepo().root)).toBeNull();
    expect(copiesRefusal(makeRepo({ files: { '.agents/skills/my-skill/SKILL.md': 'x' } }).root)).toBeNull();
  });

  it('names every omni-* folder the manifest does not own', () => {
    const { root } = makeRepo({
      files: {
        '.agents/skills/omni-b/SKILL.md': 'x',
        '.agents/skills/omni-a/SKILL.md': 'x',
        '.agents/skills/omni-yolo/SKILL.md': 'x',
        '.omni-loop/agents.json': JSON.stringify({ version: '1', folders: { '.agents/skills/omni-yolo': { '.agents/skills/omni-yolo/SKILL.md': 'h' } } }),
      },
    });
    expect(copiesRefusal(root)).toBe(".agents/skills/omni-a, .agents/skills/omni-b are not omni's (not in .omni-loop/agents.json): move or rename them, then run again");
    expect(ownedCopyPaths(root)).toEqual(['.agents/skills/omni-yolo']);
  });

  it('refuses a manifest omni did not write', () => {
    const { root } = makeRepo({ files: { '.omni-loop/agents.json': 'not json' } });
    expect(copiesRefusal(root)).toMatch(/^\.omni-loop\/agents\.json is not the manifest omni writes/);
  });
});

describe('copiesLine', () => {
  it('says how many skills were written, and for which agents', () => {
    expect(copiesLine({ agents: ['claude', 'codex', 'cursor'], owned: 33, changes: [] })).toBe(
      '  wrote   .agents/skills/omni-*  (33 skills for codex, cursor, listed in .omni-loop/agents.json)',
    );
  });

  it('says how many were removed once agents lists claude alone, and nothing when there were none', () => {
    expect(copiesLine({ agents: ['claude'], owned: 0, changes: [{ folder: '.agents/skills/omni-a', change: 'removed' }] })).toBe(
      '  removed .agents/skills/omni-*  (1 skill: agents lists claude alone)',
    );
    expect(copiesLine({ agents: ['claude'], owned: 0, changes: [] })).toBeNull();
  });
});
