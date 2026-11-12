import { cn } from '../lib/cn';

type BrandMarkProps = {
  className?: string;
  size?: number;
  alt?: string;
};

/** App logo mark — geometric mortarboard on graphite tile. */
export function BrandMark({ className, size = 36, alt = 'RemindrX' }: BrandMarkProps) {
  return (
    <img
      src="/logo-mark.svg"
      width={size}
      height={size}
      alt={alt}
      className={cn('shrink-0 rounded-[22%] object-cover', className)}
      decoding="async"
    />
  );
}

type BrandLockupProps = {
  className?: string;
  markSize?: number;
  wordmarkClassName?: string;
};

/** Mark + RemindrX wordmark in the app typeface. */
export function BrandLockup({ className, markSize = 36, wordmarkClassName }: BrandLockupProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark size={markSize} alt="" />
      <span className={cn('font-semibold tracking-tight', wordmarkClassName)}>RemindrX</span>
    </span>
  );
}
