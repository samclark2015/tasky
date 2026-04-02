import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ViewHeader } from '@/components/layout/view-header';
import { useApp } from '@/components/app-provider';
import { useTaskStore, useListStore, useSyncStore, useUIStore } from '@/stores';
import type { SyncInterval } from '@/stores';
import type { CalDavAccount, GitHubAccount, GitHubRepoMap, TaskList } from '@/types';
import type { ProviderCalendar } from '@/providers/types';
import {
  Wifi,
  WifiOff,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Link,
  Unlink,
  Github,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type EditingAccount =
  | { type: 'caldav'; account: CalDavAccount }
  | { type: 'github'; account: GitHubAccount }
  | null;

export function SettingsView() {
  const { adapter } = useApp();
  const {
    accounts, calendarMaps,
    githubAccounts, githubRepoMaps,
    syncStatus, lastSyncAt, lastSyncError, isSyncing,
    syncAll, deleteAccount, deleteGitHubAccount,
  } = useSyncStore();
  const { tasks } = useTaskStore();
  const { lists } = useListStore();
  const [panel, setPanel] = useState<'add-caldav' | 'add-github' | null>(null);
  const [editingAccount, setEditingAccount] = useState<EditingAccount>(null);

  const { syncIntervalMinutes, setSyncInterval } = useUIStore();

  const hasAnyAccount = accounts.length > 0 || githubAccounts.length > 0;

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
          hasAnyAccount ? (
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

        {/* ── Sync ─────────────────────────────────────────────────────────── */}
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

        {/* ── Accounts ─────────────────────────────────────────────────────── */}
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
                  <DropdownMenu.Item
                    onSelect={() => { setEditingAccount(null); setPanel('add-caldav'); }}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer outline-none data-[highlighted]:bg-accent"
                  >
                    <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                    CalDAV Account
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => { setEditingAccount(null); setPanel('add-github'); }}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer outline-none data-[highlighted]:bg-accent"
                  >
                    <Github className="h-3.5 w-3.5 text-muted-foreground" />
                    GitHub Account
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          {!hasAnyAccount && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-3 mb-2 opacity-30">
                <Wifi className="h-7 w-7" />
                <Github className="h-7 w-7" />
              </div>
              <p>No accounts connected.</p>
              <p className="text-xs mt-1">Add a CalDAV or GitHub account to start syncing.</p>
            </div>
          )}

          {accounts.map((account) => (
            <CalDavAccountRow
              key={account.id}
              account={account}
              calendarMaps={calendarMaps}
              lists={lists}
              onEdit={() => setEditingAccount({ type: 'caldav', account })}
              onDelete={() => adapter && deleteAccount(adapter, account.id)}
            />
          ))}

          {adapter && githubAccounts.map((account) => (
            <GitHubAccountRow
              key={account.id}
              account={account}
              repoMaps={githubRepoMaps}
              lists={lists}
              adapter={adapter}
              onEdit={() => setEditingAccount({ type: 'github', account })}
              onDelete={() => deleteGitHubAccount(adapter, account.id)}
            />
          ))}
        </section>
      </div>

      {/* Add account modal */}
      {panel !== null && !editingAccount && adapter && (
        <AddAccountModal
          type={panel === 'add-caldav' ? 'caldav' : 'github'}
          adapter={adapter}
          lists={lists}
          calendarMaps={calendarMaps}
          repoMaps={githubRepoMaps}
          onClose={() => setPanel(null)}
        />
      )}

      {/* Edit account modal */}
      {editingAccount && adapter && (
        <EditAccountModal
          editingAccount={editingAccount}
          adapter={adapter}
          lists={lists}
          calendarMaps={calendarMaps}
          repoMaps={githubRepoMaps}
          onClose={() => setEditingAccount(null)}
        />
      )}
    </div>
  );
}

// ── CalDavAccountRow ──────────────────────────────────────────────────────────

function CalDavAccountRow({
  account,
  calendarMaps,
  lists,
  onEdit,
  onDelete,
}: {
  account: CalDavAccount;
  calendarMaps: ReturnType<typeof useSyncStore.getState>['calendarMaps'];
  lists: TaskList[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const myMaps = calendarMaps.filter((m) => m.accountId === account.id);

  return (
    <div className="border border-border rounded-md mb-2 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Wifi className="h-4 w-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{account.displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{account.lastSyncedAt ? `Last synced ${new Date(account.lastSyncedAt).toLocaleTimeString()}` : 'Never synced'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{myMaps.length} calendar{myMaps.length !== 1 ? 's' : ''}</span>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-3 py-2 space-y-1.5">
          {myMaps.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No calendars linked.</p>
          ) : (
            myMaps.map((m) => {
              const list = lists.find((l) => l.id === m.listId);
              return (
                <div key={m.listId} className="flex items-center gap-2 text-xs">
                  {list && (
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: list.color ?? '#6366f1' }}
                    />
                  )}
                  <span className="flex-1 truncate text-muted-foreground">
                    {list?.name ?? m.listId}
                  </span>
                  <span className="text-muted-foreground/60 truncate max-w-[180px]">{m.calendarHref}</span>
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

// ── GitHubAccountRow ──────────────────────────────────────────────────────────

function RepoSettingsInline({
  map,
  adapter,
}: {
  map: GitHubRepoMap;
  adapter: NonNullable<ReturnType<typeof useApp>['adapter']>;
}) {
  const { updateGitHubRepoMap } = useSyncStore();
  const [query, setQuery] = useState(map.query ?? '');
  const [readOnly, setReadOnly] = useState(map.readOnly);

  function handleQueryBlur() {
    const trimmed = query.trim();
    updateGitHubRepoMap(adapter, map.listId, { query: trimmed || null });
  }

  function handleReadOnlyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    setReadOnly(next);
    updateGitHubRepoMap(adapter, map.listId, { readOnly: next });
  }

  return (
    <div className="mt-1.5 ml-4 space-y-1.5 pl-2 border-l border-border">
      <div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={handleQueryBlur}
          placeholder="assignee:@me is:open"
          className="w-full text-xs border border-input rounded px-2 py-1 bg-background outline-none focus:ring-1 focus:ring-ring font-mono placeholder:text-muted-foreground/50"
        />
        <p className="text-xs text-muted-foreground mt-0.5">
          GitHub search syntax. <code className="bg-muted px-0.5 rounded">repo:</code> and <code className="bg-muted px-0.5 rounded">is:issue</code> added automatically.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={`ro-${map.listId}`}
          type="checkbox"
          checked={readOnly}
          onChange={handleReadOnlyChange}
          className="h-3.5 w-3.5 rounded border-input accent-primary"
        />
        <label htmlFor={`ro-${map.listId}`} className="text-xs text-muted-foreground cursor-pointer select-none">
          Read-only — pull issues in only, never push changes back to GitHub
        </label>
      </div>
    </div>
  );
}

function GitHubAccountRow({
  account,
  repoMaps,
  lists,
  adapter,
  onEdit,
  onDelete,
}: {
  account: GitHubAccount;
  repoMaps: ReturnType<typeof useSyncStore.getState>['githubRepoMaps'];
  lists: TaskList[];
  adapter: NonNullable<ReturnType<typeof useApp>['adapter']>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
  const myMaps = repoMaps.filter((m) => m.accountId === account.id);

  return (
    <div className="border border-border rounded-md mb-2 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Github className="h-4 w-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{account.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {account.lastSyncedAt
              ? `Last synced ${new Date(account.lastSyncedAt).toLocaleTimeString()}`
              : 'Never synced'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{myMaps.length} repo{myMaps.length !== 1 ? 's' : ''}</span>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-3 py-2 space-y-1.5">
          {myMaps.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No repositories linked.</p>
          ) : (
            myMaps.map((m) => {
              const list = lists.find((l) => l.id === m.listId);
              const isRepoExpanded = expandedRepo === m.listId;
              return (
                <div key={m.listId} className="text-xs">
                  <div className="flex items-center gap-2">
                    {list && (
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: list.color ?? '#6366f1' }}
                      />
                    )}
                    <span className="flex-1 truncate text-muted-foreground">
                      {list?.name ?? m.listId}
                    </span>
                    <span className="text-muted-foreground/60 truncate max-w-[140px]">{m.repoFullName}</span>
                    <button
                      onClick={() => setExpandedRepo(isRepoExpanded ? null : m.listId)}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                      title="Per-repo settings"
                    >
                      {isRepoExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  </div>
                  {isRepoExpanded && (
                    <RepoSettingsInline
                      map={m}
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

// ── AddAccountModal ───────────────────────────────────────────────────────────

function AddAccountModal({
  type,
  adapter,
  lists,
  calendarMaps,
  repoMaps,
  onClose,
}: {
  type: 'caldav' | 'github';
  adapter: NonNullable<ReturnType<typeof useApp>['adapter']>;
  lists: TaskList[];
  calendarMaps: ReturnType<typeof useSyncStore.getState>['calendarMaps'];
  repoMaps: ReturnType<typeof useSyncStore.getState>['githubRepoMaps'];
  onClose: () => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
        >
          <Dialog.Title className="sr-only">
            {type === 'caldav' ? 'Add CalDAV Account' : 'Add GitHub Account'}
          </Dialog.Title>
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-y-auto">
            <div className="p-4">
              {type === 'caldav' ? (
                <AddCalDavAccountForm
                  key="new-caldav"
                  existing={null}
                  adapter={adapter}
                  lists={lists}
                  calendarMaps={calendarMaps}
                  onDone={onClose}
                  noBorder
                />
              ) : (
                <AddGitHubAccountForm
                  key="new-github"
                  existing={null}
                  adapter={adapter}
                  repoMaps={repoMaps}
                  onDone={onClose}
                  noBorder
                />
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── EditAccountModal ──────────────────────────────────────────────────────────

function EditAccountModal({
  editingAccount,
  adapter,
  lists,
  calendarMaps,
  repoMaps,
  onClose,
}: {
  editingAccount: NonNullable<EditingAccount>;
  adapter: NonNullable<ReturnType<typeof useApp>['adapter']>;
  lists: TaskList[];
  calendarMaps: ReturnType<typeof useSyncStore.getState>['calendarMaps'];
  repoMaps: ReturnType<typeof useSyncStore.getState>['githubRepoMaps'];
  onClose: () => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
        >
          <Dialog.Title className="sr-only">
            {editingAccount.type === 'caldav' ? 'Edit CalDAV Account' : 'Edit GitHub Account'}
          </Dialog.Title>
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-y-auto">
            <div className="p-4">
              {editingAccount.type === 'caldav' ? (
                <AddCalDavAccountForm
                  key={editingAccount.account.id}
                  existing={editingAccount.account}
                  adapter={adapter}
                  lists={lists}
                  calendarMaps={calendarMaps}
                  onDone={onClose}
                  noBorder
                />
              ) : (
                <AddGitHubAccountForm
                  key={editingAccount.account.id}
                  existing={editingAccount.account}
                  adapter={adapter}
                  repoMaps={repoMaps}
                  onDone={onClose}
                  noBorder
                />
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── AddCalDavAccountForm ─────────────────────────────────────────────────────

type CalDavFormStep = 'credentials' | 'testing' | 'calendars';

function AddCalDavAccountForm({
  existing,
  adapter,
  lists,
  calendarMaps,
  onDone,
  noBorder,
}: {
  existing: CalDavAccount | null;
  adapter: NonNullable<ReturnType<typeof useApp>['adapter']>;
  lists: TaskList[];
  calendarMaps: ReturnType<typeof useSyncStore.getState>['calendarMaps'];
  onDone: () => void;
  noBorder?: boolean;
}) {
  const { addAccount, updateAccount, testConnection, discoverCalendars, linkCalendar, unlinkCalendar } = useSyncStore();
  const { createList } = useListStore();

  const [step, setStep] = useState<CalDavFormStep>('credentials');
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '');
  const [serverUrl, setServerUrl] = useState(existing?.serverUrl ?? '');
  const [username, setUsername] = useState(existing?.username ?? '');
  const [password, setPassword] = useState(existing?.password ?? '');
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<ProviderCalendar[]>([]);
  const [savedAccountId, setSavedAccountId] = useState<string | null>(existing?.id ?? null);

  async function handleTest() {
    setTesting(true);
    setTestError(null);
    const result = await testConnection(serverUrl, username, password);
    setTesting(false);
    if (result.ok) {
      let accountId = savedAccountId;
      if (!accountId) {
        const account = await addAccount(adapter, {
          displayName: displayName || new URL(serverUrl).hostname,
          serverUrl,
          username,
          password,
          syncEnabled: true,
        });
        accountId = account.id;
        setSavedAccountId(accountId);
      } else {
        await updateAccount(adapter, accountId, { displayName, serverUrl, username, password });
      }
      setStep('calendars');
      setDiscovering(true);
      const cals = await discoverCalendars(serverUrl, username, password);
      setDiscovered(cals);
      setDiscovering(false);
    } else {
      setTestError(result.error ?? 'Connection failed');
    }
  }

  async function handleLinkToggle(cal: ProviderCalendar, eventsOnly = false) {
    if (!savedAccountId) return;
    const existing = calendarMaps.find(
      (m) => m.accountId === savedAccountId && m.calendarHref === cal.id
    );
    if (existing) {
      await unlinkCalendar(adapter, existing.listId);
    } else if (eventsOnly) {
      // Events-only: fetch VEVENTs into the calendar view, no list created.
      await linkCalendar(adapter, savedAccountId, cal.id, null, true);
    } else {
      let list = lists.find((l) => l.caldavUrl === cal.id);
      if (!list) {
        const name = cal.displayName ?? cal.id.split('/').filter(Boolean).pop() ?? 'Calendar';
        list = await createList(adapter, name, cal.color ?? undefined);
        await useListStore.getState().updateList(adapter, list.id, { caldavUrl: cal.id });
        list = { ...list, caldavUrl: cal.id };
      }
      await linkCalendar(adapter, savedAccountId, cal.id, list, false);
    }
  }

  return (
    <section className={cn('p-4 space-y-4', !noBorder && 'border border-border rounded-md')}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{existing ? 'Edit CalDAV Account' : 'New CalDAV Account'}</h3>
        <button onClick={onDone} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {step === 'credentials' || step === 'testing' ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My Calendar Account"
              className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Server URL</label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://caldav.fastmail.com"
              className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user@example.com"
              autoComplete="username"
              className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="App-specific password"
              autoComplete="current-password"
              className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {testError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <WifiOff className="h-3.5 w-3.5" /> {testError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={testing || !serverUrl || !username || !password}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wifi className="h-3.5 w-3.5" />
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
              {discovering ? 'Discovering calendars…' : `${discovered.length} calendar${discovered.length !== 1 ? 's' : ''} found`}
            </p>
            {discovering && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Scanning server…
              </div>
            )}
            {!discovering && discovered.map((cal) => {
              const linkedMap = savedAccountId
                ? calendarMaps.find((m) => m.accountId === savedAccountId && m.calendarHref === cal.id)
                : undefined;
              const isLinked = Boolean(linkedMap);
              const calName = cal.displayName ?? cal.id.split('/').filter(Boolean).pop() ?? 'Calendar';

              return (
                <div key={cal.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{calName}</p>
                    <p className="text-xs text-muted-foreground truncate">{cal.id}</p>
                  </div>
                  {isLinked ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {linkedMap?.eventsOnly
                          ? <><Calendar className="h-3 w-3" /> Events only</>
                          : <><Link className="h-3 w-3" /> Tasks</>
                        }
                      </span>
                      <button
                        onClick={() => handleLinkToggle(cal)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Unlink className="h-3 w-3" /> Unlink
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleLinkToggle(cal, false)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        title="Sync as a task list"
                      >
                        <Link className="h-3 w-3" /> Tasks
                      </button>
                      <button
                        onClick={() => handleLinkToggle(cal, true)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        title="Show events in calendar view only — no task list created"
                      >
                        <Calendar className="h-3 w-3" /> Events only
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {!discovering && discovered.length === 0 && (
              <p className="text-xs text-muted-foreground">No calendars discovered. Try linking manually.</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onDone} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90">
              Done
            </button>
            <button onClick={() => setStep('credentials')} className="text-xs text-muted-foreground hover:text-foreground px-2">
              Edit credentials
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── AddGitHubAccountForm ──────────────────────────────────────────────────────

type GitHubFormStep = 'credentials' | 'repos';

function AddGitHubAccountForm({
  existing,
  adapter,
  repoMaps,
  onDone,
  noBorder,
}: {
  existing: GitHubAccount | null;
  adapter: NonNullable<ReturnType<typeof useApp>['adapter']>;
  repoMaps: ReturnType<typeof useSyncStore.getState>['githubRepoMaps'];
  onDone: () => void;
  noBorder?: boolean;
}) {
  const {
    addGitHubAccount,
    updateGitHubAccount,
    testGitHubConnection,
    discoverGitHubRepos,
    linkGitHubRepo,
    unlinkGitHubRepo,
  } = useSyncStore();
  const { createList } = useListStore();

  const [step, setStep] = useState<GitHubFormStep>('credentials');
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '');
  const [token, setToken] = useState(existing?.token ?? '');
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<ProviderCalendar[]>([]);
  const [savedAccountId, setSavedAccountId] = useState<string | null>(existing?.id ?? null);

  async function handleConnect() {
    setTesting(true);
    setTestError(null);
    const result = await testGitHubConnection(token);
    setTesting(false);
    if (result.ok) {
      let accountId = savedAccountId;
      if (!accountId) {
        const account = await addGitHubAccount(adapter, {
          displayName: displayName || 'GitHub',
          token,
          syncEnabled: true,
        });
        accountId = account.id;
        setSavedAccountId(accountId);
      } else {
        await updateGitHubAccount(adapter, accountId, {
          displayName: displayName || 'GitHub',
          token,
        });
      }
      setStep('repos');
      setDiscovering(true);
      const repos = await discoverGitHubRepos(token);
      setDiscovered(repos);
      setDiscovering(false);
    } else {
      setTestError(result.error ?? 'Authentication failed. Check your token.');
    }
  }

  async function handleRepoToggle(repo: ProviderCalendar) {
    if (!savedAccountId) return;
    const existingMap = repoMaps.find(
      (m) => m.accountId === savedAccountId && m.repoFullName === repo.id
    );
    if (existingMap) {
      await unlinkGitHubRepo(adapter, existingMap.listId);
    } else {
      const repoName = repo.displayName ?? repo.id.split('/').pop() ?? repo.id;
      const list = await createList(adapter, repoName, undefined);
      await linkGitHubRepo(adapter, savedAccountId, repo.id, list);
    }
  }

  return (
    <section className={cn('p-4 space-y-4', !noBorder && 'border border-border rounded-md')}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Github className="h-4 w-4" />
          {existing ? 'Edit GitHub Account' : 'New GitHub Account'}
        </h3>
        <button onClick={onDone} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {step === 'credentials' ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My GitHub Account"
              className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Personal Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_…"
              autoComplete="off"
              className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-background outline-none focus:ring-1 focus:ring-ring font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Requires <code className="bg-muted px-1 rounded">repo</code> scope to read and write issues.
            </p>
          </div>

          {testError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <WifiOff className="h-3.5 w-3.5" /> {testError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConnect}
              disabled={testing || !token}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Github className="h-3.5 w-3.5" />
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
                ? 'Loading repositories…'
                : `${discovered.length} repositor${discovered.length !== 1 ? 'ies' : 'y'} found`}
            </p>
            {discovering && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Fetching repositories…
              </div>
            )}
            {!discovering && discovered.map((repo) => {
              const linkedMap = savedAccountId
                ? repoMaps.find((m) => m.accountId === savedAccountId && m.repoFullName === repo.id)
                : undefined;
              const isLinked = Boolean(linkedMap);

              return (
                <div key={repo.id} className="py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{repo.displayName ?? repo.id}</p>
                      <p className="text-xs text-muted-foreground truncate">{repo.id}</p>
                    </div>
                    <button
                      onClick={() => handleRepoToggle(repo)}
                      className={cn(
                        'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors flex-shrink-0',
                        isLinked
                          ? 'bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive'
                          : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                      )}
                    >
                      {isLinked ? <><Unlink className="h-3 w-3" /> Unlink</> : <><Link className="h-3 w-3" /> Link</>}
                    </button>
                  </div>
                  {isLinked && linkedMap && (
                    <RepoSettingsInline map={linkedMap} adapter={adapter} />
                  )}
                </div>
              );
            })}
            {!discovering && discovered.length === 0 && (
              <p className="text-xs text-muted-foreground">No repositories found.</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onDone} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90">
              Done
            </button>
            <button onClick={() => setStep('credentials')} className="text-xs text-muted-foreground hover:text-foreground px-2">
              Edit token
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
