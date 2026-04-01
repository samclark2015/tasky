import { useRef, useMemo, useCallback, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { type EventResizeDoneArg, type DateClickArg, type SelectArg } from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg, EventInput, EventMountArg } from '@fullcalendar/core';
import { useTaskStore, useListStore, useUIStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import { ViewHeader } from '@/components/layout/view-header';
import { Plus } from 'lucide-react';
import { TaskModal } from '@/components/modals/task-modal';
import { TaskContextMenu } from '@/components/task/task-context-menu';
import type { Task } from '@core/types';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'hsl(0 84.2% 60.2%)',
  medium: 'hsl(48 96% 53%)',
  low: 'hsl(215.4 16.3% 46.9%)',
};

export function CalendarView() {
  const { tasks, updateTask } = useTaskStore();
  const { lists } = useListStore();
  const { selectTask } = useUIStore();
  const { adapter } = useApp();
  const calendarRef = useRef<FullCalendar>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskDefaults, setNewTaskDefaults] = useState<{ dueDate?: string; timeEstimate?: number }>({});
  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);

  const listColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lists) {
      if (l.color) map.set(l.id, l.color);
    }
    return map;
  }, [lists]);

  const events: EventInput[] = useMemo(() => {
    return Array.from(tasks.values())
      .filter((t) => t.dueDate && t.parentId === null)
      .map((t) => {
        const listColor = t.listId ? listColorMap.get(t.listId) : undefined;
        const color = listColor ?? PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.medium;
        const start = t.dueDate!;
        const hasTime =
          start.includes('T') &&
          !start.endsWith('T00:00:00.000Z') &&
          !start.endsWith('T00:00:00Z') &&
          (() => { const d = new Date(start); return d.getHours() !== 0 || d.getMinutes() !== 0; })();
        const durationMs = t.timeEstimate ? t.timeEstimate * 60 * 1000 : null;

        return {
          id: t.id,
          title: t.title,
          start,
          end:
            hasTime && durationMs
              ? new Date(new Date(start).getTime() + durationMs).toISOString()
              : undefined,
          allDay: !hasTime,
          backgroundColor: t.completed ? 'hsl(215.4 16.3% 46.9%)' : color,
          borderColor: t.completed ? 'hsl(215.4 16.3% 46.9%)' : color,
          textColor: '#fff',
          classNames: t.completed ? ['fc-event-completed'] : [],
          extendedProps: { task: t },
        };
      });
  }, [tasks, listColorMap]);

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      selectTask(info.event.id);
    },
    [selectTask]
  );

  const handleEventDidMount = useCallback((info: EventMountArg) => {
    const task = info.event.extendedProps.task as Task;
    info.el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      setContextMenu({ task, x: e.clientX, y: e.clientY });
    });
  }, []);

  const handleDateClick = useCallback((info: DateClickArg) => {
    setNewTaskDefaults({ dueDate: info.dateStr.split('T')[0] });
    setShowNewTask(true);
  }, []);

  const handleSelect = useCallback((info: SelectArg) => {
    const { start, end, allDay } = info;
    const dueDate = allDay ? start.toISOString().split('T')[0] : start.toISOString();
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const timeEstimate = !allDay && durationMinutes > 0 ? durationMinutes : undefined;
    setNewTaskDefaults({ dueDate, timeEstimate });
    setShowNewTask(true);
    calendarRef.current?.getApi().unselect();
  }, []);

  const handleEventDrop = useCallback(
    (info: EventDropArg) => {
      if (!adapter) return;
      const newStart = info.event.start;
      if (!newStart) return;
      const dueDate = info.event.allDay
        ? newStart.toISOString().split('T')[0]
        : newStart.toISOString();
      updateTask(adapter, info.event.id, { dueDate });
    },
    [adapter, updateTask]
  );

  const handleEventResize = useCallback(
    (info: EventResizeDoneArg) => {
      if (!adapter) return;
      const start = info.event.start;
      const end = info.event.end;
      if (!start || !end) return;
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
      const dueDate = info.event.allDay
        ? start.toISOString().split('T')[0]
        : start.toISOString();
      updateTask(adapter, info.event.id, {
        dueDate,
        timeEstimate: durationMinutes,
      });
    },
    [adapter, updateTask]
  );

  return (
    <>
      <div className="flex flex-col h-full">
        <ViewHeader
          actions={
            <button
              onClick={() => {
                setNewTaskDefaults({});
                setShowNewTask(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          }
        >
          <h1 className="text-lg font-semibold">Calendar</h1>
        </ViewHeader>

        <div className="flex-1 overflow-hidden px-4 py-3 fc-wrapper">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            height="100%"
            events={events}
            editable={true}
            droppable={true}
            selectable={true}
            nowIndicator={true}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            select={handleSelect}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventDidMount={handleEventDidMount}
            eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
            slotMinTime="06:00:00"
            slotMaxTime="23:00:00"
          />
        </div>
      </div>

      {showNewTask && (
        <TaskModal
          defaults={newTaskDefaults}
          onClose={() => setShowNewTask(false)}
        />
      )}

      {contextMenu && (
        <TaskContextMenu
          task={contextMenu.task}
          pos={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
