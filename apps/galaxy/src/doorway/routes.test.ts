import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Which /ask pages sit in the doorway and which in the app shell (PRD 1705), read from the route
// groups under app/ask/: the folder a page is in is the frame it gets, with no URL changed.

const at = (path: string) => new URL(`../../app/ask/${path}`, import.meta.url);
const source = (path: string) => readFileSync(at(path), 'utf8');

describe('the /ask route groups (PRD 1705)', () => {
  it.each(['signin/page.tsx', 'device/page.tsx', 'device/deny/route.ts'])('(doorway)/%s is in the doorway', (path) => {
    expect(existsSync(at(`(doorway)/${path}`))).toBe(true);
  });

  it.each(['page.tsx', 'for-me/page.tsx', 'history/page.tsx', 'q/[round]/page.tsx', '[session]/page.tsx'])(
    '(shell)/%s is in the app shell',
    (path) => {
      expect(existsSync(at(`(shell)/${path}`))).toBe(true);
    },
  );

  it('leaves no page outside a group, and the sign-in callback where it was', () => {
    for (const path of ['page.tsx', 'signin', 'device', 'for-me', 'history', 'q', '[session]']) expect(existsSync(at(path)), path).toBe(false);
    expect(existsSync(at('callback/route.ts'))).toBe(true);
  });

  it('frames each group: the shell for (shell), the doorway for (doorway), neither for /ask itself', () => {
    expect(source('(shell)/layout.tsx')).toMatch(/<AppShell viewer=\{await viewerLive\(\)\}>/);
    expect(source('(shell)/layout.tsx')).not.toMatch(/Doorway/);
    expect(source('(doorway)/layout.tsx')).toMatch(/<Doorway>\{children\}<\/Doorway>/);
    expect(source('(doorway)/layout.tsx')).not.toMatch(/AppShell|viewer/);
    expect(source('layout.tsx')).not.toMatch(/AppShell|Doorway/);
  });
});
