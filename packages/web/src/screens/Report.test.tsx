import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Report } from './Report.js';

vi.mock('../services/apiClient', () => ({
  api: {
    listReports: vi.fn().mockResolvedValue({ reports: [] }),
    submitReport: vi.fn().mockResolvedValue({ report: {}, merged: false }),
  },
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({ user: null }),
}));

function renderReport() {
  return render(
    <MemoryRouter>
      <Report />
    </MemoryRouter>,
  );
}

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
