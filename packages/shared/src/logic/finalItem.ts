/** Grid edge length (pieces per side) for each jigsaw difficulty level. */
export function getJigsawGridSize(difficulty: 1 | 2 | 3): number {
  return difficulty === 1 ? 3 : difficulty === 2 ? 5 : 10;
}

/**
 * Positions (0-based indices) of the final item answer/jigsaw that a given
 * hunt item reveals. Positions are distributed in equal consecutive chunks.
 * The last item may receive fewer positions when totalPositions % totalItems ≠ 0.
 */
export function getFinalItemPositions(
  itemIndex: number,
  totalItems: number,
  totalPositions: number,
): number[] {
  if (totalPositions === 0 || totalItems === 0) return [];
  const chunkSize = Math.ceil(totalPositions / totalItems);
  const start = itemIndex * chunkSize;
  const end = Math.min(start + chunkSize, totalPositions);
  return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
}
