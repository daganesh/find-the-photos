import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TeamHuntPlayer } from './TeamHuntPlayer.js';
import { useTeamHunt } from '../hooks/useTeamHunt.js';

vi.mock('../services/sounds', () => ({ playSuccessSound: vi.fn() }));
vi.mock('../services/maps', () => ({ googleMapsLink: () => '#' }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Test User' } }),
}));

vi.mock('../services/apiClient', () => ({
  api: {
    // Outer TeamHuntPlayer calls getTeam to resolve sessionId
    getTeam: vi.fn().mockResolvedValue({
      id: 'team1',
      sessionId: 'sess1',
      name: 'Dream Team',
      status: 'active',
      joinCode: 'ABC123',
      members: [{ userId: 'u1', name: 'Test User', avatarEmoji: '🧑' }],
      startedAt: new Date(Date.now() - 6000).toISOString(),
      // photoUrl present so existing tests skip the team photo warm-up step
      photoUrl: 'https://example.com/team.jpg',
    }),
    // TeamHuntInner loads the route via useAsync → api.getRoute
    getRoute: vi.fn().mockResolvedValue({
      id: 'r1',
      title: 'Test Route',
      // Data must be inlined — vi.mock is hoisted before variable declarations
      items: [
        { id: 'riddle-1', name: 'Mystery Riddle', kind: 'riddle', hint: { text: 'Solve me' }, extraHints: [], photos: [] },
        { id: 'photo-1', name: 'Photo Item', kind: 'photo', hint: { text: 'Find me' }, extraHints: [], photos: [] },
      ],
      finalItem: undefined,
    }),
    uploadFile: vi.fn().mockResolvedValue({ url: 'https://example.com/uploaded.jpg' }),
    updateTeam: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../hooks/useTeamHunt', () => ({ useTeamHunt: vi.fn() }));

const mockTeamHunt = vi.mocked(useTeamHunt);
const noop = () => Promise.resolve();

const SESSION: any = {
  id: 'sess1',
  routeId: 'r1',
  startedAt: new Date().toISOString(),
  totalScore: 0,
  finalItemSolved: false,
  steps: [
    { itemId: 'riddle-1', status: 'active', cluesUsed: 0, photoAttempts: [] },
    { itemId: 'photo-1', status: 'active', cluesUsed: 0, photoAttempts: [] },
  ],
};

// Team that has been going for 6+ seconds — countdown is already 0
// photoUrl is set so the team photo warm-up step is skipped in these tests.
const TEAM_PAST: any = {
  id: 'team1',
  sessionId: 'sess1',
  name: 'Dream Team',
  status: 'active',
  joinCode: 'ABC123',
  members: [{ userId: 'u1', name: 'Test User', avatarEmoji: '🧑' }],
  startedAt: new Date(Date.now() - 6000).toISOString(),
  photoUrl: 'https://example.com/team.jpg',
};

// Team that started half a second ago — countdown is still running
const TEAM_RECENT: any = {
  ...TEAM_PAST,
  startedAt: new Date(Date.now() - 500).toISOString(),
};

const HUNT_BASE: any = {
  session: undefined,
  team: undefined,
  busy: false,
  error: undefined,
  lastVerdict: undefined,
  submitPhoto: noop,
  submitRiddleAnswer: noop,
  useHelp: noop,
  skip: noop,
  dispute: noop,
  returnToSkipped: noop,
  pauseOrResume: noop,
};

function renderTeamPlayer() {
  return render(
    <MemoryRouter initialEntries={['/team/team1/play']}>
      <Routes>
        <Route path="/team/:teamId/play" element={<TeamHuntPlayer />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // Restore real timers first — a previous fake-timer test may have timed out
  // before calling vi.useRealTimers(), leaving fake timers active for this test.
  vi.useRealTimers();
  mockTeamHunt.mockReturnValue({ ...HUNT_BASE });
  // Explicitly unmount any previous render so lingering intervals don't leak
  // across tests and confuse screen queries.
  cleanup();
});

// ── Countdown ────────────────────────────────────────────────────────────────

describe('TeamHuntPlayer – countdown', () => {
  it('uses .countdown-digit class when the team started recently', async () => {
    mockTeamHunt.mockReturnValue({ ...HUNT_BASE, session: SESSION, team: TEAM_RECENT });

    const { container } = renderTeamPlayer();

    await waitFor(() => expect(container.querySelector('.countdown-digit')).not.toBeNull());
    expect(container.querySelector('.countdown-digit')!.className).toContain('countdown-digit');
  });

  it('skips the countdown when the team started more than 5 seconds ago', async () => {
    mockTeamHunt.mockReturnValue({ ...HUNT_BASE, session: SESSION, team: TEAM_PAST });

    const { container } = renderTeamPlayer();

    // Hunt grid should be visible (not countdown)
    await waitFor(() => expect(container.textContent).toContain('Dream Team'));
    expect(container.querySelector('.countdown-digit')).toBeNull();
  });

  it('always starts countdown at 3 regardless of elapsed time, and counts exactly 3→2→1', async () => {
    vi.useFakeTimers();
    // Team started 2 seconds ago — old code would show "3" (ceil((5-2)*1000/1000)), but
    // we want to verify that the fixed code still starts at 3 and steps through all three values.
    const TEAM_2S_AGO: any = {
      ...TEAM_PAST,
      startedAt: new Date(Date.now() - 2000).toISOString(),
    };
    mockTeamHunt.mockReturnValue({ ...HUNT_BASE, session: SESSION, team: TEAM_2S_AGO });

    const { container } = renderTeamPlayer();

    // Flush the api.getTeam promise so TeamHuntInner mounts and the countdown
    // effect fires. waitFor cannot be used here because its internal polling
    // interval is intercepted by vi.useFakeTimers().
    await act(async () => { await Promise.resolve(); });

    // Initial render: countdown must show "3"
    expect(container.querySelector('.countdown-digit')).not.toBeNull();
    expect(container.querySelector('.countdown-digit')!.getAttribute('alt')).toBe('3');

    // After 1 s: "2"
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(container.querySelector('.countdown-digit')!.getAttribute('alt')).toBe('2');

    // After another 1 s: "1"
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(container.querySelector('.countdown-digit')!.getAttribute('alt')).toBe('1');

    // After another 1 s: countdown is gone
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(container.querySelector('.countdown-digit')).toBeNull();

    vi.useRealTimers();
  });
});

// ── Riddle items ─────────────────────────────────────────────────────────────

describe('TeamHuntPlayer – riddle items', () => {
  it('shows a text input when a riddle item is focused, not a photo-file input', async () => {
    mockTeamHunt.mockReturnValue({ ...HUNT_BASE, session: SESSION, team: TEAM_PAST });

    const user = userEvent.setup();
    const { container } = renderTeamPlayer();

    // Wait for the active-items grid to render
    await waitFor(() => screen.getAllByRole('button', { name: /Hunt this one/ }));

    // Click the first item button (riddle-1 — first in session.steps order)
    const firstHuntButton = screen.getAllByRole('button', { name: /Hunt this one/ })[0]!;
    await user.click(firstHuntButton);

    // Focused riddle view must show a text input
    await waitFor(() =>
      expect(container.querySelector('input[placeholder="Your answer…"]')).not.toBeNull(),
    );

    // Must NOT show photo-capture file inputs
    expect(container.querySelectorAll('input[type="file"]').length).toBe(0);
  });
});

// ── Team photo warm-up ────────────────────────────────────────────────────────

describe('TeamHuntPlayer – team photo warm-up', () => {
  it('shows the team photo screen when team has no photoUrl', async () => {
    const teamWithoutPhoto = { ...TEAM_PAST, photoUrl: undefined };
    mockTeamHunt.mockReturnValue({ ...HUNT_BASE, session: SESSION, team: teamWithoutPhoto });

    const { container } = renderTeamPlayer();

    await waitFor(() => expect(container.textContent).toContain('Strike a pose'));
    expect(screen.getByRole('button', { name: /Skip for now/ })).toBeTruthy();
  });

  it('skips team photo screen when team already has a photoUrl', async () => {
    mockTeamHunt.mockReturnValue({ ...HUNT_BASE, session: SESSION, team: TEAM_PAST });

    const { container } = renderTeamPlayer();

    await waitFor(() => expect(container.textContent).toContain('Dream Team'));
    expect(container.textContent).not.toContain('Strike a pose');
  });

  it('proceeds to the hunt after skipping the team photo', async () => {
    const teamWithoutPhoto = { ...TEAM_PAST, photoUrl: undefined };
    mockTeamHunt.mockReturnValue({ ...HUNT_BASE, session: SESSION, team: teamWithoutPhoto });

    const user = userEvent.setup();
    const { container } = renderTeamPlayer();

    await waitFor(() => screen.getByRole('button', { name: /Skip for now/ }));
    await user.click(screen.getByRole('button', { name: /Skip for now/ }));

    await waitFor(() => expect(container.textContent).toContain('Dream Team'));
  });
});
