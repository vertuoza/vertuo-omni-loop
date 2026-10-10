'use client';
import { useReducer, useRef } from 'react';
import { approversReducer, initialApproversForm, type ApproversAction, type ApproversForm, type ApproverState } from '../products/approvers';
import { ApproversSection, type ApproversHandlers } from '../products/approvers-section';
import { LinksSection, type LinksHandlers } from './LinksSection';
import { repositoriesTabClient, type Changed, type RepositoriesTabPort } from './repositories-tab.client';
import type { LinkWrite, RepositoriesTab } from './repositories-tab.contract';
import { demoTabPort, initialLinksForm, linksReducer } from './repositories-tab-model';

// The Repositories & approvers tab in the browser (PRD 1364 s11): keeps the links' state
// (repositories-tab-model.ts) and the Approvers list's (src/products/approvers.ts), and changes them
// through the tab's own routes as the signed-in person (repositories-tab.client.ts), one call at a time;
// each section draws each step. In the demo, the same rules run in memory.

export type TabSource = { kind: 'demo' } | { kind: 'live' };

export interface RepositoriesTabPageProps {
  source: TabSource;
  tab: RepositoriesTab;
  /** The repository Add a repository starts on (`?add=`), from Products' Add to a product. */
  add?: string | null;
}

/** The list's state, none while it could not be read. */
const listReducer = (form: ApproversForm | null, action: ApproversAction): ApproversForm | null => (form ? approversReducer(form, action) : null);

export function RepositoriesTabPage({ source, tab, add = null }: RepositoriesTabPageProps) {
  const [links, dispatchLinks] = useReducer(linksReducer, tab, initialLinksForm);
  const [approvers, dispatchApprovers] = useReducer(listReducer, tab.approvers, (a) => (a ? initialApproversForm(a) : null));
  const port = useRef<RepositoriesTabPort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo' ? demoTabPort(tab.links) : repositoriesTabClient(tab.product.id));

  const changeLinks = async <T,>(call: () => Promise<Changed<T>>, done: (answer: T) => void) => {
    dispatchLinks({ type: 'busy' });
    const answer = await call();
    if (answer.ok) done(answer);
    else dispatchLinks({ type: 'refused', message: answer.message });
  };
  const onLinks: LinksHandlers = {
    save: (write: LinkWrite) => {
      if (!links.busy) void changeLinks(() => getPort().saveLink(write), ({ link }) => { dispatchLinks({ type: 'saved', link }); });
    },
    remove: (repo: string) => {
      if (!links.busy) void changeLinks(() => getPort().removeLink(repo), () => { dispatchLinks({ type: 'removed', repo }); });
    },
  };

  const changeApprovers = async <T,>(call: () => Promise<Changed<T>>, done: () => void) => {
    dispatchApprovers({ type: 'busy' });
    const answer = await call();
    if (answer.ok) done();
    else dispatchApprovers({ type: 'refused', message: answer.message });
  };
  const onApprovers: ApproversHandlers = {
    set: (member: string, state: ApproverState) => {
      if (approvers && !approvers.busy) void changeApprovers(() => getPort().setApprover(member, state), () => { dispatchApprovers({ type: 'set', member, state }); });
    },
    remove: (member: string) => {
      if (approvers && !approvers.busy) void changeApprovers(() => getPort().removeApprover(member), () => { dispatchApprovers({ type: 'removed', member }); });
    },
  };

  return (
    <>
      <LinksSection form={links} owner={tab.owner} add={add} on={onLinks} />
      <ApproversSection form={approvers} on={onApprovers} />
    </>
  );
}
