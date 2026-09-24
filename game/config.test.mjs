import { describe, it, expect } from 'vitest';
import { parseProjects } from './config.mjs';

const text = `
sectors:
  ai: { repos: [vertuo-ai-domain, vertuo-mcp] }
  core: { repos: [vertuo-core] }
teams:
  beaver: { home: core }
  octopod: { home: ai }
`;

describe('config', () => {
  it('parses sectors and teams and answers lookups', () => {
    const c = parseProjects(text);
    expect(c.repos).toEqual(['vertuo-ai-domain', 'vertuo-mcp', 'vertuo-core']);
    expect(c.sectorOf('vertuo-mcp')).toBe('ai');
    expect(c.sectorOf('unknown')).toBeNull();
    expect(c.homeOf('beaver')).toBe('core');
    expect(c.homeOf('nobody')).toBeNull();
  });

  it('refuses a team whose home is not a sector', () => {
    expect(() => parseProjects('sectors: {}\nteams:\n  beaver: { home: nowhere }\n')).toThrow(/home/);
  });
});
