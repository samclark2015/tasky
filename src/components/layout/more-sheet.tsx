import { useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import { useUIStore, useListStore } from '@/stores';
import { ListModal } from '@/components/modals/list-modal';
import { BottomSheet } from './bottom-sheet';

export function MoreSheet() {
  const { moreSheetOpen, setMoreSheetOpen, navigateTo } = useUIStore();
  const { lists } = useListStore();
  const [showNewList, setShowNewList] = useState(false);

  function close() {
    setMoreSheetOpen(false);
  }

  function goToList(id: string) {
    navigateTo('list', id);
    close();
  }

  function goToSettings() {
    navigateTo('settings');
    close();
  }

  return (
    <>
      <BottomSheet open={moreSheetOpen} onClose={close} height="max-h-[80vh]">
        <div className="flex-1 overflow-y-auto overscroll-contain pb-4">
          {/* Lists section */}
          {lists.length > 0 && (
            <div className="px-4 pb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-2">
                My Lists
              </p>
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => goToList(list.id)}
                  className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-accent/50 transition-colors text-left"
                >
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: list.color ?? '#6366f1' }}
                  />
                  <span className="text-sm font-medium">{list.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border mx-4 my-1" />

          {/* New List */}
          <div className="px-4">
            <button
              onClick={() => { close(); setShowNewList(true); }}
              className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-accent/50 transition-colors text-left"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">New List</span>
            </button>

            {/* Settings */}
            <button
              onClick={goToSettings}
              className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-accent/50 transition-colors text-left"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Settings</span>
            </button>
          </div>
        </div>
      </BottomSheet>

      {showNewList && <ListModal onClose={() => setShowNewList(false)} />}
    </>
  );
}
