import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTaskStore, useListStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import { cn } from '@/lib/utils';
import {
  Flag, Tag, List, CalendarOff, Trash2, ChevronRight, X, Check,
} from 'lucide-react';
import type { Task } from '@/types/types';

interface Pos { x: number; y: number }

interface TaskContextMenuProps {
  task: Task;
  pos: Pos;
  onClose: () => void;
}

const PRIORITY_LABELS: { value: Task['priority']; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function ConfirmDelete({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="px-3 py-2 border-t border-border">
      <p className="text-xs text-muted-foreground mb-2">Delete this task?</p>
      <div className="flex gap-1.5">
        <button
          onClick={onConfirm}
          className="flex-1 px-2 py-1 rounded text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          Delete
        </button>
        <button
          onClick={onCancel}
          className="flex-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function TaskContextMenu({ task, pos, onClose }: TaskContextMenuProps) {
  const { updateTask, deleteTask } = useTaskStore();
  const { lists } = useListStore();
  const { adapter } = useApp();
  const menuRef = useRef<HTMLDivElement>(null);

  const [submenu, setSubmenu] = useState<'priority' | 'tags' | 'list' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const allTags = Array.from(
    new Set(Array.from(useTaskStore.getState().tasks.values()).flatMap((t) => t.tags))
  ).sort();

  const menuPos = useAdjustedPos(pos, menuRef);

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  function save(updates: Partial<Task>) {
    if (!adapter) return;
    updateTask(adapter, task.id, updates);
  }

  const handleDelete = useCallback(async () => {
    if (!adapter) return;
    await deleteTask(adapter, task.id);
    onClose();
  }, [adapter, deleteTask, task.id, onClose]);

  function toggleTag(tag: string) {
    const next = task.tags.includes(tag)
      ? task.tags.filter((t) => t !== tag)
      : [...task.tags, tag];
    save({ tags: next });
  }

  function addNewTag() {
    const clean = tagInput.trim().toLowerCase();
    if (!clean || task.tags.includes(clean)) { setTagInput(''); return; }
    save({ tags: [...task.tags, clean] });
    setTagInput('');
  }

  const tagSuggestions = allTags.filter(
    (t) => !task.tags.includes(t) && (tagInput === '' || t.includes(tagInput.toLowerCase()))
  );

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', left: menuPos.x, top: menuPos.y, zIndex: 9999 }}
      className="w-52 rounded-lg border border-border bg-popover shadow-xl overflow-hidden text-sm select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Priority */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent transition-colors',
          submenu === 'priority' && 'bg-accent'
        )}
        onMouseEnter={() => { setSubmenu('priority'); setConfirmDelete(false); }}
      >
        <Flag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="flex-1">Priority</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {submenu === 'priority' && (
        <div className="border-t border-border bg-popover">
          {PRIORITY_LABELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { save({ priority: value }); onClose(); }}
              className="w-full flex items-center gap-2 px-5 py-1.5 hover:bg-accent transition-colors text-left"
            >
              <span className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                value === 'high' && 'bg-destructive',
                value === 'medium' && 'bg-yellow-500',
                value === 'low' && 'bg-muted-foreground',
              )} />
              <span className="flex-1">{label}</span>
              {task.priority === value && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}

      {/* Tags */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent transition-colors',
          submenu === 'tags' && 'bg-accent'
        )}
        onMouseEnter={() => { setSubmenu('tags'); setConfirmDelete(false); }}
      >
        <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="flex-1">Tags</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {submenu === 'tags' && (
        <div className="border-t border-border bg-popover">
          {task.tags.length > 0 && (
            <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs cursor-pointer hover:bg-primary/20"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                  <X className="h-2.5 w-2.5" />
                </span>
              ))}
            </div>
          )}
          <div className="px-3 pb-1">
            <input
              autoFocus
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addNewTag(); }
                if (e.key === 'Escape') { e.stopPropagation(); setTagInput(''); }
              }}
              placeholder="Add tag…"
              className="w-full text-xs bg-input/30 border border-border rounded px-2 py-1 outline-none placeholder:text-muted-foreground"
            />
          </div>
          {tagSuggestions.slice(0, 5).map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className="w-full flex items-center gap-2 px-5 py-1.5 hover:bg-accent transition-colors text-left text-xs"
            >
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-xs">{tag}</span>
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent transition-colors',
          submenu === 'list' && 'bg-accent'
        )}
        onMouseEnter={() => { setSubmenu('list'); setConfirmDelete(false); }}
      >
        <List className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="flex-1">Move to list</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {submenu === 'list' && (
        <div className="border-t border-border bg-popover">
          <button
            onClick={() => { save({ listId: null }); onClose(); }}
            className="w-full flex items-center gap-2 px-5 py-1.5 hover:bg-accent transition-colors text-left"
          >
            <span className="flex-1 text-muted-foreground italic">Inbox</span>
            {!task.listId && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => { save({ listId: l.id }); onClose(); }}
              className="w-full flex items-center gap-2 px-5 py-1.5 hover:bg-accent transition-colors text-left"
            >
              {l.color && (
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
              )}
              <span className="flex-1">{l.name}</span>
              {task.listId === l.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border" />

      {/* Unschedule */}
      <button
        onClick={() => { save({ dueDate: null }); onClose(); }}
        disabled={!task.dueDate}
        onMouseEnter={() => { setSubmenu(null); setConfirmDelete(false); }}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <CalendarOff className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span>Unschedule</span>
      </button>

      {/* Delete */}
      <button
        onClick={() => { setSubmenu(null); setConfirmDelete((v) => !v); }}
        onMouseEnter={() => setSubmenu(null)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-destructive/10 text-destructive transition-colors text-left"
      >
        <Trash2 className="h-3.5 w-3.5 flex-shrink-0" />
        <span>Delete…</span>
      </button>

      {confirmDelete && (
        <ConfirmDelete onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />
      )}
    </div>,
    document.body
  );
}

function useAdjustedPos(pos: Pos, ref: React.RefObject<HTMLDivElement | null>): Pos {
  const [adjusted, setAdjusted] = useState(pos);

  useEffect(() => {
    setAdjusted(pos);
  }, [pos.x, pos.y]);

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { x, y } = pos;
    if (x + rect.width > vw) x = vw - rect.width - 8;
    if (y + rect.height > vh) y = vh - rect.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    setAdjusted({ x, y });
  }, [pos, ref]);

  return adjusted;
}
