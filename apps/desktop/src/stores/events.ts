import { create } from 'zustand';
import type { CalendarEvent } from '@core/types';
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

interface EventStore {
  events: Map<string, CalendarEvent>;
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
}

export const useEventStore = create<EventStore>((set) => ({
  events: new Map(),
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
        // Clear old events for this calendar
        for (const [key] of newEvents) {
          if (key.startsWith(`${calendarHref}:`)) {
            newEvents.delete(key);
          }
        }
        // Add new events
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
}));
