import { useMemo, useState } from 'react';
import { useTaskStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import { ViewHeader } from '@/components/layout/view-header';
import { TaskModal } from '@/components/modals/task-modal';
import { TaskItem } from '@/components/task/task-item';
import { QuickAdd } from '@/components/task/quick-add';
import { cn } from '@/lib/utils';
import { Plus, Clock, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { format, startOfDay, addDays, isToday, isTomorrow, differenceInCalendarDays, isSameDay } from 'date-fns';
import type { Task } from '@/types/types';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { getOccurrencesBetween } from '@/lib/recurrence';

const DAYS_AHEAD = 14;

type VirtualTaskOccurrence = Task & { isVirtual: true };

function formatDayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  const diff = differenceInCalendarDays(date, new Date());
  if (diff < 7) return format(date, 'EEEE');
  return format(date, 'EEEE, MMM d');
}

function minutesToDisplay(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

interface DayBlockProps {
  date: Date;
  tasks: Task[];
  virtualOccurrences: VirtualTaskOccurrence[];
  totalEstimate: number;
}

function DayBlock({ date, tasks, virtualOccurrences, totalEstimate }: DayBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const label = formatDayLabel(date);
  const dateStr = format(date, 'MMM d');
  const isOverScheduled = totalEstimate > 8 * 60;

  return (
    <section className="border-b border-border last:border-0">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-accent/30 transition-colors text-left"
        onClick={() => setCollapsed((v) => !v)}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <span className={cn('font-semibold text-sm', isToday(date) && 'text-primary')}>
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{dateStr}</span>
        <div className="flex-1" />
        {tasks.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
        )}
        {totalEstimate > 0 && (
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 ml-2',
              isOverScheduled
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <Clock className="h-3 w-3" />
            {minutesToDisplay(totalEstimate)}
            {isOverScheduled && ' ⚠'}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="px-2 pb-2">
          {tasks.length === 0 && virtualOccurrences.length === 0 ? (
            <p className="px-4 py-2 text-xs text-muted-foreground italic">No tasks scheduled</p>
          ) : (
            <>
              {tasks.map((t) => <TaskItem key={t.id} task={t} />)}
              {virtualOccurrences.map((t) => (
                <div
                  key={t.id}
                  className="opacity-50 pointer-events-none select-none"
                  title="Recurring occurrence (virtual)"
                >
                  <TaskItem task={t} />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function PlannerView() {
  const { tasks, createTask } = useTaskStore();
  const { adapter } = useApp();
  const isMobile = useIsMobile();
  const [showNewTask, setShowNewTask] = useState(false);
  const [unscheduledCollapsed, setUnscheduledCollapsed] = useState(false);

  const today = startOfDay(new Date());

  const upcomingDays = useMemo(() => {
    return Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
  }, [today.toDateString()]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const day of upcomingDays) {
      map.set(format(day, 'yyyy-MM-dd'), []);
    }
    for (const task of tasks.values()) {
      if (!task.dueDate || task.parentId !== null) continue;
      const dayKey = task.dueDate.split('T')[0];
      if (map.has(dayKey)) {
        map.get(dayKey)!.push(task);
      }
    }
    return map;
  }, [tasks, upcomingDays]);

  // Virtual occurrences: projected future instances of recurring tasks
  const virtualByDay = useMemo(() => {
    const map = new Map<string, VirtualTaskOccurrence[]>();
    for (const day of upcomingDays) {
      map.set(format(day, 'yyyy-MM-dd'), []);
    }

    const windowEnd = upcomingDays[upcomingDays.length - 1];

    for (const task of tasks.values()) {
      if (!task.recurrence || !task.dueDate || task.completed || task.parentId !== null) continue;
      const anchorDate = new Date(task.dueDate);
      const occurrences = getOccurrencesBetween(task.recurrence, anchorDate, today, windowEnd);
      for (const date of occurrences) {
        // Skip the base task's own due date (already shown as a real task)
        if (isSameDay(date, anchorDate)) continue;
        const dayKey = format(date, 'yyyy-MM-dd');
        if (!map.has(dayKey)) continue;
        const dateStr = date.toISOString().split('T')[0];
        const virtualId = `${task.id}-virtual-${dateStr}`;
        map.get(dayKey)!.push({ ...task, id: virtualId, dueDate: dateStr, isVirtual: true });
      }
    }

    return map;
  }, [tasks, upcomingDays, today]);

  const unscheduledTasks = useMemo(() => {
    return Array.from(tasks.values()).filter(
      (t) => !t.dueDate && !t.completed && t.parentId === null
    );
  }, [tasks]);

  const estimateByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const [day, dayTasks] of tasksByDay.entries()) {
      const realTotal = dayTasks
        .filter((t) => !t.completed)
        .reduce((sum, t) => sum + (t.timeEstimate ?? 0), 0);
      const virtualTotal = (virtualByDay.get(day) ?? [])
        .reduce((sum, t) => sum + (t.timeEstimate ?? 0), 0);
      map.set(day, realTotal + virtualTotal);
    }
    return map;
  }, [tasksByDay, virtualByDay]);

  function handleQuickAdd(title: string) {
    if (!adapter) return;
    createTask(adapter, { title });
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <ViewHeader
          actions={
            !isMobile ? (
              <button
                onClick={() => setShowNewTask(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            ) : undefined
          }
        >
          <h1 className="text-lg font-semibold">Planner</h1>
        </ViewHeader>

        <div className="flex-1 overflow-y-auto">
          {upcomingDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            return (
              <DayBlock
                key={key}
                date={day}
                tasks={tasksByDay.get(key) ?? []}
                virtualOccurrences={virtualByDay.get(key) ?? []}
                totalEstimate={estimateByDay.get(key) ?? 0}
              />
            );
          })}

          <section className="border-t-2 border-border mt-2">
            <button
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-accent/30 transition-colors text-left"
              onClick={() => setUnscheduledCollapsed((v) => !v)}
            >
              {unscheduledCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Unscheduled</span>
              {unscheduledTasks.length > 0 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {unscheduledTasks.length} task{unscheduledTasks.length !== 1 ? 's' : ''}
                </span>
              )}
            </button>

            {!unscheduledCollapsed && (
              <div className="px-2 pb-2">
                {unscheduledTasks.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-muted-foreground italic">
                    No unscheduled tasks
                  </p>
                ) : (
                  unscheduledTasks.map((t) => <TaskItem key={t.id} task={t} />)
                )}
                <QuickAdd onAdd={handleQuickAdd} placeholder="Add unscheduled task…" />
              </div>
            )}
          </section>
        </div>
      </div>

      {showNewTask && <TaskModal onClose={() => setShowNewTask(false)} />}
    </>
  );
}
