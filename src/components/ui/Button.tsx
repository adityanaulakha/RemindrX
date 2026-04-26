import React, { forwardRef } from 'react';
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
          'inline-flex items-center justify-center rounded-2xl font-black transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-50 uppercase tracking-widest text-xs italic',
          {
            'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:brightness-110': variant === 'primary',
            'bg-card/50 backdrop-blur-lg border border-border/50 text-foreground hover:bg-border/50 shadow-sm': variant === 'secondary',
            'bg-gradient-to-br from-danger to-danger/80 text-danger-foreground shadow-lg shadow-danger/20 hover:shadow-danger/40': variant === 'danger',
            'bg-gradient-to-br from-success to-success/80 text-primary-foreground shadow-lg shadow-success/20 hover:shadow-success/40': variant === 'success',
            'hover:bg-primary/10 text-foreground hover:text-primary': variant === 'ghost',
            'border-2 border-primary/30 text-primary hover:bg-primary/5': variant === 'outline',
            'bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20': variant === 'glass',
            'h-9 px-4': size === 'sm',
            'h-12 px-6 py-2': size === 'md',
            'h-14 px-10 text-sm': size === 'lg',
            'h-16 px-12 text-base': size === 'xl',
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
