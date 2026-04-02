import { useState } from 'react';
import { ViewHeader } from '@/components/layout/view-header';
import { useApp } from '@/components/app-provider';
import { useTaskStore, useListStore, useSyncStore } from '@/stores';
import type { CalDavAccount, TaskList } from '@tasky/core';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PanelState = 'list' | 'add' | 'discover';

export function SettingsView() {
  const { adapter } = useApp();
  const { accounts, calendarMaps, syncStatus, lastSyncAt, lastSyncError, isSyncing, syncAll, deleteAccount } = useSyncStore();
  const { tasks } = useTaskStore();
  const { lists } = useListStore();
  const [panel, setPanel] = useState<PanelState>('list');
  const [editingAccount, setEditingAccount] = useState<CalDavAccount | null>(null);

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

        {/* CalDAV Accounts section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">CalDAV Accounts</h2>
            <button
              onClick={() => { setEditingAccount(null); setPanel('add'); }}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Account
            </button>
          </div>

          {accounts.length === 0 && panel !== 'add' && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Wifi className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No CalDAV accounts connected.</p>
              <p className="text-xs mt-1">Connect to Fastmail, iCloud, Nextcloud, or any CalDAV server.</p>
            </div>
          )}

          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              calendarMaps={calendarMaps}
              lists={lists}
              onEdit={() => { setEditingAccount(account); setPanel('add'); }}
              onDelete={() => adapter && deleteAccount(adapter, account.id)}
            />
          ))}
        </section>

        {/* Add / Edit form */}
        {panel === 'add' && adapter && (
          <AddAccountForm
            key={editingAccount?.id ?? 'new'}
            existing={editingAccount}
            adapter={adapter}
            lists={lists}
            calendarMaps={calendarMaps}
            onDone={() => { setPanel('list'); setEditingAccount(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ── AccountRow ──────────────────────────────────────────────────────────────

function AccountRow({
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
          <p className="text-xs text-muted-foreground truncate">{account.username} · {new URL(account.serverUrl).hostname}</p>
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

// ── AddAccountForm ───────────────────────────────────────────────────────────

type FormStep = 'credentials' | 'testing' | 'calendars';

function AddAccountForm({
  existing,
  adapter,
  lists,
  calendarMaps,
  onDone,
}: {
  existing: CalDavAccount | null;
  adapter: NonNullable<ReturnType<typeof useApp>['adapter']>;
  lists: TaskList[];
  calendarMaps: ReturnType<typeof useSyncStore.getState>['calendarMaps'];
  onDone: () => void;
}) {
  const { addAccount, updateAccount, testConnection, discoverCalendars, linkCalendar, unlinkCalendar } = useSyncStore();
  const { createList } = useListStore();

  const [step, setStep] = useState<FormStep>('credentials');
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

  async function handleLinkToggle(cal: ProviderCalendar) {
    if (!savedAccountId) return;
    const existing = calendarMaps.find(
      (m) => m.accountId === savedAccountId && m.calendarHref === cal.id
    );
    if (existing) {
      await unlinkCalendar(adapter, existing.listId);
    } else {
      let list = lists.find((l) => l.caldavUrl === cal.id);
      if (!list) {
        const name = cal.displayName ?? cal.id.split('/').filter(Boolean).pop() ?? 'Calendar';
        list = await createList(adapter, name, cal.color ?? undefined);
        await useListStore.getState().updateList(adapter, list.id, { caldavUrl: cal.id });
        list = { ...list, caldavUrl: cal.id };
      }
      await linkCalendar(adapter, savedAccountId, cal.id, list);
    }
  }

  return (
    <section className="border border-border rounded-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{existing ? 'Edit Account' : 'New CalDAV Account'}</h3>
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
              const isLinked = savedAccountId
                ? calendarMaps.some((m) => m.accountId === savedAccountId && m.calendarHref === cal.id)
                : false;
              const calName = cal.displayName ?? cal.id.split('/').filter(Boolean).pop() ?? 'Calendar';

              return (
                <div key={cal.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{calName}</p>
                    <p className="text-xs text-muted-foreground truncate">{cal.id}</p>
                  </div>
                  <button
                    onClick={() => handleLinkToggle(cal)}
                    className={cn(
                      'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors',
                      isLinked
                        ? 'bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive'
                        : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                    )}
                  >
                    {isLinked ? <><Unlink className="h-3 w-3" /> Unlink</> : <><Link className="h-3 w-3" /> Link</>}
                  </button>
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
