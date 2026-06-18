import { useEffect, useState } from 'react';
import { mediaUrl } from '../services/media.js';

export interface GuessToastData {
  id: string;
  playerName: string;
  playerEmoji: string;
  /** Set for photo guesses — shows a Polaroid. */
  photoUrl?: string;
  /** Set for text guesses (riddle solved) — shows a speech bubble. */
  textContent?: string;
  correct: boolean;
  /** Background colour for the card (pre-picked so it's stable). */
  bgColor: string;
  /** Rotation of the whole card in degrees. */
  tilt: number;
  /** Rotation of the photo/bubble inside the card in degrees. */
  innerTilt: number;
  /** Randomly chosen result line (pre-picked so it's stable). */
  resultLine: string;
}

// ── Colour palette — warm / fun, never white ───────────────────────────────
export const TOAST_BG_COLORS = [
  '#FDE68A', // amber
  '#FCA5A5', // rose
  '#6EE7B7', // emerald
  '#93C5FD', // sky
  '#C4B5FD', // violet
  '#F9A8D4', // pink
  '#67E8F9', // cyan
  '#FBB860', // orange
];

// ── Text variants ──────────────────────────────────────────────────────────
const SUCCESS_LINES = [
  'NAILED IT! 🎯',
  'BOOM! That\'s a match! 💥',
  'Yes yes yes! ✅',
  'PERFECT! 🏆',
  'Absolutely incredible! 🔥',
  'Unbelievable! 🎉',
  'Are you kidding?! 😱',
];

const FAIL_LINES = [
  'Ooooohhh… not quite! 😅',
  'The AI said NOPE 🤖',
  'Nice try! 😂',
  'Hmm, close but no! 🙈',
  'Keep looking… 💪',
  'Swing and a miss! ⚾',
  'Almost! …but not really 🤷',
];

const RIDDLE_LINES = [
  'They cracked it! 🧠',
  'Big brain moment! 🤯',
  'Riddle master! 🔮',
  'How did they know?! 😱',
  'Absolute genius! 🏆',
  'They figured it out! 🎯',
];

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randomTilt(range: number): number {
  return (Math.random() - 0.5) * 2 * range;
}

export function buildToastResultLine(photoUrl: string | undefined, correct: boolean): string {
  if (!photoUrl) return pickRandom(RIDDLE_LINES);
  return correct ? pickRandom(SUCCESS_LINES) : pickRandom(FAIL_LINES);
}

// ── Component ──────────────────────────────────────────────────────────────

interface GuessToastOverlayProps {
  toast: GuessToastData;
  onDismiss: () => void;
}

export function GuessToastOverlay({ toast, onDismiss }: GuessToastOverlayProps) {
  const [visible, setVisible] = useState(false);

  // Animate in on mount.
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 16);
    return () => clearTimeout(t);
  }, []);

  const resultColor = toast.correct ? '#14532d' : '#7f1d1d';

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.48)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.18s ease',
        cursor: 'pointer',
        padding: '0 24px',
      }}
    >
      {/* Card — click doesn't propagate to the overlay dismiss */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: toast.bgColor,
          borderRadius: 22,
          padding: '22px 24px 18px',
          maxWidth: 320,
          width: '100%',
          transform: `rotate(${toast.tilt}deg) scale(${visible ? 1 : 0.7})`,
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: '0 10px 48px rgba(0,0,0,0.38)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Who guessed */}
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', textAlign: 'center', color: 'rgba(0,0,0,0.65)' }}>
          {toast.playerEmoji} <strong style={{ color: '#000' }}>{toast.playerName}</strong> just guessed:
        </p>

        {/* Media — Polaroid for photo, comic bubble for text */}
        {toast.photoUrl ? (
          <Polaroid url={toast.photoUrl} tilt={toast.innerTilt} />
        ) : (
          <ComicBubble text={toast.textContent ?? '?'} tilt={toast.innerTilt} />
        )}

        {/* Result line */}
        <p style={{
          margin: 0,
          fontSize: '1.2rem',
          fontWeight: 900,
          textAlign: 'center',
          color: resultColor,
          letterSpacing: '-0.01em',
        }}>
          …{toast.resultLine}
        </p>

        <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(0,0,0,0.38)', textAlign: 'center' }}>
          tap anywhere to dismiss
        </p>
      </div>
    </div>
  );
}

// ── Polaroid ───────────────────────────────────────────────────────────────

function Polaroid({ url, tilt }: { url: string; tilt: number }) {
  return (
    <div style={{
      background: '#fff',
      padding: '8px 8px 30px',
      boxShadow: '3px 5px 16px rgba(0,0,0,0.28)',
      transform: `rotate(${tilt}deg)`,
      flexShrink: 0,
      width: 168,
    }}>
      <img
        src={mediaUrl(url)}
        alt=""
        style={{ width: '100%', height: 126, objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}

// ── Comic speech bubble ────────────────────────────────────────────────────

function ComicBubble({ text, tilt }: { text: string; tilt: number }) {
  return (
    <div style={{ transform: `rotate(${tilt}deg)`, alignSelf: 'flex-start', marginLeft: 12 }}>
      {/* Bubble */}
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '12px 18px',
        maxWidth: 220,
        boxShadow: '2px 4px 10px rgba(0,0,0,0.18)',
        fontSize: '1.05rem',
        fontStyle: 'italic',
        fontWeight: 700,
        color: '#1f2937',
        lineHeight: 1.4,
        wordBreak: 'break-word',
      }}>
        "{text}"
      </div>
      {/* Tail */}
      <div style={{
        width: 0,
        height: 0,
        borderLeft: '14px solid #fff',
        borderRight: '12px solid transparent',
        borderTop: '14px solid transparent',
        marginLeft: 20,
        filter: 'drop-shadow(1px 3px 2px rgba(0,0,0,0.12))',
      }} />
    </div>
  );
}
