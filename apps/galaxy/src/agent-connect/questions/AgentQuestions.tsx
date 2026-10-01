'use client';
import { createBrowserClient } from '@supabase/ssr';
import { useReducer, useRef } from 'react';
import type { Product } from '../../business/model';
import type { AgentQuestion } from './model';
import { databaseQuestions, demoQuestions, type QuestionsPort } from './port';
import { QuestionsCard, type QuestionsHandlers } from './QuestionsCard';
import { initialQuestionsState, questionsReducer } from './state';

// Settings › Business › Questions agents couldn't answer in the browser (PRD 855 s3): keeps the card's
// state and calls the questions' functions as the signed-in person (./port.ts), the way the rest of the
// page calls the business's; in the demo, the same in memory.

export type QuestionsSource =
  | { kind: 'demo'; lastSeq: number }
  | { kind: 'database'; url: string; key: string; workspace: string };

export interface AgentQuestionsProps {
  source: QuestionsSource;
  questions: AgentQuestion[];
  products: Product[];
}

type Rpc = Parameters<typeof databaseQuestions>[0];

export function AgentQuestions({ source, questions, products }: AgentQuestionsProps) {
  const [state, act] = useReducer(questionsReducer, questions, initialQuestionsState);
  const port = useRef<QuestionsPort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo'
    ? demoQuestions(source.lastSeq)
    : databaseQuestions(createBrowserClient(source.url, source.key) as unknown as Rpc, source.workspace));

  const save = async () => {
    const answering = state.answering;
    const question = state.questions.find((q) => q.id === answering?.id);
    if (state.busy || !answering || !question) return;
    act({ type: 'busy' });
    const got = await getPort().answer(question, answering.kind, answering.value.trim(), question.product ?? answering.product);
    act(got.ok ? { type: 'answered', id: question.id, claim: got.claim } : { type: 'refused', message: got.message });
  };
  const dismiss = async (question: AgentQuestion) => {
    if (state.busy) return;
    act({ type: 'busy' });
    const got = await getPort().dismiss(question);
    act(got.ok ? { type: 'dismissed', id: question.id } : { type: 'refused', message: got.message });
  };
  const on: QuestionsHandlers = {
    answer: (question) => act({ type: 'answer', id: question.id }),
    kind: (kind) => act({ type: 'kind', kind }),
    value: (value) => act({ type: 'value', value }),
    product: (product) => act({ type: 'product', product }),
    save: () => void save(),
    cancel: () => act({ type: 'cancel' }),
    dismiss: (question) => void dismiss(question),
  };
  return <QuestionsCard state={state} products={products} demo={source.kind === 'demo'} on={on} />;
}
