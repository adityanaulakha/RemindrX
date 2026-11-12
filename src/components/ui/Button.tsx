import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-normal normal-case not-italic transition-colors duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          {
            'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90': variant === 'primary',
            'bg-muted text-foreground border border-border hover:bg-muted/70': variant === 'secondary',
            'bg-danger text-danger-foreground shadow-sm hover:bg-danger/90': variant === 'danger',
            'bg-success text-success-foreground shadow-sm hover:bg-success/90': variant === 'success',
            'text-foreground hover:bg-muted': variant === 'ghost',
            'border border-primary/40 text-primary bg-transparent hover:bg-primary-soft': variant === 'outline',
            'bg-card text-foreground border border-border hover:bg-muted': variant === 'glass',
            'h-10 px-3 text-sm': size === 'sm',
            'h-11 px-4 text-sm': size === 'md',
            'h-12 px-5 text-sm': size === 'lg',
            'h-12 px-6 text-base': size === 'xl',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
