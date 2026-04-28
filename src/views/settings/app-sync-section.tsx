import { useState, useEffect } from 'react';
import { RefreshCw, Copy } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { useTaskStore, useListStore, useAppSyncStore } from '@/stores';

// ── AppSyncSetupForm ──────────────────────────────────────────────────────────

export function AppSyncSetupForm({ onDone }: { onDone: () => void }) {
  const appSync = useAppSyncStore();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [bundlePath, setBundlePath] = useState('/.tasky-sync/state.enc');
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await appSync.setup(
        { providerType: 'webdav', serverUrl, username, password, bundlePath },
        passphrase,
      );
      onDone();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleTest() {
    setError(null);
    setTesting(true);
    try {
      await appSync.setup(
        { providerType: 'webdav', serverUrl, username, password, bundlePath },
        passphrase,
      );
      await appSync.testConnection();
    } catch (e) {
      setError(String(e));
    } finally {
      const storeErr = useAppSyncStore.getState().error;
      if (storeErr && !error) setError(storeErr);
      setTesting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-medium">Set Up App Sync</p>
      <p className="text-xs text-muted-foreground">
        Sync your entire app state (tasks, lists, accounts, settings) between devices using a WebDAV server.
      </p>

      <div className="space-y-2">
        <label className="block text-xs text-muted-foreground">WebDAV Server URL</label>
        <input
          type="url"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="https://cloud.example.com/remote.php/dav/files/username/"
          required
          className="w-full text-xs border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground/70">
          Nextcloud: <code className="font-mono">https://&#x3C;host&#x3E;/remote.php/dav/files/&#x3C;username&#x3E;/</code>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <label className="block text-xs text-muted-foreground">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full text-xs border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs text-muted-foreground">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full text-xs border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground/70">Use an app password if 2FA is enabled.</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-muted-foreground">
          Sync Passphrase <span className="text-muted-foreground/60">(used to encrypt the bundle)</span>
        </label>
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          required
          placeholder="Strong secret passphrase"
          className="w-full text-xs border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-muted-foreground">Bundle Path</label>
        <input
          type="text"
          value={bundlePath}
          onChange={(e) => setBundlePath(e.target.value)}
          required
          className="w-full text-xs border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="text-xs text-destructive break-all">{error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={appSync.isLoading}
          className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={testing || appSync.isLoading || !serverUrl || !username || !password || !passphrase}
          className="text-xs border border-border px-3 py-1.5 rounded-md hover:bg-muted/40 disabled:opacity-50"
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
      </div>
    </form>
  );
}

// ── AppSyncJoinForm ───────────────────────────────────────────────────────────

export function AppSyncJoinForm({ onDone }: { onDone: () => void }) {
  const appSync = useAppSyncStore();
  const { adapter } = useApp();
  const [linkCode, setLinkCode] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await appSync.join(linkCode.trim(), passphrase);
      if (adapter) {
        await Promise.all([
          useTaskStore.getState().loadTasks(adapter),
          useListStore.getState().loadLists(adapter),
        ]);
      }
      onDone();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-medium">Join with Link Code</p>
      <p className="text-xs text-muted-foreground">
        Paste the link code generated on your other device to bootstrap this device.
      </p>

      <div className="space-y-2">
        <label className="block text-xs text-muted-foreground">Link Code</label>
        <textarea
          value={linkCode}
          onChange={(e) => setLinkCode(e.target.value)}
          required
          rows={4}
          placeholder="Paste your link code here…"
          className="w-full text-xs font-mono border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-muted-foreground">Sync Passphrase</label>
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          required
          placeholder="The passphrase used when setting up sync"
          className="w-full text-xs border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="text-xs text-destructive break-all">{error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={appSync.isLoading}
          className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {appSync.isLoading ? 'Joining…' : 'Join & Pull'}
        </button>
      </div>
    </form>
  );
}

// ── AppSyncLinkCodePanel ──────────────────────────────────────────────────────

export function AppSyncLinkCodePanel({ onClose }: { onClose: () => void }) {
  const appSync = useAppSyncStore();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appSync.generateLinkCode()
      .then(setCode)
      .catch((e) => setError(String(e)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCopy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Link Code</p>
      <p className="text-xs text-muted-foreground">
        Copy this code and paste it on another device to connect it to this sync setup.
        The code contains encrypted credentials — keep it private.
      </p>

      {error && (
        <p className="text-xs text-destructive break-all">{error}</p>
      )}

      {!code && !error && (
        <p className="text-xs text-muted-foreground">Generating…</p>
      )}

      {code && (
        <div className="relative">
          <textarea
            readOnly
            value={code}
            rows={6}
            className="w-full text-xs font-mono border border-border rounded-md px-2.5 py-1.5 bg-muted/30 focus:outline-none resize-none select-all"
          />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {code && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        )}
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground px-2"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── AppSyncSection ────────────────────────────────────────────────────────────

interface AppSyncSectionProps {
  showSetup: boolean;
  showJoin: boolean;
  showLinkCode: boolean;
  onShowSetup: (show: boolean) => void;
  onShowJoin: (show: boolean) => void;
  onShowLinkCode: (show: boolean) => void;
}

export function AppSyncSectionContent({
  showSetup,
  showJoin,
  showLinkCode,
  onShowSetup,
  onShowJoin,
  onShowLinkCode,
}: AppSyncSectionProps) {
  const appSync = useAppSyncStore();
  const { adapter } = useApp();

  // Unused in this component but needed so the parent can trigger reloads via appSync.loadStatus()
  void adapter;

  return (
    <>
      {!appSync.status?.configured ? (
        <div className="border border-dashed border-border rounded-md p-4 text-center space-y-3">
          <div className="flex justify-center">
            <RefreshCw className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-xs text-muted-foreground">
            Sync your entire app state between devices via WebDAV.
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => onShowSetup(true)}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Set Up Sync
            </button>
            <button
              onClick={() => onShowJoin(true)}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/40"
            >
              Join with Code
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <div className="px-3 py-2.5 flex items-center gap-3">
            <RefreshCw className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{appSync.status.username ?? 'App Sync'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {appSync.status.serverUrl}
              </p>
              {appSync.status.lastSyncAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last synced {new Date(appSync.status.lastSyncAt).toLocaleTimeString()}
                </p>
              )}
              {appSync.status.lastError && (
                <p className="text-xs text-destructive mt-0.5 break-all">{appSync.status.lastError}</p>
              )}
            </div>
            {appSync.status.isSyncing && (
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
            )}
          </div>
          <div className="border-t border-border bg-muted/20 px-3 py-2 flex items-center gap-3">
            <button
              onClick={() => onShowLinkCode(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
              Link Code
            </button>
            <button
              onClick={async () => { await appSync.remove(); }}
              disabled={appSync.isLoading}
              className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 disabled:opacity-50 ml-auto"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showSetup && (
        <AppSyncModal title="Set Up App Sync" onClose={() => onShowSetup(false)}>
          <AppSyncSetupForm onDone={() => { onShowSetup(false); appSync.loadStatus(); }} />
        </AppSyncModal>
      )}
      {showJoin && (
        <AppSyncModal title="Join with Link Code" onClose={() => onShowJoin(false)}>
          <AppSyncJoinForm onDone={() => { onShowJoin(false); appSync.loadStatus(); }} />
        </AppSyncModal>
      )}
      {showLinkCode && (
        <AppSyncModal title="Link Code" onClose={() => onShowLinkCode(false)}>
          <AppSyncLinkCodePanel onClose={() => onShowLinkCode(false)} />
        </AppSyncModal>
      )}
    </>
  );
}

// ── Modal wrapper for App Sync ────────────────────────────────────────────────

import { ModalSheet } from '@/components/layout/modal-sheet';

function AppSyncModal({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <ModalSheet open onClose={onClose} title={title}>
      <div className="flex-1 overflow-y-auto min-h-0 p-4">{children}</div>
    </ModalSheet>
  );
}
