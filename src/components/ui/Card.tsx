import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  interactive?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevated = false, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-border bg-card text-card-foreground shadow-[var(--shadow)] backdrop-blur-xl',
        elevated && 'shadow-[var(--shadow-lg)]',
        interactive &&
          'transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-lg)]',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5 p-5 sm:p-6', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-snug tracking-tight text-foreground', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm leading-relaxed text-muted-foreground', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
