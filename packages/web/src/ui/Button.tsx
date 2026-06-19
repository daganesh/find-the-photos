import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'accent' | 'happy' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg';
  block?: boolean;
  children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: '',
  ghost: 'btn--ghost',
  accent: 'btn--accent',
  happy: 'btn--happy',
  danger: 'btn--danger',
};

/** The one button used everywhere — big, friendly, and consistent. */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    VARIANT_CLASS[variant],
    size === 'lg' ? 'btn--lg' : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
