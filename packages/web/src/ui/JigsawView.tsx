import { useMemo } from 'react';

interface JigsawViewProps {
  imageUrl: string;
  gridSize: number;
  /** 'scrambled': pieces shuffled (hunt item). 'assembling': correct positions, progressive reveal (final item). */
  mode: 'scrambled' | 'assembling';
  /** assembling mode: which piece indices are revealed; undefined = all revealed. */
  revealedPieces?: Set<number>;
  /** scrambled mode: distortion/missing-piece intensity. */
  difficulty?: 1 | 2 | 3;
  /** scrambled mode: seed for reproducible shuffle (use item.id). */
  seed?: string;
}

function seededRng(seed: string): () => number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
    h = h | 0;
  }
  return () => {
    h = Math.imul(1664525, h) + 1013904223 | 0;
    return (h >>> 0) / 0x100000000;
  };
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  const rng = seededRng(seed);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Render a single jigsaw piece using CSS background sprite technique. */
function JigsawPiece({
  imageUrl,
  pieceIndex,
  gridSize,
  filter,
}: {
  imageUrl: string;
  pieceIndex: number;
  gridSize: number;
  filter?: string;
}) {
  const col = pieceIndex % gridSize;
  const row = Math.floor(pieceIndex / gridSize);
  const bgX = gridSize === 1 ? 0 : (col / (gridSize - 1)) * 100;
  const bgY = gridSize === 1 ? 0 : (row / (gridSize - 1)) * 100;
  return (
    <div
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
        backgroundPosition: `${bgX}% ${bgY}%`,
        backgroundRepeat: 'no-repeat',
        aspectRatio: '1',
        filter,
      }}
    />
  );
}

const DARK_CELL: React.CSSProperties = { background: '#1a1030', aspectRatio: '1' };

/** Jigsaw puzzle display — scrambled (hunt item) or progressively assembling (final item). */
export function JigsawView({ imageUrl, gridSize, mode, revealedPieces, difficulty = 1, seed = '' }: JigsawViewProps) {
  const totalPieces = gridSize * gridSize;

  const shuffledOrder = useMemo(() => {
    if (mode !== 'scrambled') return null;
    return seededShuffle(Array.from({ length: totalPieces }, (_, i) => i), seed);
  }, [mode, totalPieces, seed]);

  const missingSet = useMemo(() => {
    if (mode !== 'scrambled' || difficulty === 1) return new Set<number>();
    const rate = difficulty === 2 ? 0.12 : 0.22;
    const count = Math.floor(totalPieces * rate);
    const shuffled = seededShuffle(Array.from({ length: totalPieces }, (_, i) => i), seed + '_m');
    return new Set(shuffled.slice(0, count));
  }, [mode, totalPieces, difficulty, seed]);

  const rngForFilter = useMemo(() => seededRng(seed + '_f'), [seed]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        gap: 1,
        background: '#1a1030',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        aspectRatio: '1 / 1',
        width: '100%',
      }}
    >
      {Array.from({ length: totalPieces }, (_, displayIndex) => {
        if (mode === 'assembling') {
          if (revealedPieces && !revealedPieces.has(displayIndex)) {
            return <div key={displayIndex} style={DARK_CELL} />;
          }
          return <JigsawPiece key={displayIndex} imageUrl={imageUrl} pieceIndex={displayIndex} gridSize={gridSize} />;
        }

        // Scrambled mode
        if (missingSet.has(displayIndex)) {
          return <div key={displayIndex} style={DARK_CELL} />;
        }
        const sourceIndex = shuffledOrder![displayIndex]!;
        let filter: string | undefined;
        if (difficulty >= 2) {
          const b = (0.85 + rngForFilter() * 0.3).toFixed(2);
          const c = difficulty >= 3 ? (0.88 + rngForFilter() * 0.24).toFixed(2) : '1';
          filter = `brightness(${b}) contrast(${c})`;
        }
        return (
          <JigsawPiece key={displayIndex} imageUrl={imageUrl} pieceIndex={sourceIndex} gridSize={gridSize} filter={filter} />
        );
      })}
    </div>
  );
}
