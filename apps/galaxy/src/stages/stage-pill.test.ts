import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StagePill } from './stage-pill';

describe('a stage pill', () => {
  it('names its stage, current unless told otherwise', () => {
    expect(renderToStaticMarkup(createElement(StagePill, { stage: 'building' }))).toBe('<span class="stage-stop stage-current">building</span>');
    expect(renderToStaticMarkup(createElement(StagePill, { stage: 'prd', state: 'passed' }))).toBe('<span class="stage-stop stage-passed">PRD</span>');
  });
});
