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
