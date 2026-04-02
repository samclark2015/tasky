import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

interface RemoteEvent {
  href: string;
  etag: string;
  vevent: {
    uid: string;
    summary: string;
    description: string | null;
    dtstart: string | null;
    dtend: string | null;
    location: string | null;
    color: string | null;
  };
}

interface FetchEventsResult {
  events: RemoteEvent[];
  error: string | null;
}

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

      async fetchEvents(
        serverUrl: string,
        username: string,
        password: string,
        calendarHref: string,
        rangeStart: string,
        rangeEnd: string
      ) {
        set({ loading: true, error: null });
        try {
          const result = await invoke<FetchEventsResult>('caldav_fetch_events', {
            serverUrl,
            username,
            password,
            calendarHref,
            rangeStart,
            rangeEnd,
          });

          if (result.error) {
            set({ error: result.error, loading: false });
            return;
          }

          const eventMap = new Map<string, CalendarEvent>();
          for (const remoteEvent of result.events) {
            const key = `${calendarHref}:${remoteEvent.vevent.uid}`;
            eventMap.set(key, {
              uid: remoteEvent.vevent.uid,
              calendarHref,
              summary: remoteEvent.vevent.summary,
              description: remoteEvent.vevent.description,
              dtstart: remoteEvent.vevent.dtstart,
              dtend: remoteEvent.vevent.dtend,
              location: remoteEvent.vevent.location,
              color: remoteEvent.vevent.color,
            });
          }

          set((state) => {
            const newEvents = new Map(state.events);
            for (const [key] of newEvents) {
              if (key.startsWith(`${calendarHref}:`)) {
                newEvents.delete(key);
              }
            }
            for (const [key, event] of eventMap) {
              newEvents.set(key, event);
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

      toggleCalendarVisibility(calendarHref: string) {
        set((state) => ({
          calendarVisibility: {
            ...state.calendarVisibility,
            [calendarHref]: !(state.calendarVisibility[calendarHref] ?? true),
          },
        }));
      },

      isCalendarVisible(calendarHref: string) {
        const vis = get().calendarVisibility;
        return vis[calendarHref] ?? true;
      },
    }),
    {
      name: 'tasky-calendar-visibility',
      partialize: (state) => ({ calendarVisibility: state.calendarVisibility }),
    }
  )
);
