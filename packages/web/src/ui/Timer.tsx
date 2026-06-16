import { useEffect, useRef, useState } from 'react';

/** Format a number of seconds as m:ss (or h:mm:ss when long). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

interface TimerProps {
  /** ISO start time. */
  startedAt?: string;
  /** ISO end time — when set, the timer freezes. */
  finishedAt?: string;
  /** When true, stop counting (accumulated time is frozen). */
  paused?: boolean;
}

/** A live ⏱ that counts up from `startedAt`, supporting pause. */
export function Timer({ startedAt, finishedAt, paused }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    // Seed elapsed from server time on mount (or when startedAt changes).
    setElapsed(Math.max(0, Date.now() - new Date(startedAt).getTime()));
    lastTickRef.current = Date.now();
  }, [startedAt]);

  useEffect(() => {
    if (!startedAt || finishedAt || paused) return;
    const id = setInterval(() => {
      const now = Date.now();
      setElapsed((e) => e + (now - lastTickRef.current));
      lastTickRef.current = now;
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, finishedAt, paused]);

  // When paused, update the lastTick ref so we don't double-count on resume.
  useEffect(() => {
    if (paused) lastTickRef.current = Date.now();
  }, [paused]);

  if (finishedAt && startedAt) {
    const secs = (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000;
    return <span className="timer">⏱ {formatDuration(secs)}</span>;
  }

  return <span className="timer">{paused ? '⏸' : '⏱'} {formatDuration(elapsed / 1000)}</span>;
}
