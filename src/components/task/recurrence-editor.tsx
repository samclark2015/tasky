import { useState } from 'react';
import type { RecurrenceRule } from '@/types/types';
import { cn } from '@/lib/utils';
import { RefreshCw, X } from 'lucide-react';

const DAYS_OF_WEEK = [
  { label: 'Su', value: 'SU' },
  { label: 'Mo', value: 'MO' },
  { label: 'Tu', value: 'TU' },
  { label: 'We', value: 'WE' },
  { label: 'Th', value: 'TH' },
  { label: 'Fr', value: 'FR' },
  { label: 'Sa', value: 'SA' },
];

const FREQ_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

interface RecurrenceEditorProps {
  value: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
  className?: string;
}

export function RecurrenceEditor({ value, onChange, className }: RecurrenceEditorProps) {
  const [expanded, setExpanded] = useState(value !== null);

  function toggleEnabled() {
    if (value) {
      onChange(null);
      setExpanded(false);
    } else {
      onChange({ freq: 'weekly', interval: 1 });
      setExpanded(true);
    }
  }

  function update(patch: Partial<RecurrenceRule>) {
    if (!value) return;
    onChange({ ...value, ...patch });
  }

  function toggleDay(day: string) {
    if (!value) return;
    const current = value.byDay ?? [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    update({ byDay: next.length ? next : undefined });
  }

  return (
    <div className={cn('space-y-3', className)}>
      <button
        type="button"
        onClick={toggleEnabled}
        className={cn(
          'flex items-center gap-2 text-sm transition-colors',
          value ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <RefreshCw className="h-4 w-4" />
        <span>{value ? 'Recurring' : 'Add recurrence'}</span>
        {value && <X className="h-3 w-3 ml-1 opacity-60 hover:opacity-100" />}
      </button>

      {value && expanded && (
        <div className="pl-6 space-y-3">
          {/* Frequency */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground w-12">Every</span>
            <input
              type="number"
              min={1}
              max={99}
              value={value.interval ?? 1}
              onChange={(e) => update({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-14 text-sm bg-muted rounded px-2 py-1 outline-none text-center"
            />
            <div className="flex gap-1">
              {FREQ_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update({ freq: opt.value, byDay: undefined, byMonthDay: undefined })}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                    value.freq === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day-of-week picker for weekly */}
          {value.freq === 'weekly' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground w-12">On</span>
              <div className="flex gap-1">
                {DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={cn(
                      'w-7 h-7 rounded-full text-xs font-medium border transition-colors',
                      (value.byDay ?? []).includes(d.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* End condition */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground w-12">Ends</span>
            <div className="flex gap-1.5 flex-wrap">
              {/* Never */}
              <button
                type="button"
                onClick={() => update({ count: undefined, until: undefined })}
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                  !value.count && !value.until
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                )}
              >
                Never
              </button>

              {/* After N times */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => update({ count: value.count ?? 10, until: undefined })}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                    value.count
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  After
                </button>
                {value.count && (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={value.count}
                      onChange={(e) => update({ count: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-14 text-sm bg-muted rounded px-2 py-1 outline-none text-center"
                    />
                    <span className="text-xs text-muted-foreground">times</span>
                  </>
                )}
              </div>

              {/* On date */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + 3);
                    update({ until: d.toISOString().split('T')[0], count: undefined });
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                    value.until
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  On
                </button>
                {value.until && (
                  <input
                    type="date"
                    value={value.until}
                    onChange={(e) => update({ until: e.target.value })}
                    className="text-sm bg-muted rounded px-2 py-1 outline-none text-foreground [color-scheme:light] dark:[color-scheme:dark]"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
