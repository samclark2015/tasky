// Generic IPC bridge between the TS app and Rust provider implementations.
//
// All provider logic lives in Rust. This file contains one function per
// operation, each of which calls a provider-agnostic Rust command, passing
// the provider id and an opaque config object as arguments.
//
// Adding a new provider requires only a Rust implementation — no new TS
// code is needed here.

import { invoke } from '@tauri-apps/api/core';
import type {
  EventPushInput,
  ProviderCalendar,
  ProviderEvent,
  ProviderFieldDef,
  ProviderMapFieldDef,
  ProviderMetadata,
  ProviderTask,
  PushResult,
  SyncOutput,
  TaskDeleteInput,
  TaskPushInput,
} from './types';

// ── Wire types (Rust uses snake_case) ────────────────────────────────────────

interface WireProviderCalendar {
  id: string;
  display_name: string | null;
  color: string | null;
  supports_sync: boolean;
}

interface WireProviderEvent {
  remote_id: string;
  calendar_id: string;
  title: string;
  description: string | null;
  start: string | null;
  end: string | null;
  location: string | null;
  color: string | null;
  etag: string;
  href: string;
}

interface WireProviderTask {
  remote_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: number | null;
  tags: string[];
  completed: boolean;
  completed_at: string | null;
  rrule: string | null;
  parent_remote_id: string | null;
  notes: string | null;
  time_estimate: number | null;
  source_event_uid: string | null;
  etag: string;
  href: string;
}

interface WirePushResult {
  local_id: string;
  remote_id: string;
  etag: string;
  href: string;
}

interface WireSyncOutput {
  pushed: WirePushResult[];
  push_errors: string[];
  delete_errors: string[];
  remote_tasks: WireProviderTask[];
  fetch_error: string | null;
  event_pushed: WirePushResult[];
  event_push_errors: string[];
  remote_events: WireProviderEvent[];
}

// ── Deserialisers ─────────────────────────────────────────────────────────────

function fromWireCalendar(w: WireProviderCalendar): ProviderCalendar {
  return { id: w.id, displayName: w.display_name, color: w.color, supportsSync: w.supports_sync };
}

function fromWireEvent(w: WireProviderEvent): ProviderEvent {
  return {
    remoteId: w.remote_id,
    calendarId: w.calendar_id,
    title: w.title,
    description: w.description,
    start: w.start,
    end: w.end,
    location: w.location,
    color: w.color,
    etag: w.etag,
    href: w.href,
  };
}

function fromWireTask(w: WireProviderTask): ProviderTask {
  return {
    remoteId: w.remote_id,
    title: w.title,
    description: w.description,
    dueDate: w.due_date,
    priority: w.priority,
    tags: w.tags,
    completed: w.completed,
    completedAt: w.completed_at,
    rrule: w.rrule,
    parentRemoteId: w.parent_remote_id,
    notes: w.notes,
    timeEstimate: w.time_estimate,
    sourceEventUid: w.source_event_uid,
    etag: w.etag,
    href: w.href,
  };
}

function fromWireSyncOutput(w: WireSyncOutput): SyncOutput {
  return {
    pushed: w.pushed.map((p): PushResult => ({
      localId: p.local_id,
      remoteId: p.remote_id,
      etag: p.etag,
      href: p.href,
    })),
    pushErrors: w.push_errors,
    deleteErrors: w.delete_errors,
    remoteTasks: w.remote_tasks.map(fromWireTask),
    fetchError: w.fetch_error,
    eventPushed: w.event_pushed.map((p): PushResult => ({
      localId: p.local_id,
      remoteId: p.remote_id,
      etag: p.etag,
      href: p.href,
    })),
    eventPushErrors: w.event_push_errors,
    remoteEvents: w.remote_events.map(fromWireEvent),
  };
}

// ── Serialisers ───────────────────────────────────────────────────────────────

function toWirePushInput(t: TaskPushInput) {
  return {
    local_id: t.localId,
    remote_id: t.remoteId,
    title: t.title,
    description: t.description,
    due_date: t.dueDate,
    priority: t.priority,
    tags: t.tags,
    rrule: t.rrule,
    completed: t.completed,
    completed_at: t.completedAt,
    notes: t.notes,
    time_estimate: t.timeEstimate,
    etag: t.etag,
    href: t.href,
    parent_remote_id: t.parentRemoteId,
    source_event_uid: t.sourceEventUid,
  };
}

function toWireEventPushInput(e: EventPushInput) {
  return {
    local_id: e.localId,
    event_uid: e.eventUid,
    title: e.title,
    description: e.description,
    dtstart: e.dtstart,
    dtend: e.dtend,
    tags: e.tags,
    notes: e.notes,
    time_estimate: e.timeEstimate,
    completed: e.completed,
    priority: e.priority,
    etag: e.etag,
  };
}

// ── Generic IPC operations ────────────────────────────────────────────────────

export async function providerTestConnection(
  providerId: string,
  config: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await invoke<{ ok: boolean; principal: string | null; error: string | null }>(
      'test_connection',
      { provider: providerId, config },
    );
    return { ok: result.ok, error: result.error ?? undefined };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function providerDiscoverCalendars(
  providerId: string,
  config: Record<string, unknown>,
): Promise<ProviderCalendar[]> {
  const result = await invoke<{ calendars: WireProviderCalendar[]; error: string | null }>(
    'discover_calendars',
    { provider: providerId, config },
  );
  return result.calendars.map(fromWireCalendar);
}

export async function providerSync(
  providerId: string,
  config: Record<string, unknown>,
  calendarId: string,
  pending: TaskPushInput[],
  deleted: TaskDeleteInput[],
  pendingEvents: EventPushInput[] = [],
  eventUidsToCheck: string[] = [],
): Promise<SyncOutput> {
  const result = await invoke<WireSyncOutput>('sync_account', {
    provider: providerId,
    config,
    calendarHref: calendarId,
    pendingTasks: pending.map(toWirePushInput),
    deletedHrefs: deleted.map((d) => ({ href: d.href, etag: d.etag })),
    pendingEvents: pendingEvents.map(toWireEventPushInput),
    eventUidsToCheck,
  });
  return fromWireSyncOutput(result);
}

export async function providerFetchEvents(
  providerId: string,
  config: Record<string, unknown>,
  calendarId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<ProviderEvent[]> {
  const result = await invoke<{ events: WireProviderEvent[]; error: string | null }>(
    'fetch_events',
    {
      provider: providerId,
      config,
      calendarHref: calendarId,
      rangeStart,
      rangeEnd,
    },
  );
  return result.events.map(fromWireEvent);
}

// ── Provider Metadata ─────────────────────────────────────────────────────────

interface WireProviderFieldDef {
  key: string;
  label: string;
  field_type: string;
  required: boolean;
  placeholder: string | null;
  help_text: string | null;
}

interface WireProviderMapFieldDef {
  key: string;
  label: string;
  field_type: string;
  default_value: unknown;
  help_text: string | null;
}

interface WireProviderMetadata {
  id: string;
  display_name: string;
  icon: string;
  description: string;
  credential_fields: WireProviderFieldDef[];
  map_fields: WireProviderMapFieldDef[];
  source_noun: string;
  source_noun_plural: string;
  supports_events: boolean;
}

function fromWireFieldDef(w: WireProviderFieldDef): ProviderFieldDef {
  return {
    key: w.key,
    label: w.label,
    fieldType: w.field_type,
    required: w.required,
    placeholder: w.placeholder,
    helpText: w.help_text,
  };
}

function fromWireMapFieldDef(w: WireProviderMapFieldDef): ProviderMapFieldDef {
  return {
    key: w.key,
    label: w.label,
    fieldType: w.field_type,
    defaultValue: w.default_value,
    helpText: w.help_text,
  };
}

function fromWireMetadata(w: WireProviderMetadata): ProviderMetadata {
  return {
    id: w.id,
    displayName: w.display_name,
    icon: w.icon,
    description: w.description,
    credentialFields: w.credential_fields.map(fromWireFieldDef),
    mapFields: w.map_fields.map(fromWireMapFieldDef),
    sourceNoun: w.source_noun,
    sourceNounPlural: w.source_noun_plural,
    supportsEvents: w.supports_events,
  };
}

export async function providerListProviders(): Promise<ProviderMetadata[]> {
  const result = await invoke<WireProviderMetadata[]>('list_providers');
  return result.map(fromWireMetadata);
}

export async function providerGetMetadata(providerId: string): Promise<ProviderMetadata> {
  const result = await invoke<WireProviderMetadata>('get_provider_metadata', { provider: providerId });
  return fromWireMetadata(result);
}

// ── App Sync IPC ──────────────────────────────────────────────────────────────

export interface AppSyncAccountConfig {
  providerType: string;
  serverUrl: string;
  username: string;
  password: string;
  bundlePath: string;
}

export interface AppSyncStatus {
  configured: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  isSyncing: boolean;
  accountId: string | null;
  serverUrl: string | null;
  username: string | null;
}

interface WireAppSyncStatus {
  configured: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  is_syncing: boolean;
  account_id: string | null;
  server_url: string | null;
  username: string | null;
}

function fromWireAppSyncStatus(w: WireAppSyncStatus): AppSyncStatus {
  return {
    configured: w.configured,
    lastSyncAt: w.last_sync_at,
    lastError: w.last_error,
    isSyncing: w.is_syncing,
    accountId: w.account_id,
    serverUrl: w.server_url,
    username: w.username,
  };
}

export async function appSyncSetup(config: AppSyncAccountConfig, passphrase: string): Promise<void> {
  await invoke('app_sync_setup', {
    config: {
      provider_type: config.providerType,
      server_url: config.serverUrl,
      username: config.username,
      password: config.password,
      bundle_path: config.bundlePath,
    },
    passphrase,
  });
}

export async function appSyncDelete(): Promise<void> {
  await invoke('app_sync_delete');
}

export async function appSyncTest(): Promise<boolean> {
  return invoke<boolean>('app_sync_test');
}

export async function appSyncPush(): Promise<string> {
  return invoke<string>('app_sync_push');
}

export async function appSyncPull(): Promise<string> {
  return invoke<string>('app_sync_pull');
}

export async function appSyncStatus(): Promise<AppSyncStatus> {
  const result = await invoke<WireAppSyncStatus>('app_sync_status');
  return fromWireAppSyncStatus(result);
}

export async function appSyncGenerateLinkCode(): Promise<string> {
  return invoke<string>('app_sync_generate_link_code');
}

export async function appSyncJoin(linkCode: string, passphrase: string): Promise<string> {
  return invoke<string>('app_sync_join', { linkCode, passphrase });
}
