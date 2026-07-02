import type { FinalItem } from '../models/route.js';

/** Grid edge length (pieces per side) for each jigsaw difficulty level. */
export function getJigsawGridSize(difficulty: 1 | 2 | 3): number {
  return difficulty === 1 ? 3 : difficulty === 2 ? 5 : 10;
}

/**
 * Positions (0-based indices) of the final item answer/jigsaw that a given
 * hunt item reveals. Uses round-robin distribution so every item gets at least
 * one position when totalPositions ≥ totalItems, and the counts differ by at
 * most 1 when they cannot divide evenly.
 */
export function getFinalItemPositions(
  itemIndex: number,
  totalItems: number,
  totalPositions: number,
): number[] {
  if (totalPositions === 0 || totalItems === 0) return [];
  const positions: number[] = [];
  for (let pos = 0; pos < totalPositions; pos++) {
    if (pos % totalItems === itemIndex) positions.push(pos);
  }
  return positions;
}

/**
 * The literal final-item characters a given hunt item reveals, e.g. "AT" —
 * for display next to that item once solved. Empty for jigsaw-kind final
 * items (positions are puzzle pieces, not letters) or when there's no final
 * item at all.
 */
export function getItemClueLetters(
  itemIndex: number,
  totalItems: number,
  finalItem: FinalItem | undefined,
): string {
  if (!finalItem || finalItem.kind === 'jigsaw') return '';
  const positions = getFinalItemPositions(itemIndex, totalItems, finalItem.answer.length);
  return positions
    .map((pos) => finalItem.answer[pos])
    .filter((c): c is string => Boolean(c) && c !== ' ')
    .join('')
    .toUpperCase();
}
