import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { BottomBar } from './BottomBar.js';

afterEach(cleanup);

const defaultProps = {
  onCreate: vi.fn(),
  onJoin: vi.fn(),
  onMyHunts: vi.fn(),
  onMyScores: vi.fn(),
  onMyHistory: vi.fn(),
};

describe('BottomBar', () => {
  it('renders all five navigation buttons', () => {
    render(<BottomBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Create new hunt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join a hunt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My hunts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My scores' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My history' })).toBeInTheDocument();
  });

  it('calls onCreate when Create button is clicked', () => {
    const onCreate = vi.fn();
    render(<BottomBar {...defaultProps} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create new hunt' }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('disables the Create button and shows loading label when creating', () => {
    render(<BottomBar {...defaultProps} creating />);
    const btn = screen.getByRole('button', { name: 'Creating hunt…' });
    expect(btn).toBeDisabled();
  });

  it('calls onJoin when Join button is clicked', () => {
    const onJoin = vi.fn();
    render(<BottomBar {...defaultProps} onJoin={onJoin} />);
    fireEvent.click(screen.getByRole('button', { name: 'Join a hunt' }));
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it('calls onMyHunts when My hunts button is clicked', () => {
    const onMyHunts = vi.fn();
    render(<BottomBar {...defaultProps} onMyHunts={onMyHunts} />);
    fireEvent.click(screen.getByRole('button', { name: 'My hunts' }));
    expect(onMyHunts).toHaveBeenCalledOnce();
  });

  it('calls onMyScores when My scores button is clicked', () => {
    const onMyScores = vi.fn();
    render(<BottomBar {...defaultProps} onMyScores={onMyScores} />);
    fireEvent.click(screen.getByRole('button', { name: 'My scores' }));
    expect(onMyScores).toHaveBeenCalledOnce();
  });

  it('calls onMyHistory when My history button is clicked', () => {
    const onMyHistory = vi.fn();
    render(<BottomBar {...defaultProps} onMyHistory={onMyHistory} />);
    fireEvent.click(screen.getByRole('button', { name: 'My history' }));
    expect(onMyHistory).toHaveBeenCalledOnce();
  });

  it('renders a nav element with an accessible label', () => {
    render(<BottomBar {...defaultProps} />);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });
});
