import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Report } from './Report.js';
import { api } from '../services/apiClient.js';

vi.mock('../services/apiClient', () => ({
  api: {
    listReports: vi.fn().mockResolvedValue({ reports: [] }),
    submitReport: vi.fn().mockResolvedValue({ report: {}, merged: false }),
  },
}));

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn().mockReturnValue({ user: null }),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

function renderReport() {
  return render(
    <MemoryRouter>
      <Report />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.listReports).mockResolvedValue({ reports: [] });
  mockUseAuth.mockReturnValue({ user: null });
});

afterEach(cleanup);

describe('Report screen', () => {
  it('renders Type and Severity toggle buttons', () => {
    renderReport();
    expect(screen.getByText('🐛 Bug')).toBeDefined();
    expect(screen.getByText('✨ Feature')).toBeDefined();
    expect(screen.getByText('1 Low')).toBeDefined();
    expect(screen.getByText('2 Medium')).toBeDefined();
    expect(screen.getByText('3 High')).toBeDefined();
  });

  it('severity row container has flexWrap wrap to prevent overflow on narrow screens', () => {
    const { container } = renderReport();
    const rows = container.querySelectorAll<HTMLElement>('.row');
    const severityRow = Array.from(rows).find((el) =>
      el.textContent?.includes('Severity'),
    );
    expect(severityRow).toBeDefined();
    expect(severityRow!.style.flexWrap).toBe('wrap');
  });

  it('type row container has flexWrap wrap to prevent overflow on narrow screens', () => {
    const { container } = renderReport();
    const rows = container.querySelectorAll<HTMLElement>('.row');
    const typeRow = Array.from(rows).find((el) =>
      el.textContent?.includes('Type'),
    );
    expect(typeRow).toBeDefined();
    expect(typeRow!.style.flexWrap).toBe('wrap');
  });

  it('clicking a severity button selects it', () => {
    renderReport();
    const highBtn = screen.getByText('3 High');
    fireEvent.click(highBtn);
    expect(highBtn.closest('button')?.className).toContain('btn--happy');
  });

  it('clicking a type button selects it', () => {
    renderReport();
    const featureBtn = screen.getByText('✨ Feature');
    fireEvent.click(featureBtn);
    expect(featureBtn.closest('button')?.className).toContain('btn--happy');
  });
});

const oneReport = [{
  id: 'r1', type: 'bug' as const, severity: 2 as const, status: 'new' as const,
  description: 'Something broke',
  reporters: [{ userId: 'u1', name: 'Alice', reportedAt: '2026-01-01T00:00:00Z' }],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}];

describe('Report screen — report list heading', () => {
  it('shows "Your reports" heading for a non-admin user when reports exist', async () => {
    vi.mocked(api.listReports).mockResolvedValue({ reports: oneReport });
    mockUseAuth.mockReturnValue({ user: { id: 'u1', name: 'Alice', email: 'alice@example.com', isAdmin: false } });
    renderReport();
    await screen.findByText('Your reports');
  });

  it('shows "All reports" heading for an admin user when reports exist', async () => {
    vi.mocked(api.listReports).mockResolvedValue({ reports: oneReport });
    mockUseAuth.mockReturnValue({ user: { id: 'admin1', name: 'Admin', email: 'admin@example.com', isAdmin: true } });
    renderReport();
    await screen.findByText('All reports');
  });
});
