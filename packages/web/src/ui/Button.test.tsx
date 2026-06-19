import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
  it('defaults to type="button" so it never triggers accidental form submission', () => {
    const { container } = render(<Button>Click me</Button>);
    expect(container.querySelector('button')?.type).toBe('button');
  });

  it('allows explicit type="submit" for real form submit buttons', () => {
    const { container } = render(<Button type="submit">Save</Button>);
    expect(container.querySelector('button')?.type).toBe('submit');
  });

  it('applies the variant class', () => {
    const { container } = render(<Button variant="happy">Go</Button>);
    expect(container.querySelector('button')?.className).toContain('btn--happy');
  });
});
