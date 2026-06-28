import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImageLightbox } from './ImageLightbox.js';

describe('ImageLightbox', () => {
  it('renders children inside the lightbox', () => {
    const { getByText } = render(
      <ImageLightbox onClose={vi.fn()}>
        <span>Puzzle content</span>
      </ImageLightbox>,
    );
    expect(getByText('Puzzle content')).toBeTruthy();
  });

  it('renders a close button with aria-label', () => {
    const { getByRole } = render(
      <ImageLightbox onClose={vi.fn()}>content</ImageLightbox>,
    );
    expect(getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <ImageLightbox onClose={onClose}>content</ImageLightbox>,
    );
    fireEvent.click(getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <ImageLightbox onClose={onClose}>content</ImageLightbox>,
    );
    fireEvent.click(getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when the content area is clicked', () => {
    const onClose = vi.fn();
    const { getByText } = render(
      <ImageLightbox onClose={onClose}>
        <span>Inner content</span>
      </ImageLightbox>,
    );
    fireEvent.click(getByText('Inner content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<ImageLightbox onClose={onClose}>content</ImageLightbox>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose for non-Escape keys', () => {
    const onClose = vi.fn();
    render(<ImageLightbox onClose={onClose}>content</ImageLightbox>);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('has role="dialog" and aria-modal="true"', () => {
    const { getByRole } = render(
      <ImageLightbox onClose={vi.fn()}>content</ImageLightbox>,
    );
    const dialog = getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });
});
