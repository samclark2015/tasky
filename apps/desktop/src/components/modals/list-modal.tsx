import { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { TaskList } from '@core/types';
import { useListStore, useTaskStore, useUIStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import { cn } from '@/lib/utils';
import { X, Trash2 } from 'lucide-react';

interface ListModalProps {
  list?: TaskList | null;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#6366f1', '#ec4899', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#8b5cf6', '#ef4444',
  '#64748b', '#0ea5e9', '#84cc16', '#f43f5e',
];

export function ListModal({ list, onClose }: ListModalProps) {
  const { createList, updateList, deleteList } = useListStore();
  const { tasks, deleteTask } = useTaskStore();
  const { navigateTo, currentView, currentListId } = useUIStore();
  const { adapter } = useApp();

  const [name, setName] = useState(list?.name ?? '');
  const [color, setColor] = useState(list?.color ?? PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    if (!name.trim() || !adapter) return;
    setSaving(true);
    try {
      if (list) {
        await updateList(adapter, list.id, { name: name.trim(), color });
      } else {
        await createList(adapter, name.trim(), color);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!adapter || !list) return;
    const listTasks = Array.from(tasks.values()).filter((t) => t.listId === list.id);
    for (const task of listTasks) {
      await deleteTask(adapter, task.id);
    }
    await deleteList(adapter, list.id);
    if (currentView === 'list' && currentListId === list.id) {
      navigateTo('inbox');
    }
    onClose();
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
          onOpenAutoFocus={(e) => { e.preventDefault(); nameRef.current?.focus(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(); }}
        >
          <Dialog.Title className="sr-only">{list ? 'Edit List' : 'New List'}</Dialog.Title>
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
              <span className="font-semibold text-sm">{list ? 'Edit List' : 'New List'}</span>
              <Dialog.Close asChild>
                <button className="p-1 rounded hover:bg-accent text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

        <div className="px-5 py-4 space-y-4">
          {/* name */}
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="List name"
            className="w-full text-sm bg-transparent outline-none border-b border-border pb-2 placeholder:text-muted-foreground"
          />

          {/* color picker */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Color</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-6 w-6 rounded-full transition-all',
                    color === c ? 'ring-2 ring-offset-2 ring-primary ring-offset-background scale-110' : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          {list ? (
            confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive">Delete all tasks too?</span>
                <button
                  onClick={handleDelete}
                  className="text-xs text-destructive hover:underline"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete list
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : list ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
