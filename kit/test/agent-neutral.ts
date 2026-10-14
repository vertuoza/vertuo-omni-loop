// PRD 1858, s3: a skill speaks to any coding agent. A Claude tool's name appears only inside an
// `(in Claude: …)` bracket, which runs from `(in Claude:` to its matching `)`, across lines and
// backticks included. A name anywhere else, a code block included, is a hit naming its line.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** The names only Claude knows, which a skill says only inside a bracket. */
export const CLAUDE_NAMES: readonly string[] = [
  'AskUserQuestion',
  '/clear',
  '/loop',
  'isolation:',
  'run_in_background',
  'Agent call',
  'Claude Code',
  'Claude session',
  'ScheduleWakeup',
  '/reload-plugins',
];

const OPEN = '(in Claude:';

/** One Claude name outside a bracket: its 1-based line and the name. */
export type Hit = Readonly<{ line: number; name: string }>;

/** `text` with every `(in Claude: …)` bracket blanked out, newlines kept so lines still count. */
function outsideBrackets(text: string): string {
  let out = '';
  let at = 0;
  for (let open = text.indexOf(OPEN); open !== -1; open = text.indexOf(OPEN, at)) {
    out += text.slice(at, open);
    let depth = 0;
    let end = open;
    for (; end < text.length; end++) {
      if (text[end] === '(') depth++;
      else if (text[end] === ')' && --depth === 0) break;
    }
    out += text.slice(open, end + 1).replace(/[^\n]/g, ' ');
    at = end + 1;
  }
  return out + text.slice(at);
}

/** Every Claude name `text` holds outside a bracket, in the order of its lines. */
export function claudeNamesIn(text: string): Hit[] {
  const hits: Hit[] = [];
  outsideBrackets(text)
    .split('\n')
    .forEach((line, index) => {
      for (const name of CLAUDE_NAMES) if (line.includes(name)) hits.push({ line: index + 1, name });
    });
  return hits;
}

/** Every `.md` file under `dir`, sorted. */
function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return markdownFiles(path);
      return entry.name.endsWith('.md') ? [path] : [];
    });
}

/** Each Claude name outside a bracket in every skill file under `skillsDir`, as `<file>:<line>: <name>`. */
export function agentNeutralHits(skillsDir: string): string[] {
  return markdownFiles(skillsDir).flatMap((file) =>
    claudeNamesIn(readFileSync(file, 'utf8')).map(({ line, name }) => `${relative(skillsDir, file)}:${String(line)}: ${name}`),
  );
}
