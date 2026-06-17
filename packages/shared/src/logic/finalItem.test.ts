import { describe, it, expect } from 'vitest';
import { getFinalItemPositions, getJigsawGridSize } from './finalItem.js';

describe('getJigsawGridSize', () => {
  it('returns 3 for difficulty 1', () => expect(getJigsawGridSize(1)).toBe(3));
  it('returns 5 for difficulty 2', () => expect(getJigsawGridSize(2)).toBe(5));
  it('returns 10 for difficulty 3', () => expect(getJigsawGridSize(3)).toBe(10));
});

describe('getFinalItemPositions — round-robin distribution', () => {
  it('divides evenly when totalPositions is a multiple of totalItems', () => {
    // 6 positions, 3 items → each gets exactly 2
    expect(getFinalItemPositions(0, 3, 6)).toEqual([0, 3]);
    expect(getFinalItemPositions(1, 3, 6)).toEqual([1, 4]);
    expect(getFinalItemPositions(2, 3, 6)).toEqual([2, 5]);
  });

  it('distributes remainder so counts differ by at most 1', () => {
    // 5 positions, 3 items → items 0 & 1 get 2, item 2 gets 1
    expect(getFinalItemPositions(0, 3, 5)).toEqual([0, 3]);
    expect(getFinalItemPositions(1, 3, 5)).toEqual([1, 4]);
    expect(getFinalItemPositions(2, 3, 5)).toEqual([2]);
  });

  it('gives every item at least one position when positions >= items', () => {
    // 4 positions, 4 items → each gets exactly 1
    for (let i = 0; i < 4; i++) {
      expect(getFinalItemPositions(i, 4, 4)).toHaveLength(1);
    }
  });

  it('gives some items 0 when there are more items than positions', () => {
    // 2 positions, 4 items → items 0 & 1 each get 1, items 2 & 3 get 0
    expect(getFinalItemPositions(0, 4, 2)).toEqual([0]);
    expect(getFinalItemPositions(1, 4, 2)).toEqual([1]);
    expect(getFinalItemPositions(2, 4, 2)).toEqual([]);
    expect(getFinalItemPositions(3, 4, 2)).toEqual([]);
  });

  it('returns [] when totalPositions is 0', () => {
    expect(getFinalItemPositions(0, 3, 0)).toEqual([]);
  });

  it('returns [] when totalItems is 0', () => {
    expect(getFinalItemPositions(0, 0, 5)).toEqual([]);
  });

  it('covers the full range with no gaps or overlaps', () => {
    const total = 7;
    const items = 3;
    const allPositions = Array.from({ length: items }, (_, i) =>
      getFinalItemPositions(i, items, total),
    ).flat().sort((a, b) => a - b);
    expect(allPositions).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
