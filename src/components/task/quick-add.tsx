import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface QuickAddProps {
  onAdd: (title: string) => void;
  placeholder?: string;
  className?: string;
}

export function QuickAdd({ onAdd, placeholder = 'Add task…', className }: QuickAddProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { setValue(''); inputRef.current?.blur(); }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b border-border/50 transition-colors',
        focused ? 'bg-accent/30' : 'hover:bg-accent/20',
        className
      )}
    >
      <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {value.trim() && (
        <button
          onClick={submit}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ↵
        </button>
      )}
    </div>
  );
}
