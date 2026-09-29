// The numbers the timings script prints (PRD 657): the median and p75 of the time to first byte and
// to the full document, over one page's samples.
import { describe, expect, it } from 'vitest';
import { percentile, summarise } from './summarise';

describe('percentile', () => {
  it('interpolates between the two nearest samples, whatever their order', () => {
    expect(percentile([40, 10, 30, 20], 0.5)).toBe(25);
    expect(percentile([10, 20, 30, 40], 0.75)).toBe(32.5);
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
  });

  it('gives the one sample of a single run', () => {
    expect(percentile([120], 0.75)).toBe(120);
  });

  it('refuses an empty run', () => {
    expect(() => percentile([], 0.5)).toThrow(/no samples/);
  });
});

describe('summarise', () => {
  it('gives the median and p75 of both timings on a fixed sample of ten loads', () => {
    const samples = [
      { ttfb: 180, total: 900 }, { ttfb: 220, total: 1100 }, { ttfb: 150, total: 800 },
      { ttfb: 400, total: 2000 }, { ttfb: 210, total: 1000 }, { ttfb: 190, total: 950 },
      { ttfb: 170, total: 870 }, { ttfb: 260, total: 1300 }, { ttfb: 200, total: 1050 },
      { ttfb: 230, total: 1200 },
    ];
    expect(summarise(samples)).toEqual({
      runs: 10,
      ttfb: { median: 205, p75: 227.5 },
      total: { median: 1025, p75: 1175 },
    });
  });

  it('does not reorder the samples it is given', () => {
    const samples = [{ ttfb: 3, total: 9 }, { ttfb: 1, total: 7 }];
    summarise(samples);
    expect(samples).toEqual([{ ttfb: 3, total: 9 }, { ttfb: 1, total: 7 }]);
  });
});
