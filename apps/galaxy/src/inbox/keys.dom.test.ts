// @vitest-environment happy-dom
// The Inbox's keys in a browser (PRD omni-loop-22, s5): the Open tab inside the waiting provider, its
// list a fixture (the demo source reads nothing), its question answered through the demo's port, as the
// round page answers it in the demo.
import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { demoQuestion, DEMO_TEAMMATE } from '../ask/page/demo';
import { WaitingProvider } from '../waiting/WaitingProvider';
import type { WaitingQuestion } from '../waiting/waiting';
import { InboxOpen } from './InboxScreen.open';

afterEach(cleanup);

const ROUND_ID = demoQuestion(Date.now()).round.id;

const question = (id: string, minutesAgo: number): WaitingQuestion => ({
  kind: 'question', id, sessionTitle: `Session ${id}`, question: `Question ${id}?`, askedAt: Date.now() - minutesAgo * 60_000, sharedBy: null,
});

/** The Open tab with these questions waiting, the first one's round read from the demo. */
async function inbox(questions: WaitingQuestion[]) {
  const children = createElement(InboxOpen, { source: { kind: 'demo' }, me: DEMO_TEAMMATE, filter: { kind: 'all', shared: false } });
  render(createElement(WaitingProvider, { view: { questions, unread: false, source: { kind: 'demo' } }, children }));
  await screen.findAllByRole('radio');
  // The round is read outside act: let React run the form's effects, its key listener among them,
  // before a key is pressed.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}

const press = async (key: string, mods: KeyboardEventInit = {}) => {
  await act(async () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }));
    await Promise.resolve();
  });
};

const openKey = () => document.querySelector('[data-open]')?.getAttribute('data-open');

describe('answering in the Inbox', () => {
  it('AC-6: pressing 1 picks the first option, and no answer is sent until command-enter', async () => {
    await inbox([question(ROUND_ID, 2), question('next', 1)]);
    const [first] = screen.getAllByRole('radio');
    await press('1');
    expect((first as HTMLInputElement).checked).toBe(true);
    await press('1');
    // Every question of the round is picked: still nothing sent.
    expect(screen.queryByText('✓ Answered')).toBeNull();
    expect(openKey()).toBe(`question:${ROUND_ID}`);
    await press('Enter', { metaKey: true });
    expect(await screen.findByText('✓ Answered')).toBeTruthy();
  });

  it('AC-4: after Send the next question opens, without a click', async () => {
    await inbox([question(ROUND_ID, 2), question('next', 1)]);
    await press('1');
    await press('1');
    await press('Enter', { metaKey: true });
    await screen.findByText('✓ Answered');
    expect(openKey()).toBe('question:next');
  });
});

describe('e on the list', () => {
  it('AC-11: refuses to clear a question: it stays in the list, and the page says Answer it to clear it', async () => {
    await inbox([question(ROUND_ID, 2)]);
    await press('e');
    expect(screen.getByRole('status', { name: '' }).textContent).toBe('Answer it to clear it');
    expect(document.querySelector(`[data-key="question:${ROUND_ID}"]`)).not.toBeNull();
  });

  it('is off while a text field has the focus', async () => {
    await inbox([question(ROUND_ID, 2)]);
    const other = screen.getAllByRole('textbox')[0];
    if (!other) throw new Error('no Other field');
    other.focus();
    await act(async () => {
      other.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(screen.queryByText('Answer it to clear it')).toBeNull();
  });
});
