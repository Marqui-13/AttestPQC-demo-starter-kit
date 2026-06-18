import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'default' | 'outline' | 'ghost' | 'destructive';
type Size = 'default' | 'sm';

const variantClasses: Record<Variant, string> = {
  default:
    'bg-teal-700 text-white hover:bg-teal-800 disabled:bg-teal-700/50 dark:bg-teal-600 dark:hover:bg-teal-500',
  outline:
    'border border-zinc-300 bg-transparent hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900',
  ghost: 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50 dark:bg-red-700 dark:hover:bg-red-600',
};

const sizeClasses: Record<Size, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-8 px-3 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  ),
);

Button.displayName = 'Button';