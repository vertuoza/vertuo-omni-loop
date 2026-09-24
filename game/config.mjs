import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';

const Schema = z.object({
  sectors: z.record(z.object({ repos: z.array(z.string().min(1)) })),
  teams: z.record(z.object({ home: z.string().min(1) })),
});

export function parseProjects(text) {
  const raw = Schema.parse(parse(text));
  for (const [team, { home }] of Object.entries(raw.teams)) {
    if (!raw.sectors[home]) throw new Error(`team ${team}: home sector "${home}" is not a sector`);
  }
  const repoSector = new Map();
  for (const [name, { repos }] of Object.entries(raw.sectors)) for (const r of repos) repoSector.set(r, name);
  return {
    sectors: raw.sectors,
    teams: raw.teams,
    repos: [...repoSector.keys()],
    sectorOf: (repo) => repoSector.get(repo) ?? null,
    homeOf: (team) => raw.teams[team]?.home ?? null,
  };
}

export function loadProjects(path = 'projects.yml') {
  return parseProjects(readFileSync(path, 'utf8'));
}
