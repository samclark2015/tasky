import {
  useState, useRef, useEffect, useCallback,
  type KeyboardEvent,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/stores';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({ tags, onChange, placeholder = 'Add tags…', className }: TagInputProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Collect every unique tag used across all tasks
  const { tasks } = useTaskStore();
  const allTags = Array.from(
    new Set(Array.from(tasks.values()).flatMap((t) => t.tags))
  ).sort();

  const query = input.trim().toLowerCase();
  const suggestions = allTags.filter(
    (t) => t.includes(query) && !tags.includes(t)
  );
  // Also offer the raw input as a new tag if it doesn't match any suggestion exactly
  const showCreate = query.length > 0 && !allTags.includes(query) && !tags.includes(query);
  const options: string[] = showCreate ? [query, ...suggestions] : suggestions;

  const shouldOpen = open && (options.length > 0);

  useEffect(() => { setHighlighted(0); }, [input]);

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const addTag = useCallback((tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/,/g, '');
    if (!clean || tags.includes(clean)) return;
    onChange([...tags, clean]);
    setInput('');
    setOpen(false);
    inputRef.current?.focus();
  }, [tags, onChange]);

  const removeTag = useCallback((tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  }, [tags, onChange]);

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, options.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
      return;
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && shouldOpen) {
      e.preventDefault();
      addTag(options[highlighted] ?? input);
      return;
    }
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addTag(input);
      return;
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-[32px] px-2 py-1 rounded-md border border-border bg-transparent focus-within:ring-1 focus-within:ring-ring cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="rounded-full hover:bg-primary/20 transition-colors"
              tabIndex={-1}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {shouldOpen && (
        <ul className="absolute z-50 top-full mt-1 left-0 right-0 rounded-md border border-border bg-popover shadow-md overflow-hidden max-h-48 overflow-y-auto">
          {options.map((opt, i) => {
            const isNew = showCreate && i === 0 && opt === query;
            return (
              <li key={opt}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); addTag(opt); }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors',
                    highlighted === i ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/50'
                  )}
                >
                  {isNew ? (
                    <>
                      <span className="text-xs text-muted-foreground font-medium">Create</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{opt}</span>
                    </>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-xs">{opt}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
