import React, { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from './Button';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="block text-xs font-black uppercase tracking-widest text-foreground/40 ml-1 italic">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'flex h-14 w-full rounded-2xl border border-border/50 bg-card/50 backdrop-blur-md px-4 py-2 text-sm text-foreground placeholder:text-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 shadow-inner',
            error && 'border-danger/50 focus-visible:ring-danger/40',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-[10px] font-bold text-danger uppercase tracking-wider ml-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
