import { useState } from 'react';
import { useTaskStore, useListStore, useUIStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import { Plus, MoreHorizontal } from 'lucide-react';
import { ViewHeader } from '@/components/layout/view-header';
import { TaskItem } from '@/components/task/task-item';
import { TaskModal } from '@/components/modals/task-modal';
import { ListModal } from '@/components/modals/list-modal';
import { QuickAdd } from '@/components/task/quick-add';

export function ListView() {
  const { tasks, createTask } = useTaskStore();
  const { lists } = useListStore();
  const { currentListId } = useUIStore();
  const { adapter } = useApp();
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);

  const list = lists.find((l) => l.id === currentListId);

  const activeTasks = Array.from(tasks.values()).filter(
    (t) => t.listId === currentListId && !t.completed && t.parentId === null
  );
  const completedTasks = Array.from(tasks.values()).filter(
    (t) => t.listId === currentListId && t.completed && t.parentId === null
  );

  function handleQuickAdd(title: string) {
    if (!adapter || !currentListId) return;
    createTask(adapter, { title, listId: currentListId });
  }

  if (!list) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">List not found</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <ViewHeader actions={
          <>
            <span className="text-sm text-muted-foreground">{activeTasks.length} tasks</span>
            <button
              onClick={() => setShowListModal(true)}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground transition-colors"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </>
        }>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: list.color ?? '#6366f1' }}
            />
            <h1 className="text-lg font-semibold truncate">{list.name}</h1>
          </div>
        </ViewHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="px-2 pt-2">
            {activeTasks.map((t) => <TaskItem key={t.id} task={t} />)}
          </div>

          <QuickAdd onAdd={handleQuickAdd} placeholder={`Add task to ${list.name}…`} />

          {activeTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <div
                className="h-10 w-10 rounded-full opacity-20"
                style={{ backgroundColor: list.color ?? '#6366f1' }}
              />
              <p className="text-sm">No tasks in {list.name}</p>
            </div>
          )}

          {completedTasks.length > 0 && (
            <section className="mt-4">
              <div className="px-4 pb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Completed ({completedTasks.length})
                </p>
              </div>
              <div className="px-2 opacity-60">
                {completedTasks.map((t) => <TaskItem key={t.id} task={t} />)}
              </div>
            </section>
          )}
        </div>
      </div>

      {showTaskModal && (
        <TaskModal defaults={{ listId: currentListId ?? undefined }} onClose={() => setShowTaskModal(false)} />
      )}
      {showListModal && (
        <ListModal list={list} onClose={() => setShowListModal(false)} />
      )}
    </>
  );
}
