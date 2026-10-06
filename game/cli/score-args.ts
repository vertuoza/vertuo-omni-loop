// The arguments of game:score: an optional season (YYYY-MM) and an optional `--rankings <file>`,
// in any order.
export function scoreArgs(argv: readonly string[]): { season: string | null; rankings: string | null } {
  let season: string | null = null, rankings: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--rankings') {
      rankings = argv[++i] ?? null;
      if (!rankings) throw new Error('--rankings needs a file');
    } else if (/^\d{4}-\d{2}$/.test(a) && !season) season = a;
    else throw new Error(`unexpected argument "${a}"`);
  }
  return { season, rankings };
}
