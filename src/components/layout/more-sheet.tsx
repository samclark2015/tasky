import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Settings } from 'lucide-react';
import { useUIStore, useListStore } from '@/stores';
import { ListModal } from '@/components/modals/list-modal';

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
      {createPortal(
        <AnimatePresence>
          {moreSheetOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 bg-black z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onPointerDown={close}
              />

              {/* Sheet */}
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl flex flex-col max-h-[80vh]"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0, bottom: 0.3 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 100) close();
                }}
              >
                {/* Drag handle */}
                <div className="flex-shrink-0 flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>

                {/* Content */}
                <div
                  className="flex-1 overflow-y-auto overscroll-contain pb-4"
                  onPointerDown={(e) => e.stopPropagation()}
                >
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

                {/* Safe area bottom padding */}
                <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {showNewList && <ListModal onClose={() => setShowNewList(false)} />}
    </>
  );
}
