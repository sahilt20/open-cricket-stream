import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-lg bg-white/5 px-3 py-2 text-base text-white placeholder:text-white/30',
        'border border-white/10 focus:outline-none focus:ring-2 focus:ring-willow-gold/60 focus:border-transparent',
        invalid && 'border-rose-500/60 focus:ring-rose-500/40',
        'transition-colors',
        className,
      )}
      {...rest}
    />
  );
});

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  hint?: ReactNode;
}

export function Label({ children, hint, className, ...rest }: LabelProps) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)} {...rest}>
      <span className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-white/70">
        <span>{children}</span>
        {hint && <span className="text-[10px] font-normal text-white/40">{hint}</span>}
      </span>
    </label>
  );
}

export function FormField({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Label hint={hint} className={className}>
      {label}
      <div className="mt-1.5">{children}</div>
      {error && <span className="mt-1 text-xs text-rose-400">{error}</span>}
    </Label>
  );
}
