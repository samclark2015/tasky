import { useRef, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTaskStore, useListStore, useUIStore } from '@/stores';
import { Search as SearchIcon, X } from 'lucide-react';
import { TaskItem } from '@/components/task/task-item';

export function SearchModal() {
  const { searchOpen, setSearchOpen, searchQuery, setSearchQuery, selectedTaskId } = useUIStore();
  const { tasks } = useTaskStore();
  const { lists } = useListStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const prevSelectedRef = useRef(selectedTaskId);

  // Focus input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [searchOpen]);

  // Close modal when user selects a task
  useEffect(() => {
    if (searchOpen && selectedTaskId !== prevSelectedRef.current && selectedTaskId !== null) {
      setSearchOpen(false);
    }
    prevSelectedRef.current = selectedTaskId;
  }, [selectedTaskId, searchOpen, setSearchOpen]);

  // Clear query when closing
  function handleOpenChange(open: boolean) {
    if (!open) setSearchQuery('');
    setSearchOpen(open);
  }

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
    <Dialog.Root open={searchOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-background shadow-xl outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Search tasks</Dialog.Title>

          {/* Search input row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <SearchIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <Dialog.Close asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto px-2 py-2">
            {q && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <SearchIcon className="h-8 w-8 opacity-30" />
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
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <SearchIcon className="h-8 w-8 opacity-30" />
                <p className="text-sm">Type to search</p>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
