import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn.js';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full rounded-t-2xl border border-pitch-border bg-pitch-surface shadow-2xl shadow-black/60 sm:rounded-2xl',
          'animate-sheet-up',
          sizes[size],
        )}
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
          <div>
            {title && <h2 className="text-lg font-bold text-white">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-white/60">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1 rounded-lg p-1 text-white/40 hover:bg-pitch-raised hover:text-white/80 transition-colors"
          >
            <X size={20} />
          </button>
        </header>
        <div className="px-5 pb-5">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-pitch-border px-5 py-3">{footer}</footer>
        )}
      </div>
    </div>
  );
}
