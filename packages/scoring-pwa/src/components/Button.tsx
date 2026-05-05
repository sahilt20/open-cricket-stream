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
    'bg-willow-gold text-willow-night hover:bg-amber-300 active:bg-amber-400 disabled:bg-willow-gold/40 disabled:text-willow-night/60 shadow-sm',
  secondary:
    'bg-willow-green text-white hover:bg-willow-green/80 active:bg-willow-green/70 disabled:opacity-40 border border-white/10',
  ghost:
    'bg-transparent text-white hover:bg-white/5 active:bg-white/10 disabled:opacity-40 border border-white/10',
  danger:
    'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 disabled:opacity-40 shadow-sm',
  score:
    'bg-willow-green/80 text-white text-2xl font-bold tabular-nums hover:bg-willow-green active:scale-95 disabled:opacity-40 shadow-md',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-md',
  md: 'h-10 px-4 text-sm rounded-lg',
  lg: 'h-12 px-5 text-base rounded-lg',
  tap: 'min-h-[60px] px-4 rounded-lg', // tappable on a phone
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
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-willow-gold focus-visible:ring-offset-2 focus-visible:ring-offset-willow-night',
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
