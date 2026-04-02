import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { providerFetchEvents } from '@/providers/ipc';

export interface CalendarEvent {
  uid: string;
  calendarHref: string;
  summary: string;
  description: string | null;
  dtstart: string | null;
  dtend: string | null;
  location: string | null;
  color: string | null;
}

interface EventStore {
  events: Map<string, CalendarEvent>;
  calendarVisibility: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  fetchEvents: (
    serverUrl: string,
    username: string,
    password: string,
    calendarHref: string,
    rangeStart: string,
    rangeEnd: string
  ) => Promise<void>;
  clearEvents: () => void;
  toggleCalendarVisibility: (calendarHref: string) => void;
  isCalendarVisible: (calendarHref: string) => boolean;
}

export const useEventStore = create<EventStore>()(
  persist(
    (set, get) => ({
      events: new Map(),
      calendarVisibility: {},
      loading: false,
      error: null,

      async fetchEvents(serverUrl, username, password, calendarHref, rangeStart, rangeEnd) {
        set({ loading: true, error: null });
        try {
          const providerEvents = await providerFetchEvents(
            'caldav',
            { serverUrl, username, password },
            calendarHref,
            rangeStart,
            rangeEnd,
          );

          set((state) => {
            const newEvents = new Map(state.events);
            for (const [key] of newEvents) {
              if (key.startsWith(`${calendarHref}:`)) newEvents.delete(key);
            }
            for (const e of providerEvents) {
              newEvents.set(`${calendarHref}:${e.remoteId}`, {
                uid: e.remoteId,
                calendarHref,
                summary: e.title,
                description: e.description,
                dtstart: e.start,
                dtend: e.end,
                location: e.location,
                color: e.color,
              });
            }
            return { events: newEvents, loading: false };
          });
        } catch (e) {
          set({ error: String(e), loading: false });
        }
      },

      clearEvents() {
        set({ events: new Map() });
      },

      toggleCalendarVisibility(calendarHref) {
        set((state) => ({
          calendarVisibility: {
            ...state.calendarVisibility,
            [calendarHref]: !(state.calendarVisibility[calendarHref] ?? true),
          },
        }));
      },

      isCalendarVisible(calendarHref) {
        return get().calendarVisibility[calendarHref] ?? true;
      },
    }),
    {
      name: 'tasky-calendar-visibility',
      partialize: (state) => ({ calendarVisibility: state.calendarVisibility }),
    }
  )
);
