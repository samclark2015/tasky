import { useState } from 'react';
import { useTaskStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import { cn, isOverdue } from '@/lib/utils';
import { CheckCircle2, Plus } from 'lucide-react';
import { ViewHeader } from '@/components/layout/view-header';
import { TaskItem } from '@/components/task/task-item';
import { TaskModal } from '@/components/modals/task-modal';
import { QuickAdd } from '@/components/task/quick-add';

export function TodayView() {
  const { tasks, createTask } = useTaskStore();
  const { adapter } = useApp();
  const [showModal, setShowModal] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const todayTasks = Array.from(tasks.values()).filter(
    (t) => t.parentId === null && t.dueDate?.startsWith(today) && !t.completed
  );
  const overdueTasks = Array.from(tasks.values()).filter(
    (t) => t.parentId === null && !t.completed && isOverdue(t.dueDate) && !t.dueDate?.startsWith(today)
  );
  const completedToday = Array.from(tasks.values()).filter(
    (t) => t.parentId === null && t.completed && t.completedAt?.startsWith(today)
  );

  function handleQuickAdd(title: string) {
    if (!adapter) return;
    createTask(adapter, { title, dueDate: new Date().toISOString() });
  }

  const now = new Date();

  return (
    <>
      <div className="flex flex-col h-full">
        <ViewHeader actions={
          <>
            <span className="text-sm text-muted-foreground">
              {todayTasks.length + overdueTasks.length} remaining
            </span>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </>
        }>
          <div>
            <h1 className="text-lg font-semibold">Today</h1>
            <p className="text-xs text-muted-foreground">
              {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </ViewHeader>

        <div className="flex-1 overflow-y-auto">
          {overdueTasks.length > 0 && (
            <section>
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Overdue</p>
              </div>
              <div className="px-2">
                {overdueTasks.map((t) => <TaskItem key={t.id} task={t} />)}
              </div>
            </section>
          )}

          <section>
            {overdueTasks.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today</p>
              </div>
            )}
            <div className="px-2">
              {todayTasks.map((t) => <TaskItem key={t.id} task={t} />)}
            </div>
          </section>

          <QuickAdd onAdd={handleQuickAdd} placeholder="Add task for today…" />

          {todayTasks.length === 0 && overdueTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <CheckCircle2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">All clear for today</p>
            </div>
          )}

          {completedToday.length > 0 && (
            <section className="mt-4">
              <div className="px-4 pb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Completed ({completedToday.length})
                </p>
              </div>
              <div className={cn('px-2 opacity-60')}>
                {completedToday.map((t) => <TaskItem key={t.id} task={t} />)}
              </div>
            </section>
          )}
        </div>
      </div>

      {showModal && (
        <TaskModal
          defaults={{ dueDate: today }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
