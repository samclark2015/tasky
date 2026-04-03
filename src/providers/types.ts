// Canonical provider data types.
// These mirror the Rust types in src/providers/mod.rs.
// No provider logic lives here — all implementations are in Rust.

export interface ProviderCalendar {
  id: string;
  displayName: string | null;
  color: string | null;
  supportsSync: boolean;
}

export interface ProviderTask {
  remoteId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  /** 1=high 5=medium 9=low (RFC 5545) */
  priority: number | null;
  tags: string[];
  completed: boolean;
  completedAt: string | null;
  rrule: string | null;
  parentRemoteId: string | null;
  notes: string | null;
  timeEstimate: number | null;
  sourceEventUid: string | null;
  etag: string;
  href: string;
}

export interface ProviderEvent {
  remoteId: string;
  calendarId: string;
  title: string;
  description: string | null;
  start: string | null;
  end: string | null;
  location: string | null;
  color: string | null;
}

export interface PushResult {
  localId: string;
  remoteId: string;
  etag: string;
  href: string;
}

export interface SyncOutput {
  pushed: PushResult[];
  pushErrors: string[];
  deleteErrors: string[];
  remoteTasks: ProviderTask[];
  fetchError: string | null;
}

export interface TaskPushInput {
  localId: string;
  remoteId: string | null;
  title: string;
  description: string;
  dueDate: string | null;
  priority: string;
  tags: string[];
  rrule: string | null;
  completed: boolean;
  completedAt: string | null;
  notes: string;
  timeEstimate: number | null;
  etag: string | null;
  href: string | null;
  parentRemoteId: string | null;
  sourceEventUid: string | null;
}

export interface TaskDeleteInput {
  href: string;
  etag: string | null;
}

export interface ProviderFieldDef {
  key: string;
  label: string;
  /** "text" | "password" | "url" */
  fieldType: string;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
}

export interface ProviderMapFieldDef {
  key: string;
  label: string;
  /** "text" | "boolean" */
  fieldType: string;
  defaultValue: unknown;
  helpText: string | null;
}

export interface ProviderMetadata {
  id: string;
  displayName: string;
  /** Lucide icon name */
  icon: string;
  description: string;
  credentialFields: ProviderFieldDef[];
  mapFields: ProviderMapFieldDef[];
  sourceNoun: string;
  sourceNounPlural: string;
  supportsEvents: boolean;
}
