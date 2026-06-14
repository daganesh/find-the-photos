import { useEffect, useState } from 'react';

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
}

/** A live ⏱ that counts up from `startedAt` until `finishedAt`. */
export function Timer({ startedAt, finishedAt }: TimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || finishedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, finishedAt]);

  if (!startedAt) return <span className="timer">0:00</span>;
  const end = finishedAt ? new Date(finishedAt).getTime() : now;
  const seconds = (end - new Date(startedAt).getTime()) / 1000;
  return <span className="timer">⏱ {formatDuration(seconds)}</span>;
}
