import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HuntStart } from './HuntStart.js';
import { api } from '../services/apiClient.js';

vi.mock('../services/media', () => ({ mediaUrl: (u: string) => u }));
vi.mock('../services/maps', () => ({ googleMapsLink: () => '#' }));

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn().mockReturnValue({ user: { id: 'u1', name: 'Alice' } }),
}));

vi.mock('../auth/AuthContext', () => ({ useAuth: mockUseAuth }));

vi.mock('../services/apiClient', () => ({
  api: {
    getRoute: vi.fn(),
    createTeam: vi.fn(),
  },
}));

const ROUTE_NO_COVER = {
  id: 'r1',
  title: 'Downtown Photo Walk',
  description: 'A fun walk around downtown.',
  coverPhotoUrl: undefined,
  authorId: 'u99',
  authorName: 'Bob',
  items: [
    { id: 'i1', name: 'Fountain', kind: 'photo', hint: { text: 'By the water' }, extraHints: [], photos: [], difficult: false },
    { id: 'i2', name: 'Clock', kind: 'photo', hint: { text: 'Tick tock' }, extraHints: [], photos: [], difficult: false },
  ],
  status: 'ready' as const,
  createdAt: '2026-01-01T00:00:00Z',
  ratings: [],
};

const ROUTE_WITH_COVER = {
  ...ROUTE_NO_COVER,
  coverPhotoUrl: '/cover.jpg',
};

function renderHuntStart() {
  return render(
    <MemoryRouter initialEntries={['/hunt/r1']}>
      <Routes>
        <Route path="/hunt/:routeId" element={<HuntStart />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('HuntStart – page title', () => {
  beforeEach(() => {
    vi.mocked(api.getRoute).mockResolvedValue(ROUTE_NO_COVER as any);
  });

  it('shows "Start hunt" in the page bar title', async () => {
    renderHuntStart();
    expect(screen.getAllByText('Start hunt').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Start hunt" after the route finishes loading', async () => {
    renderHuntStart();
    await screen.findByText('2 items');
    expect(screen.getByText('Start hunt')).toBeDefined();
  });
});

describe('HuntStart – no cover photo', () => {
  beforeEach(() => {
    vi.mocked(api.getRoute).mockResolvedValue(ROUTE_NO_COVER as any);
  });

  it('does not render the route title as a heading (no double title)', async () => {
    renderHuntStart();
    await screen.findByText('2 items');
    expect(screen.queryByRole('heading', { name: 'Downtown Photo Walk' })).toBeNull();
  });

  it('shows the item count', async () => {
    renderHuntStart();
    await screen.findByText('2 items');
  });

  it('shows action buttons', async () => {
    renderHuntStart();
    await screen.findByText('▶ Start Solo');
    expect(screen.getByText('👥 Team')).toBeDefined();
  });
});

describe('HuntStart – with cover photo', () => {
  beforeEach(() => {
    vi.mocked(api.getRoute).mockResolvedValue(ROUTE_WITH_COVER as any);
  });

  it('does not render the route title as a heading over the cover (no double title)', async () => {
    renderHuntStart();
    await screen.findByText('2 items');
    expect(screen.queryByRole('heading', { name: 'Downtown Photo Walk' })).toBeNull();
  });

  it('still shows "Start hunt" in the page bar', async () => {
    renderHuntStart();
    await screen.findByText('2 items');
    expect(screen.getByText('Start hunt')).toBeDefined();
  });
});

describe('HuntStart – error state', () => {
  beforeEach(() => {
    vi.mocked(api.getRoute).mockRejectedValue(new Error('Not found'));
  });

  it('shows "Start hunt" even when the route fetch fails', async () => {
    renderHuntStart();
    await screen.findByText('Not found');
    expect(screen.getByText('Start hunt')).toBeDefined();
  });
});
