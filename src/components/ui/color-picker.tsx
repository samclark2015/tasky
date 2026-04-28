import { cn } from '@/lib/utils';

export const PRESET_COLORS = [
  '#6366f1', '#ec4899', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#8b5cf6', '#ef4444',
  '#64748b', '#0ea5e9', '#84cc16', '#f43f5e',
];

interface ColorPickerProps {
  value: string | null;
  onChange: (color: string) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            'h-6 w-6 rounded-full transition-all',
            value === c
              ? 'ring-2 ring-offset-2 ring-primary ring-offset-background scale-110'
              : 'hover:scale-105'
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
