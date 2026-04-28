import { useState, useRef } from 'react';
import type { TaskList, ProviderMap } from '@/types/types';
import { useListStore, useTaskStore, useUIStore, useSyncStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import { X, Trash2 } from 'lucide-react';
import { ModalSheet } from '@/components/layout/modal-sheet';
import { ColorPicker, PRESET_COLORS } from '@/components/ui/color-picker';
import { ConfirmDialog } from '@/components/modals/confirm-dialog';

interface ListModalProps {
  /** Existing list to edit. Absent = create mode. */
  list?: TaskList | null;
  /**
   * When present, this modal is managing a synced source (provider map).
   * If `list` is also present: editing a task-linked source — name + color edits update the list.
   * If `list` is absent: editing an events-only source — name edits update map.sourceName only.
   */
  providerMap?: ProviderMap | null;
  onClose: () => void;
}

export function ListModal({ list, providerMap, onClose }: ListModalProps) {
  const { createList, updateList, deleteList } = useListStore();
  const { tasks, deleteTask } = useTaskStore();
  const { navigateTo, currentView, currentListId } = useUIStore();
  const { unlinkSource, updateMap } = useSyncStore();
  const { adapter } = useApp();

  const isSyncedSource = Boolean(providerMap);
  const isEventsOnly = isSyncedSource && !list;

  // Name: from list or from map sourceName (events-only case)
  const [name, setName] = useState(list?.name ?? providerMap?.sourceName ?? '');
  const [color, setColor] = useState(list?.color ?? PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  const title = isSyncedSource
    ? (isEventsOnly ? 'Edit Source' : 'Edit Synced List')
    : (list ? 'Edit List' : 'New List');

  async function handleSave() {
    if (!name.trim() || !adapter) return;
    setSaving(true);
    try {
      if (isEventsOnly && providerMap) {
        // Events-only: update sourceName on the map
        await updateMap(adapter, providerMap.id, { sourceName: name.trim() });
      } else if (list) {
        // Task-linked synced list or plain local list
        await updateList(adapter, list.id, { name: name.trim(), color });
        if (providerMap) {
          // Also sync the display name on the map
          await updateMap(adapter, providerMap.id, { sourceName: name.trim() });
        }
      } else {
        // Create new local list
        await createList(adapter, name.trim(), color);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLocal() {
    if (!adapter) return;
    if (providerMap) {
      await unlinkSource(adapter, providerMap.id);
    }
    if (list) {
      const listTasks = Array.from(tasks.values()).filter((t) => t.listId === list.id);
      for (const task of listTasks) {
        await deleteTask(adapter, task.id);
      }
      await deleteList(adapter, list.id);
      if (currentView === 'list' && currentListId === list.id) {
        navigateTo('inbox');
      }
    }
    onClose();
  }

  async function handleKeepLocally() {
    if (!adapter || !providerMap) return;
    // Unlink source (deletes ProviderMap) but preserve the list & tasks
    await unlinkSource(adapter, providerMap.id);
    if (list) {
      // Nullify remoteUrl so the list is treated as fully local
      await updateList(adapter, list.id, { remoteUrl: null });
    }
    onClose();
  }

  // Determine delete dialog messaging
  const deleteTitle = isSyncedSource ? 'Remove Source' : 'Delete List';
  const deleteMessage = isEventsOnly
    ? `Remove "${name || providerMap?.sourceName || 'this source'}" from synced sources?`
    : isSyncedSource
      ? `Remove "${name || list?.name || 'this source'}" and delete all its tasks?`
      : `Delete "${list?.name}"? All tasks in this list will also be deleted.`;

  return (
    <>
      <ModalSheet
        open
        onClose={onClose}
        title={title}
        maxWidth="sm"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(); }}
        onOpenAutoFocus={(e) => { e.preventDefault(); nameRef.current?.focus(); }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
          <span className="font-semibold text-sm">{title}</span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">
          {/* name */}
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder={isEventsOnly ? 'Source name' : 'List name'}
            className="w-full text-sm bg-transparent outline-none border-b border-border pb-2 placeholder:text-muted-foreground"
          />

          {/* color picker — hidden for events-only sources */}
          {!isEventsOnly && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Color</p>
              <ColorPicker value={color} onChange={setColor} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border flex-shrink-0">
          {(list || isSyncedSource) ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isSyncedSource ? 'Remove source' : 'Delete list'}
            </button>
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
              {saving ? 'Saving…' : (list || isEventsOnly) ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </ModalSheet>

      {confirmingDelete && (
        <ConfirmDialog
          title={deleteTitle}
          message={deleteMessage}
          confirmLabel={isSyncedSource ? 'Remove & Delete' : 'Delete'}
          secondaryAction={
            // For task-linked synced sources, offer "keep locally"
            (isSyncedSource && !isEventsOnly)
              ? { label: 'Keep tasks locally', onClick: handleKeepLocally }
              : undefined
          }
          onConfirm={handleDeleteLocal}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}
