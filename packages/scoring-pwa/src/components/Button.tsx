import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'score';
type Size = 'sm' | 'md' | 'lg' | 'tap';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent-gold text-pitch-bg hover:bg-amber-400 active:bg-amber-500 disabled:bg-accent-gold/40 disabled:text-pitch-bg/60 shadow-sm',
  secondary:
    'bg-pitch-raised text-white hover:bg-pitch-muted/60 active:bg-pitch-muted/80 disabled:opacity-40 border border-pitch-border',
  ghost:
    'bg-transparent text-white hover:bg-pitch-raised active:bg-pitch-muted/40 disabled:opacity-40 border border-pitch-border',
  danger:
    'bg-danger text-white hover:bg-danger-dim active:bg-danger-dim disabled:opacity-40 shadow-sm',
  score:
    'bg-pitch-raised text-white border border-pitch-border hover:bg-pitch-muted/60 active:scale-95 disabled:opacity-40 shadow-md',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm rounded-lg',
  lg: 'h-12 px-5 text-base rounded-xl',
  tap: 'min-h-[60px] px-4 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-bg',
        'disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
