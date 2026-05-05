import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  pad?: 'none' | 'sm' | 'md' | 'lg';
}

const padding: Record<NonNullable<CardProps['pad']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({ title, description, actions, pad = 'md', className, children, ...rest }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur shadow-lg',
        padding[pad],
        className,
      )}
      {...rest}
    >
      {(title || actions) && (
        <header className={cn('flex items-start justify-between gap-3', children ? 'mb-3' : '')}>
          {(title || description) && (
            <div>
              {title && <h2 className="text-base font-semibold text-white">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-white/60">{description}</p>}
            </div>
          )}
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
