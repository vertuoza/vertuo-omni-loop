// @vitest-environment happy-dom
// The container parts in a DOM: a Section is a landmark named by its heading, a Card is never nested
// (the Section groups), a Table and a DataList pair each cell with its header or term, and a Timeline
// says each step's state in words.
import { cleanup, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Card } from './Card.tsx';
import { CARD_PADDINGS, CARD_SURFACES } from './Card.meta.ts';
import { cardSpecimen } from './Card.specimen.tsx';
import { DataList } from './DataList.tsx';
import { Section } from './Section.tsx';
import { sectionSpecimen } from './Section.specimen.tsx';
import { Table } from './Table.tsx';
import { Timeline } from './Timeline.tsx';

afterEach(cleanup);

describe('Section', () => {
  it('holds its heading, at the level it is given, and no landmark of its own', () => {
    const { container } = render(createElement(Section, { title: 'Open questions', level: '3', description: 'Answer these.' }, 'Nothing open.'));
    expect(screen.getByRole('heading', { level: 3, name: 'Open questions' })).toBeTruthy();
    expect(screen.getByText('Answer these.')).toBeTruthy();
    expect(screen.queryByRole('region')).toBeNull();
    expect(container.querySelector('.omni-section')).not.toBeNull();
  });

  it('keeps its actions in the header', () => {
    const { container } = render(createElement(Section, { title: 'Checks', actions: createElement('button', null, 'Rerun') }, 'Body'));
    expect(container.querySelector('header .omni-section__actions button')?.textContent).toBe('Rerun');
  });
});

describe('Card stays unnested', () => {
  it('AC-1: no specimen of a Card holds a Card, and the Section is what groups', () => {
    for (const surface of CARD_SURFACES) {
      const { container } = render(cardSpecimen('surface', surface));
      expect(container.querySelectorAll('.omni-card').length).toBe(1);
      expect(container.querySelectorAll('.omni-card .omni-card')).toHaveLength(0);
      cleanup();
    }
    for (const padding of CARD_PADDINGS) {
      const { container } = render(cardSpecimen('padding', padding));
      expect(container.querySelectorAll('.omni-card .omni-card')).toHaveLength(0);
      cleanup();
    }
    const { container } = render(sectionSpecimen('level', '2'));
    expect(container.querySelectorAll('.omni-card')).toHaveLength(0);
  });

  it('a Card inside a Card is what the test would catch', () => {
    const { container } = render(createElement(Card, null, createElement(Card, null, 'inner')));
    expect(container.querySelectorAll('.omni-card .omni-card')).toHaveLength(1);
  });
});

describe('Table', () => {
  it('names itself by its caption and reads each cell with its column header', () => {
    render(
      createElement(Table, {
        caption: 'Slices',
        columns: [
          { id: 'slice', label: 'Slice' },
          { id: 'state', label: 'State' },
        ],
        rows: [{ id: 's1', cells: { slice: 's1', state: 'Merged' } }],
      }),
    );
    const table = screen.getByRole('table', { name: 'Slices' });
    expect(within(table).getAllByRole('columnheader').map((th) => th.getAttribute('scope'))).toEqual(['col', 'col']);
    expect(within(table).getByRole('cell', { name: 'Merged' })).toBeTruthy();
  });
});

describe('DataList', () => {
  it('pairs each term with its detail', () => {
    const { container } = render(createElement(DataList, { items: [{ id: 'owner', term: 'Owner', detail: 'Pierre' }] }));
    const group = container.querySelector('dl > div');
    expect(group?.querySelector('dt')?.textContent).toBe('Owner');
    expect(group?.querySelector('dd')?.textContent).toBe('Pierre');
  });
});

describe('Timeline', () => {
  it('lists the steps in order, each with its state in words, and marks the current one', () => {
    render(
      createElement(Timeline, {
        items: [
          { id: 'a', title: 'Spec', state: 'done' },
          { id: 'b', title: 'Plan', state: 'current' },
          { id: 'c', title: 'Build', state: 'pending' },
        ],
      }),
    );
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['Spec (Done)', 'Plan (Current)', 'Build (Pending)']);
    expect(items.map((li) => li.getAttribute('aria-current'))).toEqual([null, 'step', null]);
  });
});
