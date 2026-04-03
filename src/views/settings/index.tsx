import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ViewHeader } from '@/components/layout/view-header';
import { useApp } from '@/components/app-provider';
import { useTaskStore, useListStore, useSyncStore, useUIStore } from '@/stores';
import type { SyncInterval } from '@/stores';
import type { ProviderAccount, ProviderMap, TaskList } from '@/types';
import type { ProviderCalendar, ProviderMetadata } from '@/providers/types';
import { providerListProviders } from '@/providers/ipc';
import {
  Wifi,
  WifiOff,
  Cloud,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Link,
  Unlink,
  Calendar,
  Github,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Dynamic icon lookup ───────────────────────────────────────────────────────

type LucideComponent = React.ComponentType<{ className?: string }>;

const ICON_MAP: Record<string, LucideComponent> = {
  wifi: Wifi,
  github: Github,
  cloud: Cloud,
};

function ProviderIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Cloud;
  return <Icon className={className} />;
}

// ── SettingsView ──────────────────────────────────────────────────────────────

export function SettingsView() {
  const { adapter } = useApp();
  const {
    accounts, maps,
    syncStatus, lastSyncAt, lastSyncError, isSyncing,
    syncAll, deleteAccount,
  } = useSyncStore();
  const { tasks } = useTaskStore();
  const { lists } = useListStore();
  const { syncIntervalMinutes, setSyncInterval } = useUIStore();

  const [providers, setProviders] = useState<ProviderMetadata[]>([]);
  const [addingProviderType, setAddingProviderType] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<ProviderAccount | null>(null);

  // Load provider metadata once on mount.
  useEffect(() => {
    providerListProviders().then(setProviders).catch(console.error);
  }, []);

  function getMetadata(providerType: string): ProviderMetadata | null {
    return providers.find((p) => p.id === providerType) ?? null;
  }

  function handleSync() {
    if (!adapter) return;
    syncAll(
      adapter,
      Array.from(tasks.values()),
      lists,
      () => useTaskStore.getState().loadTasks(adapter),
      () => useListStore.getState().loadLists(adapter),
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ViewHeader
        actions={
          accounts.length > 0 ? (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors',
                isSyncing
                  ? 'text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Syncing…' : 'Sync Now'}
            </button>
          ) : undefined
        }
      >
        <h1 className="text-lg font-semibold">Settings</h1>
      </ViewHeader>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Sync status banner */}
        {syncStatus === 'error' && lastSyncError && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs">
            <WifiOff className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Sync failed</p>
              <p className="text-destructive/80 mt-0.5 select-all cursor-text break-all">{lastSyncError}</p>
            </div>
          </div>
        )}
        {syncStatus === 'success' && lastSyncAt && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-xs">
            <Check className="h-4 w-4" />
            Last synced {new Date(lastSyncAt).toLocaleTimeString()}
          </div>
        )}

        {/* ── Sync interval ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">Sync</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-foreground">Auto-sync interval</p>
              <p className="text-xs text-muted-foreground mt-0.5">Automatically sync with connected accounts</p>
            </div>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1.5 text-xs rounded-md border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                  {syncIntervalMinutes == null ? 'Off'
                    : syncIntervalMinutes === 5 ? 'Every 5 minutes'
                    : syncIntervalMinutes === 15 ? 'Every 15 minutes'
                    : syncIntervalMinutes === 30 ? 'Every 30 minutes'
                    : 'Every hour'}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md"
                >
                  {([
                    { value: 'off', label: 'Off' },
                    { value: '5', label: 'Every 5 minutes' },
                    { value: '15', label: 'Every 15 minutes' },
                    { value: '30', label: 'Every 30 minutes' },
                    { value: '60', label: 'Every hour' },
                  ] as const).map(({ value, label }) => (
                    <DropdownMenu.Item
                      key={value}
                      onSelect={() => setSyncInterval(value === 'off' ? null : (Number(value) as SyncInterval))}
                      className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer outline-none data-[highlighted]:bg-accent"
                    >
                      {(syncIntervalMinutes == null && value === 'off') || String(syncIntervalMinutes) === value
                        ? <Check className="h-3 w-3" />
                        : <span className="h-3 w-3" />}
                      {label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </section>

        {/* ── Accounts ────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Accounts</h2>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Plus className="h-3.5 w-3.5" />
                  Add Account
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md"
                >
                  {providers.map((p) => (
                    <DropdownMenu.Item
                      key={p.id}
                      onSelect={() => { setEditingAccount(null); setAddingProviderType(p.id); }}
                      className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer outline-none data-[highlighted]:bg-accent"
                    >
                      <ProviderIcon name={p.icon} className="h-3.5 w-3.5 text-muted-foreground" />
                      {p.displayName} Account
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          {accounts.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-3 mb-2 opacity-30">
                {providers.length > 0 ? (
                  providers.map((p) => (
                    <ProviderIcon key={p.id} name={p.icon} className="h-7 w-7" />
                  ))
                ) : (
                  <Cloud className="h-7 w-7" />
                )}
              </div>
              <p>No accounts connected.</p>
              <p className="text-xs mt-1">Add an account to start syncing.</p>
            </div>
          )}

          {adapter && accounts.map((account) => {
            const metadata = getMetadata(account.providerType);
            if (!metadata) return null;
            return (
              <ProviderAccountRow
                key={account.id}
                account={account}
                metadata={metadata}
                maps={maps.filter((m) => m.accountId === account.id)}
                lists={lists}
                adapter={adapter}
                onEdit={() => setEditingAccount(account)}
                onDelete={() => deleteAccount(adapter, account.id)}
              />
            );
          })}
        </section>
      </div>

      {/* Add account modal */}
      {addingProviderType !== null && !editingAccount && adapter && (() => {
        const metadata = getMetadata(addingProviderType);
        if (!metadata) return null;
        return (
          <AccountModal
            title={`Add ${metadata.displayName} Account`}
            onClose={() => setAddingProviderType(null)}
          >
            <AddAccountForm
              key={`new-${addingProviderType}`}
              existing={null}
              providerType={addingProviderType}
              metadata={metadata}
              adapter={adapter}
              maps={maps}
              lists={lists}
              onDone={() => setAddingProviderType(null)}
            />
          </AccountModal>
        );
      })()}

      {/* Edit account modal */}
      {editingAccount && adapter && (() => {
        const metadata = getMetadata(editingAccount.providerType);
        if (!metadata) return null;
        return (
          <AccountModal
            title={`Edit ${metadata.displayName} Account`}
            onClose={() => setEditingAccount(null)}
          >
            <AddAccountForm
              key={editingAccount.id}
              existing={editingAccount}
              providerType={editingAccount.providerType}
              metadata={metadata}
              adapter={adapter}
              maps={maps}
              lists={lists}
              onDone={() => setEditingAccount(null)}
            />
          </AccountModal>
        );
      })()}
    </div>
  );
}

// ── AccountModal wrapper ──────────────────────────────────────────────────────

function AccountModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-y-auto">
            <div className="p-4">{children}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── ProviderAccountRow ────────────────────────────────────────────────────────

function ProviderAccountRow({
  account,
  metadata,
  maps,
  lists,
  adapter,
  onEdit,
  onDelete,
}: {
  account: ProviderAccount;
  metadata: ProviderMetadata;
  maps: ProviderMap[];
  lists: TaskList[];
  adapter: NonNullable<ReturnType<typeof useApp>['adapter']>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedMapId, setExpandedMapId] = useState<string | null>(null);

  const linkedMaps = maps.filter((m) => m.listId !== null);
  const noun = linkedMaps.length === 1 ? metadata.sourceNoun : metadata.sourceNounPlural;

  return (
    <div className="border border-border rounded-md mb-2 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <ProviderIcon name={metadata.icon} className="h-4 w-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{account.displayName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {account.lastSyncedAt
              ? `Last synced ${new Date(account.lastSyncedAt).toLocaleTimeString()}`
              : 'Never synced'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{linkedMaps.length} {noun}</span>
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-3 py-2 space-y-1.5">
          {maps.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No {metadata.sourceNounPlural} linked.</p>
          ) : (
            maps.map((m) => {
              const list = m.listId ? lists.find((l) => l.id === m.listId) : null;
              const isMapExpanded = expandedMapId === m.id;
              const hasSettings = metadata.mapFields.length > 0 && m.listId !== null;
              return (
                <div key={m.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    {list && (
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: list.color ?? '#6366f1' }}
                      />
                    )}
                    {!list && !!m.settings.events_only && (
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate text-muted-foreground">
                      {list?.name ?? (m.settings.events_only ? 'Events only' : m.sourceId)}
                    </span>
                    <span className="text-muted-foreground/60 truncate max-w-[160px]">
                      {m.sourceName ?? m.sourceId}
                    </span>
                    {hasSettings && (
                      <button
                        onClick={() => setExpandedMapId(isMapExpanded ? null : m.id)}
                        className="text-muted-foreground hover:text-foreground flex-shrink-0"
                        title="Per-source settings"
                      >
                        {isMapExpanded
                          ? <ChevronDown className="h-3 w-3" />
                          : <ChevronRight className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                  {isMapExpanded && hasSettings && (
                    <SourceSettingsInline
                      map={m}
                      fields={metadata.mapFields}
                      adapter={adapter}
                    />
                  )}
                </div>
              );
            })
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onEdit} className="text-xs text-primary hover:underline">Edit</button>
            <button onClick={onDelete} className="text-xs text-destructive hover:underline flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SourceSettingsInline ──────────────────────────────────────────────────────

function SourceSettingsInline({
  map,
  fields,
  adapter,
}: {
  map: ProviderMap;
  fields: ProviderMetadata['mapFields'];
  adapter: NonNullable<ReturnType<typeof useApp>['adapter']>;
}) {
  const { updateMap } = useSyncStore();
  const [values, setValues] = useState<Record<string, unknown>>({ ...map.settings });

  async function saveField(key: string, value: unknown) {
    const next = { ...values, [key]: value };
    setValues(next);
    await updateMap(adapter, map.id, next);
  }

  // Only show user-facing fields (exclude internal keys like sync_token)
  const userFields = fields.filter((f) => f.key !== 'sync_token');
  if (userFields.length === 0) return null;

  return (
    <div className="mt-1.5 ml-4 space-y-1.5 pl-2 border-l border-border">
      {userFields.map((field) => {
        if (field.fieldType === 'boolean') {
          const checked = Boolean(values[field.key] ?? field.defaultValue);
          return (
            <div key={field.key} className="flex items-center gap-2">
              <input
                id={`${map.id}-${field.key}`}
                type="checkbox"
                checked={checked}
                onChange={(e) => saveField(field.key, e.target.checked)}
                className="h-3.5 w-3.5 rounded border-input accent-primary"
              />
              <label
                htmlFor={`${map.id}-${field.key}`}
                className="text-xs text-muted-foreground cursor-pointer select-none"
              >
                {field.label}
              </label>
            </div>
          );
        }
        // text field
        const textValue = String(values[field.key] ?? field.defaultValue ?? '');
        return (
          <div key={field.key}>
            <input
              type="text"
              defaultValue={textValue}
              onBlur={(e) => {
                const trimmed = e.target.value.trim();
                saveField(field.key, trimmed || (field.defaultValue ?? null));
              }}
              placeholder={String(field.defaultValue ?? '')}
              className="w-full text-xs border border-input rounded px-2 py-1 bg-background outline-none focus:ring-1 focus:ring-ring font-mono placeholder:text-muted-foreground/50"
            />
            {field.helpText && (
              <p className="text-xs text-muted-foreground mt-0.5">{field.helpText}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── AddAccountForm ────────────────────────────────────────────────────────────

type FormStep = 'credentials' | 'sources';

function AddAccountForm({
  existing,
  providerType,
  metadata,
  adapter,
  maps,
  lists,
  onDone,
}: {
  existing: ProviderAccount | null;
  providerType: string;
  metadata: ProviderMetadata;
  adapter: NonNullable<ReturnType<typeof useApp>['adapter']>;
  maps: ProviderMap[];
  lists: TaskList[];
  onDone: () => void;
}) {
  const {
    addAccount,
    updateAccount,
    testConnection,
    discoverSources,
    linkSource,
    unlinkSource,
  } = useSyncStore();
  const { createList } = useListStore();

  const [step, setStep] = useState<FormStep>('credentials');
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '');

  // Initialize field values from existing account credentials or empty string.
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of metadata.credentialFields) {
      init[field.key] = String(existing?.credentials[field.key] ?? '');
    }
    return init;
  });

  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<ProviderCalendar[]>([]);
  const [savedAccountId, setSavedAccountId] = useState<string | null>(existing?.id ?? null);

  const credentialsFromForm = (): Record<string, unknown> => {
    const creds: Record<string, unknown> = {};
    for (const field of metadata.credentialFields) {
      creds[field.key] = fieldValues[field.key] ?? '';
    }
    return creds;
  };

  const isConnectDisabled = testing || metadata.credentialFields.some(
    (f) => f.required && !fieldValues[f.key]?.trim()
  );

  async function handleConnect() {
    setTesting(true);
    setTestError(null);
    const credentials = credentialsFromForm();
    const result = await testConnection(providerType, credentials);
    setTesting(false);

    if (result.ok) {
      let accountId = savedAccountId;
      const name = displayName || (providerType === 'caldav'
        ? (() => { try { return new URL(String(credentials.server_url)).hostname; } catch { return metadata.displayName; } })()
        : metadata.displayName);

      if (!accountId) {
        const account = await addAccount(adapter, providerType, name, credentials);
        accountId = account.id;
        setSavedAccountId(accountId);
      } else {
        await updateAccount(adapter, accountId, { displayName: name, credentials });
      }

      setStep('sources');
      setDiscovering(true);
      const sources = await discoverSources(providerType, credentials);
      setDiscovered(sources);
      setDiscovering(false);
    } else {
      setTestError(result.error ?? 'Connection failed');
    }
  }

  async function handleLinkToggle(source: ProviderCalendar, eventsOnly = false) {
    if (!savedAccountId) return;

    const existingMap = maps.find(
      (m) => m.accountId === savedAccountId && m.sourceId === source.id
    );

    if (existingMap) {
      await unlinkSource(adapter, existingMap.id);
    } else if (eventsOnly) {
      // Events-only: no list, just track this source for calendar events.
      await linkSource(adapter, savedAccountId, source.id, source.displayName, null, { events_only: true });
    } else {
      // Find or create a list for this source.
      let list = lists.find((l) => l.remoteUrl === source.id);
      if (!list) {
        const name = source.displayName ?? source.id.split('/').filter(Boolean).pop() ?? metadata.sourceNoun;
        list = await createList(adapter, name, source.color ?? undefined);
        await useListStore.getState().updateList(adapter, list.id, { remoteUrl: source.id });
        list = { ...list, remoteUrl: source.id };
      }

      // Default settings: for caldav set events_only=false; for all providers use empty object.
      const settings: Record<string, unknown> = {};
      if (metadata.supportsEvents) settings.events_only = false;

      await linkSource(adapter, savedAccountId, source.id, source.displayName, list.id, settings);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ProviderIcon name={metadata.icon} className="h-4 w-4" />
          {existing ? `Edit ${metadata.displayName} Account` : `New ${metadata.displayName} Account`}
        </h3>
        <button onClick={onDone} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {step === 'credentials' ? (
        <div className="space-y-3">
          {/* Display name (always shown) */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={`My ${metadata.displayName} Account`}
              className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Dynamic credential fields */}
          {metadata.credentialFields.map((field) => (
            <div key={field.key}>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {field.label}{field.required && ' *'}
              </label>
              <input
                type={field.fieldType === 'password' ? 'password' : field.fieldType === 'url' ? 'url' : 'text'}
                value={fieldValues[field.key] ?? ''}
                onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder ?? undefined}
                autoComplete={field.fieldType === 'password' ? 'current-password' : field.fieldType === 'text' ? 'username' : 'off'}
                className={cn(
                  'w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background outline-none focus:ring-1 focus:ring-ring',
                  field.fieldType === 'password' && 'font-mono'
                )}
              />
              {field.helpText && (
                <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
              )}
            </div>
          ))}

          {testError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <WifiOff className="h-3.5 w-3.5" /> {testError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConnect}
              disabled={isConnectDisabled}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ProviderIcon name={metadata.icon} className="h-3.5 w-3.5" />
              )}
              {testing ? 'Connecting…' : 'Connect'}
            </button>
            <button onClick={onDone} className="text-xs text-muted-foreground hover:text-foreground px-2">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> Connected successfully
          </p>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {discovering
                ? `Discovering ${metadata.sourceNounPlural}…`
                : `${discovered.length} ${discovered.length === 1 ? metadata.sourceNoun : metadata.sourceNounPlural} found`}
            </p>
            {discovering && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Scanning…
              </div>
            )}
            {!discovering && discovered.map((source) => {
              const linkedMap = savedAccountId
                ? maps.find((m) => m.accountId === savedAccountId && m.sourceId === source.id)
                : undefined;
              const isLinked = Boolean(linkedMap);
              const sourceName = source.displayName ?? source.id.split('/').filter(Boolean).pop() ?? source.id;

              return (
                <div key={source.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{sourceName}</p>
                    <p className="text-xs text-muted-foreground truncate">{source.id}</p>
                  </div>
                  {isLinked ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {linkedMap?.settings.events_only
                          ? <><Calendar className="h-3 w-3" /> Events only</>
                          : <><Link className="h-3 w-3" /> Tasks</>}
                      </span>
                      <button
                        onClick={() => handleLinkToggle(source)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Unlink className="h-3 w-3" /> Unlink
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleLinkToggle(source, false)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        title={`Sync as a task list`}
                      >
                        <Link className="h-3 w-3" /> Tasks
                      </button>
                      {metadata.supportsEvents && (
                        <button
                          onClick={() => handleLinkToggle(source, true)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          title="Show events in calendar view only — no task list created"
                        >
                          <Calendar className="h-3 w-3" /> Events only
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {!discovering && discovered.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No {metadata.sourceNounPlural} discovered.
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onDone}
              className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90"
            >
              Done
            </button>
            <button
              onClick={() => setStep('credentials')}
              className="text-xs text-muted-foreground hover:text-foreground px-2"
            >
              Edit credentials
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
