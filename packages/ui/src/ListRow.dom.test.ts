// @vitest-environment happy-dom
// ListRow, opt-in: a selected row, a leading mark and a clamp, each only when asked.
import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ListRow } from './ListRow.tsx';

afterEach(cleanup);

describe('ListRow, opt-in', () => {
  it('marks the selected row with its class and aria-current, link or not', () => {
    const plain = render(createElement(ListRow, { title: 'T', selected: true }));
    expect(plain.container.firstElementChild?.className).toContain('omni-list-row--selected');
    expect(plain.container.firstElementChild?.getAttribute('aria-current')).toBe('true');
    const link = render(createElement(ListRow, { title: 'T', href: '#x', selected: true }));
    expect(link.container.querySelector('a')?.getAttribute('aria-current')).toBe('true');
  });

  it('draws a leading mark before the text and a clamp class on the text', () => {
    const { container } = render(createElement(ListRow, { title: 'T', leading: 'L', clamp: 2 }));
    expect(container.firstElementChild?.firstElementChild?.className).toBe('omni-list-row__leading');
    expect(container.querySelector('.omni-list-row__main--clamp-2')).not.toBeNull();
  });

  it('draws none of them by default', () => {
    const { container } = render(createElement(ListRow, { title: 'T' }));
    expect(container.querySelector('.omni-list-row--selected, .omni-list-row__leading, .omni-list-row__main--clamp')).toBeNull();
    expect(container.firstElementChild?.hasAttribute('aria-current')).toBe(false);
  });
});
