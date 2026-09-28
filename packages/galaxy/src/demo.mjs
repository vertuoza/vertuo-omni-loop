// A demo galaxy for local runs and previews, used whenever no Supabase project is configured.
// It is built the honest way: a fictional GitHub snapshot goes through the real projector
// (game/projector.mjs), so the events are exactly what `pnpm game:project` would append.
// Every PRD, repository and login below is invented.
import { projectEvents } from 'vertuo-omni-plan/game/projector.mjs';

export const DEMO_PROJECTS = Object.freeze({
  sectors: {
    'core-belt': { repos: ['vertuo-core', 'vertuo-api'] },
    'ai-nebula': { repos: ['vertuo-ai-domain'] },
    'field-rim': { repos: ['vertuo-web', 'vertuo-mobile'] },
  },
  // Invented fleets, like everything else here: no workspace's own (PRD 400). Each flies a mascot of
  // the sprite library but one, drawn as a hero in its colour, and one is retired.
  teams: {
    builders: { home: 'core-belt', label: 'BUILDERS', color: '#c9824a', motto: 'Every zone gets a wall.', mascot: 'beaver', sort: 10, retired: false },
    inklings: { home: 'ai-nebula', label: 'INKLINGS', color: '#a070f0', motto: 'All arms on deck.', mascot: 'octopod', sort: 20, retired: false },
    coiners: { home: 'core-belt', label: 'COINERS', color: '#f5c842', motto: 'Pays out in shipped slices.', mascot: 'picsou', sort: 30, retired: false },
    'night-owls': { home: 'field-rim', label: 'NIGHT OWLS', color: '#8f9ac0', motto: 'Reads every open question.', mascot: null, sort: 40, retired: false },
    corsairs: { home: 'field-rim', label: 'CORSAIRS', color: '#35b89a', motto: 'Boards the zones nobody holds.', mascot: 'pirate', sort: 50, retired: false },
    capes: { home: null, label: 'CAPES', color: '#58a8f0', motto: 'Retired, never forgotten.', mascot: 'invincible', sort: 90, retired: true },
  },
});

const DEMO_TEAMS = {
  'pm-lina': 'builders', 'bo-builder': 'builders', 'dam-dev': 'builders',
  'pm-otto': 'inklings', inky: 'inklings', 'kraken-k': 'inklings',
  'pm-penny': 'coiners', dime: 'coiners', 'gold-rush': 'coiners',
  'pm-cecil': 'night-owls', 'agent-k': 'night-owls', 'gda-ro': 'night-owls',
  'pm-anne': 'corsairs', 'bonny-b': 'corsairs', 'long-john': 'corsairs',
};

const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

export function demoSnapshot(now = new Date()) {
  const ago = (hours) => (hours === null || hours === undefined ? null : iso(new Date(now.getTime() - hours * 3600000)));
  let prNo = 1000;
  const sub = (author, claimedH, mergedH = null, fire = null) => ({
    number: ++prNo, author, createdAt: ago(claimedH), mergedAt: ago(mergedH), revertedAt: null,
    labels: ['omni:sub', ...(mergedH === null ? ['omni:in-progress'] : []), ...(fire && fire[1] === null ? ['omni:needs-fix'] : [])],
    ...(fire ? { needsFix: { labeledAt: ago(fire[0]), unlabeledAt: ago(fire[1]) } } : {}),
  });
  const zone = (id, repo, wave, blockedBy = [], pr = null) => ({ id, repo, wave, blockedBy, pr });
  const item = (id, repo, rank, raisedH, settled = null) => ({
    id, repo, rank, raisedAt: ago(raisedH),
    settled: settled && { verdict: settled.verdict, at: ago(settled.h), by: settled.by, reworkMergedAt: ago(settled.reworkH ?? null), reworkBy: settled.reworkBy ?? null },
  });
  const planet = ({ prd, title, captain, created, regions = [], feature = null, zones = [], outbox = [], bugs = [], closedH = null }) => ({
    prd, title, captain, ownerTeam: DEMO_TEAMS[captain],
    issue: { createdAt: ago(created), closedAt: ago(closedH) },
    regions: regions.map(([repo, surveyedH, blockedBy = []]) => ({ repo, surveyedAt: ago(surveyedH), blockedBy })),
    featurePr: feature && {
      repo: regions[0][0], number: ++prNo, createdAt: ago(feature.created), readyAt: ago(feature.ready ?? null),
      mergedAt: ago(feature.merged ?? null), lastActivityAt: ago(feature.activity ?? feature.created),
    },
    zones, outbox, bugs,
  });

  const planets = [
    planet({
      prd: 985, title: 'Default Country per Company', captain: 'pm-otto', created: 400,
      regions: [['vertuo-core', 380]],
      feature: { created: 300, ready: 210, merged: 190 },
      zones: [
        zone('s1', 'vertuo-core', 1, [], sub('inky', 299, 280)),
        zone('s2', 'vertuo-core', 2, ['s1'], sub('kraken-k', 279, 250)),
        zone('s3', 'vertuo-core', 2, ['s1'], sub('dime', 279, 240)),
      ],
      outbox: [item('s1-01-default-country', 'vertuo-core', 'high', 285, { verdict: 'agreed', h: 260, by: 'pm-otto' })],
    }),
    planet({
      prd: 2299, title: 'Stock Movements', captain: 'pm-penny', created: 500,
      regions: [['vertuo-core', 480], ['vertuo-api', 470]],
      feature: { created: 330, ready: 160, merged: 150 },
      zones: [
        zone('s1', 'vertuo-core', 1, [], sub('dime', 329, 300)),
        zone('s2', 'vertuo-api', 1, [], sub('gold-rush', 329, 290)),
        zone('s3', 'vertuo-core', 2, ['s1', 's2'], sub('bonny-b', 289, 200)),
      ],
      bugs: [{ repo: 'vertuo-core', number: 4411, createdAt: ago(40), closedAt: null, fixedBy: null }],
    }),
    planet({
      prd: 2332, title: 'Generic Import Engine', captain: 'pm-lina', created: 260,
      regions: [['vertuo-core', 250], ['vertuo-ai-domain', 248]],
      feature: { created: 120, activity: 2 },
      zones: [
        zone('s1', 'vertuo-ai-domain', 1, [], sub('bo-builder', 119, 100)),
        zone('s2', 'vertuo-core', 1, [], sub('dam-dev', 119, 96)),
        zone('s3', 'vertuo-ai-domain', 2, ['s1'], sub('inky', 99, 60)),
        zone('s4', 'vertuo-core', 2, ['s2'], sub('kraken-k', 95, null)),
        zone('s5', 'vertuo-core', 2, ['s2'], sub('dam-dev', 95, null, [30, null])),
        zone('s6', 'vertuo-ai-domain', 3, ['s4', 's5']),
        zone('s7', 'vertuo-core', 3, ['s4', 's5']),
      ],
      outbox: [
        item('s1-01-csv-dialects', 'vertuo-ai-domain', 'high', 14),
        item('s2-01-batch-size', 'vertuo-core', 'medium', 2),
        item('s3-01-dedupe-rule', 'vertuo-ai-domain', 'human-action', 70, { verdict: 'agreed', h: 50, by: 'agent-k' }),
      ],
    }),
    planet({
      prd: 2350, title: 'Invoice Reminders', captain: 'pm-penny', created: 300,
      regions: [['vertuo-core', 280], ['vertuo-web', 278]],
      feature: { created: 160, ready: 80, merged: 70 },
      zones: [
        zone('s1', 'vertuo-core', 1, [], sub('gold-rush', 159, 140)),
        zone('s2', 'vertuo-web', 1, [], sub('long-john', 159, 130)),
        zone('s3', 'vertuo-web', 2, ['s1', 's2'], sub('dime', 129, 90)),
      ],
      outbox: [item('s2-01-reminder-cadence', 'vertuo-web', 'human-action', 120, { verdict: 'drifted', h: 110, by: 'pm-penny', reworkH: 95, reworkBy: 'dime' })],
    }),
    planet({
      prd: 2388, title: 'Time Tracking Mobile', captain: 'pm-otto', created: 700,
      regions: [['vertuo-mobile', 680]],
      feature: { created: 600, activity: 500 },
      zones: [zone('s1', 'vertuo-mobile', 1, [], sub('inky', 599, 560)), zone('s2', 'vertuo-mobile', 2, ['s1'], sub('kraken-k', 559, null))],
      closedH: 48,
    }),
    planet({
      prd: 2410, title: 'Peppol e-Invoicing', captain: 'pm-penny', created: 240,
      regions: [['vertuo-core', 230], ['vertuo-api', 228], ['vertuo-web', 226]],
      feature: { created: 140 },
      zones: [
        zone('s1', 'vertuo-api', 1, [], sub('dime', 139, 132)),
        zone('s2', 'vertuo-core', 2, ['s1']),
        zone('s3', 'vertuo-web', 2, ['s1']),
        zone('s4', 'vertuo-core', 3, ['s2', 's3']),
      ],
      outbox: [
        item('s1-01-ubl-version', 'vertuo-api', 'human-action', 131),
        item('s1-02-vat-rounding', 'vertuo-api', 'high', 130),
      ],
    }),
    planet({
      prd: 2455, title: 'Site Diary Photos', captain: 'pm-cecil', created: 220,
      regions: [['vertuo-mobile', 210]],
      feature: { created: 100, ready: 10 },
      zones: [
        zone('s1', 'vertuo-mobile', 1, [], sub('agent-k', 99, 80)),
        zone('s2', 'vertuo-mobile', 2, ['s1'], sub('gda-ro', 79, 40)),
        zone('s3', 'vertuo-mobile', 2, ['s1'], sub('bo-builder', 79, 30)),
      ],
      outbox: [item('s2-01-exif-strip', 'vertuo-mobile', 'medium', 60, { verdict: 'agreed', h: 20, by: 'pm-cecil' })],
    }),
    planet({
      prd: 2471, title: 'Supplier Price Sync', captain: 'pm-anne', created: 150,
      regions: [['vertuo-api', 140, [2410]], ['vertuo-ai-domain', 138]],
    }),
    planet({
      prd: 2502, title: 'Quote Templates v2', captain: 'pm-lina', created: 60,
      regions: [['vertuo-web', 30]],
    }),
    planet({
      prd: 2520, title: 'Planning Drag & Drop', captain: 'pm-cecil', created: 260,
      regions: [['vertuo-web', 250], ['vertuo-mobile', 245]],
      feature: { created: 170, activity: 1 },
      zones: [
        zone('s1', 'vertuo-web', 1, [], sub('dam-dev', 26, 20)),
        zone('s2', 'vertuo-web', 2, ['s1'], sub('agent-k', 19, null)),
        zone('s3', 'vertuo-mobile', 2, ['s1'], sub('gda-ro', 19, null)),
      ],
    }),
    planet({
      prd: 2533, title: 'Client Portal', captain: 'pm-anne', created: 200,
      regions: [['vertuo-web', 190]],
      feature: { created: 90, activity: 3 },
      zones: [
        zone('s1', 'vertuo-web', 1, [], sub('bonny-b', 89, 70)),
        zone('s2', 'vertuo-web', 2, ['s1'], sub('long-john', 69, 36)),
        zone('s3', 'vertuo-web', 2, ['s1'], sub('bonny-b', 69, null)),
      ],
      outbox: [item('s2-01-session-length', 'vertuo-web', 'high', 50, { verdict: 'drifted', h: 30, by: 'pm-anne' })],
    }),
    planet({ prd: 2541, title: 'VAT Rules Belgium', captain: 'pm-lina', created: 12 }),
  ];
  return { at: iso(now), teams: DEMO_TEAMS, planets };
}

export function demoEvents(now = new Date()) {
  const repoSector = new Map(Object.entries(DEMO_PROJECTS.sectors).flatMap(([name, { repos }]) => repos.map((r) => [r, name])));
  const config = { sectorOf: (repo) => repoSector.get(repo) ?? null };
  const skipped = [];
  const events = projectEvents(demoSnapshot(now), { config, now, onSkip: (s) => skipped.push(s) });
  if (skipped.length) throw new Error(`demo world produced invalid events: ${JSON.stringify(skipped)}`);
  return events;
}
