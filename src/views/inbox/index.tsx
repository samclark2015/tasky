import { useState } from 'react';
import { useTaskStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import { Inbox as InboxIcon, Plus } from 'lucide-react';
import { ViewHeader } from '@/components/layout/view-header';
import { TaskItem } from '@/components/task/task-item';
import { TaskModal } from '@/components/modals/task-modal';
import { QuickAdd } from '@/components/task/quick-add';
import { useIsMobile } from '@/hooks/use-is-mobile';

export function InboxView() {
  const { tasks, createTask } = useTaskStore();
  const { adapter } = useApp();
  const isMobile = useIsMobile();
  const [showModal, setShowModal] = useState(false);

  const inboxTasks = Array.from(tasks.values()).filter(
    (t) => !t.listId && !t.completed && t.parentId === null
  );
  const completedInbox = Array.from(tasks.values()).filter(
    (t) => !t.listId && t.completed && t.parentId === null
  );

  function handleQuickAdd(title: string) {
    if (!adapter) return;
    createTask(adapter, { title });
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <ViewHeader actions={
          <>
            <span className="text-sm text-muted-foreground">{inboxTasks.length} tasks</span>
            {!isMobile && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            )}
          </>
        }>
          <h1 className="text-lg font-semibold">Inbox</h1>
        </ViewHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="px-2 pt-2">
            {inboxTasks.map((t) => <TaskItem key={t.id} task={t} />)}
          </div>

          <QuickAdd onAdd={handleQuickAdd} placeholder="Add task to Inbox…" />

          {inboxTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <InboxIcon className="h-10 w-10 opacity-30" />
              <p className="text-sm">Inbox is empty</p>
            </div>
          )}

          {completedInbox.length > 0 && (
            <section className="mt-4">
              <div className="px-4 pb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Completed ({completedInbox.length})
                </p>
              </div>
              <div className="px-2 opacity-60">
                {completedInbox.map((t) => <TaskItem key={t.id} task={t} />)}
              </div>
            </section>
          )}
        </div>
      </div>

      {showModal && <TaskModal onClose={() => setShowModal(false)} />}
    </>
  );
}
