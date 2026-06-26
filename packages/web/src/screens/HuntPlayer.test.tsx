import { act, render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HuntPlayer } from './HuntPlayer.js';
import { useHunt } from '../hooks/useHunt.js';

vi.mock('../services/sounds', () => ({ playSuccessSound: vi.fn() }));
vi.mock('../services/media', () => ({ mediaUrl: (u: string) => u }));
vi.mock('../services/maps', () => ({ googleMapsLink: () => '#' }));
vi.mock('../hooks/useHunt', () => ({ useHunt: vi.fn() }));
vi.mock('../services/apiClient', () => ({
  api: {
    getRoute: vi.fn().mockResolvedValue({
      id: 'r1',
      title: 'Test Route',
      description: '',
      coverPhotoUrl: undefined,
      finalItem: undefined,
      items: [
        { id: 'riddle-1', name: 'Riddle Item', kind: 'riddle', hint: { text: 'Solve me' }, extraHints: [], photos: [] },
        { id: 'photo-1', name: 'Photo Item', kind: 'photo', hint: { text: 'Find me' }, extraHints: [], photos: [] },
      ],
    }),
  },
}));

const mockHunt = vi.mocked(useHunt);
const noop = () => Promise.resolve();

const SESSION: any = {
  id: 's1',
  routeId: 'r1',
  startedAt: new Date().toISOString(),
  totalScore: 0,
  finalItemSolved: false,
  steps: [
    { itemId: 'riddle-1', status: 'active', cluesUsed: 0, photoAttempts: [] },
    { itemId: 'photo-1', status: 'pending', cluesUsed: 0, photoAttempts: [] },
  ],
};

const HUNT_BASE: any = {
  session: undefined,
  activeStep: undefined,
  loading: false,
  notStarted: true,
  wasResumed: false,
  busy: false,
  paused: false,
  error: undefined,
  lastVerdict: undefined,
  start: noop, submitPhoto: noop, useHelp: noop, skip: noop,
  dispute: noop, submitRiddleAnswer: noop, solveFinalItem: noop,
  returnToSkipped: noop, pause: noop, resume: noop,
};

function renderPlayer() {
  return render(
    <MemoryRouter initialEntries={['/play/r1']}>
      <Routes>
        <Route path="/play/:routeId" element={<HuntPlayer />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockHunt.mockReturnValue({ ...HUNT_BASE });
});

// ── Countdown ────────────────────────────────────────────────────────────────

describe('HuntPlayer – countdown', () => {
  afterEach(() => vi.useRealTimers());

  it('uses .countdown-digit class on the number (catches wrong keyframe regression)', async () => {
    mockHunt.mockReturnValue({
      ...HUNT_BASE,
      session: SESSION,
      notStarted: false,
      wasResumed: false,
      activeStep: SESSION.steps[0],
    });

    const { container } = renderPlayer();

    await waitFor(() => expect(container.querySelector('.countdown-digit')).not.toBeNull());
    expect(container.querySelector('.countdown-digit')!.className).toContain('countdown-digit');
  });

  it('countdown completes and digit clears, then hunt UI is visible', async () => {
    // Note: React's act() batches the 0→null state transition synchronously, so
    // a single-frame "0" flash cannot be detected here — that requires an e2e test.
    // This test verifies the countdown finishes cleanly and hands off to the hunt UI.
    vi.useFakeTimers();
    mockHunt.mockReturnValue({
      ...HUNT_BASE,
      session: SESSION,
      notStarted: false,
      wasResumed: false,
      activeStep: SESSION.steps[0],
    });

    const { container } = renderPlayer();
    // Flush the mocked api.getRoute promise + React state updates
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    // Digit must be visible (countdown started)
    expect(container.querySelector('.countdown-digit')).not.toBeNull();

    // Each act() fires one pending setTimeout and lets React re-render + register the next one.
    // 3 ticks (3→2→1→0) plus one extra flush for the synchronous setCountdown(null) at 0.
    for (let i = 0; i < 4; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { vi.advanceTimersByTime(1000); });
    }

    // Digit is gone and hunt UI has taken over
    expect(container.querySelector('.countdown-digit')).toBeNull();
    expect(container.textContent).toContain('Clue 1');
  });

  it('skips the countdown when the session was resumed', async () => {
    mockHunt.mockReturnValue({
      ...HUNT_BASE,
      session: SESSION,
      notStarted: false,
      wasResumed: true,
      activeStep: SESSION.steps[0],
    });

    const { container } = renderPlayer();

    // Hunt UI (with step number) must be visible instead of countdown
    await waitFor(() => expect(container.textContent).toContain('Clue 1'));
    expect(container.querySelector('.countdown-digit')).toBeNull();
  });
});

// ── Riddle items ─────────────────────────────────────────────────────────────

describe('HuntPlayer – riddle items', () => {
  it('shows a text input for the answer, not a photo-file input', async () => {
    mockHunt.mockReturnValue({
      ...HUNT_BASE,
      session: SESSION,
      notStarted: false,
      wasResumed: true, // bypass countdown so hunt UI renders immediately
      activeStep: SESSION.steps[0], // riddle-1
    });

    const { container } = renderPlayer();

    await waitFor(() =>
      expect(container.querySelector('input[placeholder="Your answer…"]')).not.toBeNull(),
    );

    // Photo-capture file inputs must NOT be present for a riddle item
    expect(container.querySelectorAll('input[type="file"]').length).toBe(0);
  });
});

// ── Thinking overlay ─────────────────────────────────────────────────────────

describe('HuntPlayer – thinking overlay', () => {
  it('shows thinking overlay when busy and hides it when not', async () => {
    mockHunt.mockReturnValue({
      ...HUNT_BASE,
      session: SESSION,
      notStarted: false,
      wasResumed: true,
      activeStep: SESSION.steps[0],
      busy: true,
    });

    const { getByRole, rerender } = renderPlayer();

    await waitFor(() => expect(getByRole('status', { name: 'Thinking' })).toBeTruthy());

    // Simulate end of API call
    mockHunt.mockReturnValue({
      ...HUNT_BASE,
      session: SESSION,
      notStarted: false,
      wasResumed: true,
      activeStep: SESSION.steps[0],
      busy: false,
    });

    rerender(
      <MemoryRouter initialEntries={['/play/r1']}>
        <Routes>
          <Route path="/play/:routeId" element={<HuntPlayer />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(document.querySelector('[role="status"][aria-label="Thinking"]')).toBeNull(),
    );
  });
});
