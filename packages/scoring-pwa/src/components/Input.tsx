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
        'w-full rounded-lg bg-pitch-raised px-3 py-2.5 text-base text-white placeholder:text-white/30',
        'border border-pitch-border focus:outline-none focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/40',
        invalid && 'border-danger/60 focus:ring-danger/30',
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
      <span className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-white/60">
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
      {error && <span className="mt-1 text-xs text-danger">{error}</span>}
    </Label>
  );
}
