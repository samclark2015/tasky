import { create } from 'zustand';
import {
  appSyncSetup,
  appSyncDelete,
  appSyncTest,
  appSyncPush,
  appSyncPull,
  appSyncStatus,
  appSyncGenerateLinkCode,
  appSyncJoin,
  type AppSyncAccountConfig,
  type AppSyncStatus,
} from '@/providers/ipc';

// ── State shape ───────────────────────────────────────────────────────────────

interface AppSyncState {
  // Current status (mirrors Rust AppSyncStatusOutput)
  status: AppSyncStatus | null;
  // UI-level loading/error for the settings panel
  isLoading: boolean;
  error: string | null;

  // Actions
  loadStatus: () => Promise<void>;
  setup: (config: AppSyncAccountConfig, passphrase: string) => Promise<void>;
  remove: () => Promise<void>;
  testConnection: () => Promise<boolean>;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  generateLinkCode: () => Promise<string>;
  join: (linkCode: string, passphrase: string) => Promise<void>;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAppSyncStore = create<AppSyncState>((set, get) => ({
  status: null,
  isLoading: false,
  error: null,

  loadStatus: async () => {
    try {
      const status = await appSyncStatus();
      set({ status, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setup: async (config, passphrase) => {
    set({ isLoading: true, error: null });
    try {
      await appSyncSetup(config, passphrase);
      const status = await appSyncStatus();
      set({ status, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
      throw e;
    }
  },

  remove: async () => {
    set({ isLoading: true, error: null });
    try {
      await appSyncDelete();
      const status = await appSyncStatus();
      set({ status, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
      throw e;
    }
  },

  testConnection: async () => {
    set({ isLoading: true, error: null });
    try {
      const ok = await appSyncTest();
      set({ isLoading: false });
      return ok;
    } catch (e) {
      const msg = String(e);
      set({ isLoading: false, error: msg });
      throw new Error(msg);
    }
  },

  push: async () => {
    set({ isLoading: true, error: null });
    try {
      await appSyncPush();
      // Refresh status after push.
      await get().loadStatus();
      set({ isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
      throw e;
    }
  },

  pull: async () => {
    set({ isLoading: true, error: null });
    try {
      await appSyncPull();
      await get().loadStatus();
      set({ isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
      throw e;
    }
  },

  generateLinkCode: async () => {
    set({ isLoading: true, error: null });
    try {
      const code = await appSyncGenerateLinkCode();
      set({ isLoading: false });
      return code;
    } catch (e) {
      set({ isLoading: false, error: String(e) });
      throw e;
    }
  },

  join: async (linkCode, passphrase) => {
    set({ isLoading: true, error: null });
    try {
      await appSyncJoin(linkCode, passphrase);
      const status = await appSyncStatus();
      set({ status, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
      throw e;
    }
  },
}));
