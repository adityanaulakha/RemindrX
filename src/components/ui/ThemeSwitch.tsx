import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { ThemePreference } from '../../hooks/useTheme';

export function ThemeSwitch({
  preference,
  onChange,
  compact = false,
}: {
  preference: ThemePreference;
  onChange: (value: ThemePreference) => void;
  compact?: boolean;
}) {
  const options: { id: ThemePreference; icon: typeof Sun; label: string }[] = [
    { id: 'light', icon: Sun, label: 'Light' },
    { id: 'dark', icon: Moon, label: 'Dark' },
    { id: 'system', icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex rounded-xl border border-border bg-muted/60 p-1" role="radiogroup" aria-label="Color theme">
      {options.map((option) => {
        const active = preference === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all duration-200',
              compact ? 'w-9 px-0' : 'flex-1',
              active
                ? 'bg-surface-elevated text-foreground shadow-[var(--shadow)] glow-ring'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <option.icon className="h-3.5 w-3.5" />
            {!compact && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
