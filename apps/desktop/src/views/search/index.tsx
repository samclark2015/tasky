import { useRef, useEffect } from 'react';
import { useTaskStore, useListStore, useUIStore } from '@/stores';
import { Search as SearchIcon, X } from 'lucide-react';
import { TaskItem } from '@/components/task/task-item';

export function SearchView() {
  const { tasks } = useTaskStore();
  const { lists } = useListStore();
  const { searchQuery, setSearchQuery } = useUIStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = searchQuery.toLowerCase().trim();
  const results = q
    ? Array.from(tasks.values()).filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    : [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <SearchIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pt-2">
        {q && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <SearchIcon className="h-10 w-10 opacity-30" />
            <p className="text-sm">No results for "{searchQuery}"</p>
          </div>
        )}

        {results.map((task) => {
          const list = lists.find((l) => l.id === task.listId);
          return (
            <TaskItem
              key={task.id}
              task={task}
              showList
              listColor={list?.color ?? null}
            />
          );
        })}

        {!q && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <SearchIcon className="h-10 w-10 opacity-30" />
            <p className="text-sm">Type to search</p>
          </div>
        )}
      </div>
    </div>
  );
}
