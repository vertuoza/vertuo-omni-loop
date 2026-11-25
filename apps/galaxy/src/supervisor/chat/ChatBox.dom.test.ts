// @vitest-environment happy-dom
// The owner's chat box in a browser (PRD omni-loop-34 s6): a message sent to its thread as that owner, the page read
// again, a refusal said in place, and the box's note while the seat cannot answer. The route is a fake: no database.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import type { Message } from '../api/supervisor.contract';
import { ChatBox, type ChatBoxProps } from './ChatBox';

afterEach(() => { cleanup(); refresh.mockReset(); });

const MESSAGE: Message = { id: 'm9', finding: 'f-1', kind: 'owner', by: 'pierre', body: 'Why?', replyTo: null, remembered: null, at: '2026-11-25T14:40:00.000Z' };

function box(change: Partial<ChatBoxProps> = {}) {
  const send = vi.fn<NonNullable<ChatBoxProps['send']>>(() => Promise.resolve({ ok: true, value: MESSAGE }));
  render(createElement(ChatBox, { workspace: 'ws-1', finding: 'f-1', state: 'watching', send, ...change }));
  return send;
}

const textarea = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message to the Supervisor' });

describe('the chat box', () => {
  it('stores an owner\'s message in the finding\'s thread, empties the box and reads the page again', async () => {
    const send = box();
    fireEvent.change(textarea(), { target: { value: '  Why is it silent?  ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })); await Promise.resolve(); });
    expect(send).toHaveBeenCalledWith('ws-1', 'f-1', 'Why is it silent?');
    expect(textarea().value).toBe('');
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('sends a quick question to the general thread at one press', async () => {
    const send = box({ finding: null });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Summarize today' })); await Promise.resolve(); });
    expect(send).toHaveBeenCalledWith('ws-1', null, 'Summarize today');
  });

  it('sends nothing empty, and says a refusal in place, keeping what was typed', async () => {
    const send = box();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })); await Promise.resolve(); });
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Write a message of at most 4,000 characters.');

    send.mockResolvedValueOnce({ ok: false, error: 'Only an owner writes to the Supervisor.' });
    fireEvent.change(textarea(), { target: { value: 'Hello' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })); await Promise.resolve(); });
    expect(screen.getByRole('alert').textContent).toBe('Only an owner writes to the Supervisor.');
    expect(textarea().value).toBe('Hello');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('says the message waits while the seat is offline, and still takes it', async () => {
    const send = box({ state: 'offline' });
    expect(screen.getByRole('status').textContent).toBe('The Supervisor is offline. Your message waits until it looks again.');
    fireEvent.change(textarea(), { target: { value: 'Are you there?' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })); await Promise.resolve(); });
    expect(send).toHaveBeenCalledWith('ws-1', 'f-1', 'Are you there?');
  });

  it('says nothing about waiting while the Supervisor watches, and tells it acts only when pressed', () => {
    box();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Acts only when you press.')).toBeTruthy();
  });
});
