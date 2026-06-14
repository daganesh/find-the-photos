import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  clickable?: boolean;
  children: ReactNode;
}

/** A soft, rounded surface for grouping content. */
export function Card({ clickable = false, className = '', children, ...rest }: CardProps) {
  const classes = ['card', clickable ? 'card--clickable' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
