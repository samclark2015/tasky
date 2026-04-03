import { useRef, useEffect } from 'react';
import { useTaskStore, useListStore, useUIStore } from '@/stores';
import { Search as SearchIcon, X } from 'lucide-react';
import { TaskItem } from '@/components/task/task-item';
import { ModalSheet } from '@/components/layout/modal-sheet';

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
    <ModalSheet
      open={searchOpen}
      onClose={() => handleOpenChange(false)}
      title="Search tasks"
      desktopPosition="top"
    >
      {/* Search input row */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <SearchIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={searchQuery ? () => setSearchQuery('') : () => handleOpenChange(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2">
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
    </ModalSheet>
  );
}
