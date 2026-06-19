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
const TEAM_PAST: any = {
  id: 'team1',
  sessionId: 'sess1',
  name: 'Dream Team',
  status: 'active',
  joinCode: 'ABC123',
  members: [{ userId: 'u1', name: 'Test User', avatarEmoji: '🧑' }],
  startedAt: new Date(Date.now() - 6000).toISOString(),
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
    const [firstHuntButton] = screen.getAllByRole('button', { name: /Hunt this one/ });
    await user.click(firstHuntButton);

    // Focused riddle view must show a text input
    await waitFor(() =>
      expect(container.querySelector('input[placeholder="Your answer…"]')).not.toBeNull(),
    );

    // Must NOT show photo-capture file inputs
    expect(container.querySelectorAll('input[type="file"]').length).toBe(0);
  });
});
