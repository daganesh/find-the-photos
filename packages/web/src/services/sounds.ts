/** Web Audio API success sounds — no audio files needed. */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  // Resume after a user-gesture suspension (mobile browsers).
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function playNote(
  audioCtx: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.25,
) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.start(startAt);
  osc.stop(startAt + duration);
}

// Four distinct happy melodies.
const variations: Array<{ freq: number; delay: number; duration: number }[]> = [
  // Ascending chord (C-E-G)
  [
    { freq: 523, delay: 0,    duration: 0.4 },
    { freq: 659, delay: 0.1,  duration: 0.4 },
    { freq: 784, delay: 0.2,  duration: 0.5 },
  ],
  // Bouncy fanfare
  [
    { freq: 440, delay: 0,    duration: 0.15 },
    { freq: 440, delay: 0.17, duration: 0.15 },
    { freq: 660, delay: 0.34, duration: 0.4 },
  ],
  // Rising arpeggio (D-F#-A-D)
  [
    { freq: 587, delay: 0,    duration: 0.2 },
    { freq: 740, delay: 0.12, duration: 0.2 },
    { freq: 880, delay: 0.24, duration: 0.2 },
    { freq: 1175, delay: 0.36, duration: 0.4 },
  ],
  // Cheerful two-note jump
  [
    { freq: 523, delay: 0,    duration: 0.2 },
    { freq: 784, delay: 0.22, duration: 0.2 },
    { freq: 1047, delay: 0.44, duration: 0.4 },
  ],
];

let lastVariation = -1;

export function playSuccessSound(): void {
  try {
    const audioCtx = getCtx();
    // Pick a different variation each time.
    let v = Math.floor(Math.random() * variations.length);
    if (v === lastVariation) v = (v + 1) % variations.length;
    lastVariation = v;

    const notes = variations[v]!;
    const now = audioCtx.currentTime;
    notes.forEach(({ freq, delay, duration }) => {
      playNote(audioCtx, freq, now + delay, duration);
    });
  } catch {
    // Audio not available (e.g., SSR or strict policy) — fail silently.
  }
}
