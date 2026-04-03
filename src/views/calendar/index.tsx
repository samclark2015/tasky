import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { type EventResizeDoneArg, type DateClickArg } from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg, EventInput, EventMountArg, DatesSetArg, DateSelectArg } from '@fullcalendar/core';
import { useTaskStore, useListStore, useUIStore, useEventStore, useSyncStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import { ViewHeader } from '@/components/layout/view-header';
import { Plus, Eye, EyeOff } from 'lucide-react';
import { TaskModal } from '@/components/modals/task-modal';
import { TaskContextMenu } from '@/components/task/task-context-menu';
import { EventDetailPopover } from './event-detail-popover';
import type { Task, CalendarEvent } from '@/types/types';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'hsl(0 84.2% 60.2%)',
  medium: 'hsl(48 96% 53%)',
  low: 'hsl(215.4 16.3% 46.9%)',
};

export function CalendarView() {
  const { tasks, updateTask } = useTaskStore();
  const { lists } = useListStore();
  const { selectTask } = useUIStore();
  const { events: calendarEvents, fetchEvents, calendarVisibility, toggleCalendarVisibility } = useEventStore();
  const { accounts, maps } = useSyncStore();
  const calendarMaps = maps.filter((m) => {
    const account = accounts.find((a) => a.id === m.accountId);
    return account?.providerType === 'caldav';
  });
  const { adapter } = useApp();
  const calendarRef = useRef<FullCalendar>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskDefaults, setNewTaskDefaults] = useState<{ 
    title?: string;
    description?: string;
    dueDate?: string; 
    timeEstimate?: number; 
    sourceEventUid?: string;
  }>({});
  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [eventPopover, setEventPopover] = useState<{ event: CalendarEvent; x: number; y: number } | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [showCalendarToggles, setShowCalendarToggles] = useState(false);

  const listColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lists) {
      if (l.color) map.set(l.id, l.color);
    }
    return map;
  }, [lists]);

  // Build a label map: sourceId → display name (list name or sourceId basename)
  const calendarLabelMap = useMemo(() => {
    const map = new Map<string, { label: string; color: string | null }>();
    for (const cm of calendarMaps) {
      const list = lists.find((l) => l.id === cm.listId);
      map.set(cm.sourceId, {
        label: list?.name ?? cm.sourceId.split('/').filter(Boolean).pop() ?? cm.sourceId,
        color: list?.color ?? null,
      });
    }
    return map;
  }, [calendarMaps, lists]);

  // The set of calendarHrefs that actually have fetched events (used to show toggle items)
  const activeCalendarHrefs = useMemo(() => {
    const hrefs = new Set<string>();
    for (const event of calendarEvents.values()) {
      hrefs.add(event.calendarHref);
    }
    // Also include mapped calendars even if they have no events in range
    for (const cm of calendarMaps) {
      const account = accounts.find((a) => a.id === cm.accountId);
      if (account?.syncEnabled) hrefs.add(cm.sourceId);
    }
    return hrefs;
  }, [calendarEvents, calendarMaps, accounts]);

  // Fetch calendar events when accounts/maps or date range changes
  useEffect(() => {
    if (!dateRange) return;
    
    for (const map of calendarMaps) {
      const account = accounts.find(a => a.id === map.accountId);
      if (!account || !account.syncEnabled) continue;
      const creds = account.credentials as Record<string, string>;
      
      fetchEvents(
        creds.server_url,
        creds.username,
        creds.password,
        map.sourceId,
        dateRange.start,
        dateRange.end
      );
    }
  }, [dateRange, accounts, calendarMaps, fetchEvents]);

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setDateRange({
      start: info.startStr,
      end: info.endStr,
    });
  }, []);

  const events: EventInput[] = useMemo(() => {
    const taskEvents: EventInput[] = Array.from(tasks.values())
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
          extendedProps: { task: t, type: 'task' },
        };
      });

    // Add calendar events, filtered by visibility
    const eventInputs: EventInput[] = Array.from(calendarEvents.values())
      .filter((e) => calendarVisibility[e.calendarHref] !== false)
      .map((e) => {
        const color = e.color ?? 'hsl(217.2 91.2% 59.8%)';
        return {
          id: `event-${e.uid}`,
          title: e.summary,
          start: e.dtstart ?? undefined,
          end: e.dtend ?? undefined,
          backgroundColor: color,
          borderColor: color,
          textColor: '#fff',
          editable: false,
          extendedProps: { event: e, type: 'event' },
        };
      });

    return [...taskEvents, ...eventInputs];
  }, [tasks, listColorMap, calendarEvents, calendarVisibility]);

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      const type = info.event.extendedProps.type;
      if (type === 'task') {
        selectTask(info.event.id);
      } else if (type === 'event') {
        const event = info.event.extendedProps.event as CalendarEvent;
        const rect = info.el.getBoundingClientRect();
        setEventPopover({ 
          event, 
          x: rect.left + rect.width / 2, 
          y: rect.bottom 
        });
      }
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

  const handleSelect = useCallback((info: DateSelectArg) => {
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

  const handleAddEventToTasks = useCallback((event: CalendarEvent) => {
    const dueDate = event.dtstart ?? new Date().toISOString();
    let timeEstimate: number | undefined;
    
    if (event.dtstart && event.dtend) {
      const start = new Date(event.dtstart);
      const end = new Date(event.dtend);
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
      timeEstimate = durationMinutes > 0 ? durationMinutes : undefined;
    }

    setNewTaskDefaults({
      title: event.summary,
      description: event.description ?? '',
      dueDate,
      timeEstimate,
      sourceEventUid: event.uid,
    });
    setShowNewTask(true);
  }, []);

  return (
    <>
      <div className="flex flex-col h-full">
        <ViewHeader
          actions={
            <div className="flex items-center gap-2">
              {activeCalendarHrefs.size > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowCalendarToggles((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent transition-colors"
                    title="Toggle calendar visibility"
                  >
                    <Eye className="h-4 w-4" />
                    Calendars
                  </button>
                  {showCalendarToggles && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowCalendarToggles(false)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-20 min-w-[200px] rounded-md border border-border bg-popover shadow-md py-1">
                        {Array.from(activeCalendarHrefs).map((href) => {
                          const info = calendarLabelMap.get(href);
                          const label = info?.label ?? href.split('/').filter(Boolean).pop() ?? href;
                          const color = info?.color ?? 'hsl(217.2 91.2% 59.8%)';
                          const visible = calendarVisibility[href] !== false;
                          return (
                            <button
                              key={href}
                              onClick={() => toggleCalendarVisibility(href)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                            >
                              <span
                                className="flex-shrink-0 w-3 h-3 rounded-sm"
                                style={{ backgroundColor: visible ? color : 'transparent', border: `2px solid ${color}` }}
                              />
                              <span className={visible ? '' : 'text-muted-foreground line-through'}>
                                {label}
                              </span>
                              {visible
                                ? <Eye className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                                : <EyeOff className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                              }
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
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
            </div>
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
            datesSet={handleDatesSet}
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

      {eventPopover && (
        <EventDetailPopover
          event={eventPopover.event}
          pos={{ x: eventPopover.x, y: eventPopover.y }}
          onClose={() => setEventPopover(null)}
          onAddToTasks={handleAddEventToTasks}
        />
      )}
    </>
  );
}
