// AC-12: the new props of Tabs, SegmentedControl, ListRow and Popover are opt-in; without them every
// part draws the markup it drew before PRD omni-loop-23.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ListRow } from './ListRow.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';
import { Tabs } from './Tabs.tsx';

describe('the design-system defaults do not move', () => {
  it('AC-12: Tabs without endSlot or filledCount draws the nav it drew before', () => {
    const items = [{ id: 'a', label: 'A', href: '#a', count: '2', attention: true }, { id: 'b', label: 'B', href: '#b' }];
    expect(renderToStaticMarkup(createElement(Tabs, { label: 'T', items, current: 'a' }))).toBe(
      '<nav class="omni-tabs omni-tabs--md" aria-label="T"><a class="omni-tab omni-tab--current" href="#a" aria-current="page">A<span class="omni-tab__count omni-tab__count--attention">2</span></a><a class="omni-tab" href="#b">B</a></nav>',
    );
  });

  it('AC-12: SegmentedControl without a variant or a count draws the bordered control it drew before', () => {
    const options = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    expect(renderToStaticMarkup(createElement(SegmentedControl, { label: 'S', options, defaultValue: 'b' }))).toBe(
      '<div class="omni-segmented omni-segmented--md" role="radiogroup" aria-label="S"><button type="button" role="radio" aria-checked="false" tabindex="-1" class="omni-segment">A</button><button type="button" role="radio" aria-checked="true" tabindex="0" class="omni-segment omni-segment--chosen">B</button></div>',
    );
  });

  it('AC-12: ListRow without selected, leading or clamp draws the row it drew before', () => {
    expect(renderToStaticMarkup(createElement(ListRow, { title: 'T', detail: 'D', trailing: 'E' }))).toBe(
      '<div class="omni-list-row omni-list-row--normal"><span class="omni-list-row__main"><span class="omni-list-row__title">T</span><span class="omni-list-row__detail">D</span></span><span class="omni-list-row__trailing">E</span></div>',
    );
    expect(renderToStaticMarkup(createElement(ListRow, { title: 'T', href: '#x', density: 'compact' }))).toBe(
      '<a class="omni-list-row omni-list-row--compact omni-list-row--link" href="#x"><span class="omni-list-row__main"><span class="omni-list-row__title">T</span></span></a>',
    );
  });
});
