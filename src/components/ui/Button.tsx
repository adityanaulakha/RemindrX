import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export { cn };

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
          'inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition-all duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          {
            'bg-primary text-primary-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_40%,transparent),0_10px_28px_-12px_var(--glow)] hover:brightness-110':
              variant === 'primary',
            'bg-muted/80 text-foreground border border-border hover:bg-muted hover:border-primary/25':
              variant === 'secondary',
            'bg-danger text-danger-foreground shadow-sm hover:brightness-110': variant === 'danger',
            'bg-success text-success-foreground shadow-sm hover:brightness-110': variant === 'success',
            'text-muted-foreground hover:bg-muted hover:text-foreground': variant === 'ghost',
            'border border-primary/35 text-primary bg-primary-soft/40 hover:bg-primary-soft': variant === 'outline',
            'glass-panel text-foreground hover:border-primary/30': variant === 'glass',
            'h-9 px-3 text-xs': size === 'sm',
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
