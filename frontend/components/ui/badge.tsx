import { type HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'muted';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  muted: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400',
};

export function Badge({
  variant = 'default',
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    />
  );
}