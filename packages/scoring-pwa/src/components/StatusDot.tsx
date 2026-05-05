import { cn } from '../lib/cn.js';

type Tone = 'green' | 'amber' | 'red' | 'gray';

const tones: Record<Tone, string> = {
  green: 'bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/50',
  amber: 'bg-amber-400 shadow-[0_0_8px] shadow-amber-400/50',
  red: 'bg-rose-500',
  gray: 'bg-white/30',
};

export function StatusDot({ tone, label, className }: { tone: Tone; label?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-xs', className)}>
      <span className={cn('inline-block h-2 w-2 rounded-full', tones[tone])} aria-hidden="true" />
      {label && <span className="text-white/70">{label}</span>}
    </span>
  );
}
