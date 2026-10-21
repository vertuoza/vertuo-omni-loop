import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EMPTY_TERMINAL, type TerminalState } from './terminal-model';
import { TerminalView, type TerminalJob, type TerminalViewProps } from './Terminal';

// The Terminal panel as drawn (PRD 1904 s4, the `runner-terminal` screen), to static markup: its header,
// its lines (✗ in the error colour, PR: links in a new tab, Done: bold), Jump to latest only while
// scrolled up, each state in the spec's words, and no input of any kind.

const ID = '7f3a9c21-0000-4000-8000-00000000d201';
const JOB: TerminalJob = { id: ID, repo: 'vertuoza/vertuo-omni-loop', runner: 'nimbus-agents', status: 'running' };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const read = (over: Partial<TerminalState>): TerminalState => ({ ...EMPTY_TERMINAL, read: true, status: 'running', ...over });
const draw = (over: Partial<TerminalViewProps> = {}) =>
  renderToStaticMarkup(createElement(TerminalView, { id: ID, job: JOB, state: read({}), following: true, ...over }));

const LINES = [
  '12:04:31 Bash: pnpm vitest run kit/lib/runner',
  '12:05:02 ✗ FAIL kit/lib/runner/log.test.ts',
  '  expected 200, received 201',
  '12:07:33 PR: https://github.com/vertuoza/vertuo-omni-loop/pull/1841',
  '12:09:05 Done: ok · 48 turns · $3.12 · 8m',
  'Slice s1-02 merged into the feature branch.',
].map((t, i) => ({ seq: i + 1, text: t }));

describe('the header', () => {
  it('names the job, its repository and its runner, its status, and has a close button', () => {
    const html = draw();
    expect(html).toContain('data-screen="runner-terminal"');
    expect(text(html)).toContain('job 7f3a9c21 · vertuo-omni-loop · nimbus-agents Running');
    expect(html).toContain('aria-label="Close"');
  });

  it('shows the live dot while the job is queued or running, not once it ended', () => {
    expect(draw()).toContain('terminal-live');
    expect(draw({ state: read({ status: 'queued' }) })).toContain('terminal-live');
    expect(draw({ state: read({ status: 'done', lines: LINES, first: 1 }) })).not.toContain('terminal-live');
    expect(text(draw({ state: read({ status: 'failed', lines: LINES, first: 1 }) }))).toContain('Failed');
  });

  it('says Reconnecting… after a failed read, the lines kept', () => {
    const html = draw({ state: read({ lines: LINES, first: 1, failed: true }) });
    expect(text(html)).toContain('Reconnecting…');
    expect(text(html)).toContain('Bash: pnpm vitest run kit/lib/runner');
  });
});

describe('the lines', () => {
  const html = draw({ state: read({ lines: LINES, first: 1 }) });

  it('are monospace, each with its time', () => {
    expect(html).toContain('<pre class="terminal-lines"');
    expect(html).toContain('<span class="terminal-time">12:04:31 </span>');
  });

  it('draw a ✗ line and its indented output in the error colour', () => {
    expect(html).toMatch(/class="terminal-line is-error">[^]*✗ FAIL/);
    expect(html).toMatch(/class="terminal-line is-error"> {2}expected 200, received 201/);
  });

  it('open a PR: link in a new tab', () => {
    expect(html).toContain('<a href="https://github.com/vertuoza/vertuo-omni-loop/pull/1841" target="_blank" rel="noopener noreferrer">');
  });

  it('draw a Done: line bold', () => {
    expect(html).toMatch(/class="terminal-line is-done">[^]*Done: ok · 48 turns/);
  });
});

describe('following', () => {
  it('shows Jump to latest only while scrolled up', () => {
    expect(draw({ following: true })).not.toContain('Jump to latest');
    expect(draw({ following: false })).toContain('>Jump to latest</button>');
  });
});

describe('the states', () => {
  it('waits for the first line', () => {
    expect(text(draw())).toContain('Waiting for the first line…');
  });

  it('shows an old runner\'s tail under the update line, with omni update to copy', () => {
    const t = text(draw({ state: read({ logTail: 'wave 1 · tests green' }) }));
    expect(t).toContain('Update this runner for live logs. omni update Copy');
    expect(t).toContain('wave 1 · tests green');
  });

  it('says the log was cleared for an ended job with none, or a job no longer listed', () => {
    expect(text(draw({ state: read({ status: 'done' }) }))).toContain('This job\'s log was cleared.');
    expect(text(draw({ job: null, state: EMPTY_TERMINAL }))).toContain('This job\'s log was cleared.');
  });

  it('says earlier lines were dropped above the first line', () => {
    const t = text(draw({ state: read({ lines: LINES.map((l) => ({ ...l, seq: l.seq + 100 })), first: 101 }) }));
    expect(t.indexOf('Earlier lines were dropped.')).toBeLessThan(t.indexOf('Bash:'));
    expect(t.indexOf('Earlier lines were dropped.')).toBeGreaterThan(-1);
  });

  it('says nothing before the first read', () => {
    const t = text(draw({ state: EMPTY_TERMINAL }));
    for (const words of ['Waiting', 'cleared', 'dropped', 'Update this runner']) expect(t).not.toContain(words);
  });
});

describe('nothing to type', () => {
  it('has no input of any kind', () => {
    for (const state of [read({}), read({ lines: LINES, first: 1 }), read({ logTail: 'tail' })]) {
      const html = draw({ state, following: false });
      expect(html).not.toMatch(/<(input|textarea|select|form)\b/);
      expect(html).not.toContain('contenteditable');
    }
  });
});
