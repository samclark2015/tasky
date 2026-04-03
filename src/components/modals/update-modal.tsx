import { useState } from 'react';
import { Download, X } from 'lucide-react';
import type { Update } from '@tauri-apps/plugin-updater';
import { ModalSheet } from '@/components/layout/modal-sheet';

interface UpdateModalProps {
  update: Update;
  onClose: () => void;
}

export function UpdateModal({ update, onClose }: UpdateModalProps) {
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<{ downloaded: number; total: number | null }>({
    downloaded: 0,
    total: null,
  });

  async function handleInstall() {
    setInstalling(true);
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setProgress({ downloaded: 0, total: event.data.contentLength ?? null });
            break;
          case 'Progress':
            setProgress((prev) => ({
              ...prev,
              downloaded: prev.downloaded + event.data.chunkLength,
            }));
            break;
          case 'Finished':
            break;
        }
      });
      await relaunch();
    } catch (err) {
      console.error('Update failed:', err);
      setInstalling(false);
    }
  }

  const pct =
    progress.total && progress.total > 0
      ? Math.round((progress.downloaded / progress.total) * 100)
      : null;

  return (
    <ModalSheet
      open
      onClose={() => { if (!installing) onClose(); }}
      title="Update Available"
      maxWidth="sm"
    >
      {/* header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Update Available</span>
        </div>
        {!installing && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3">
        <p className="text-sm text-foreground">
          Version <span className="font-medium">{update.version}</span> is available.
        </p>
        {update.body && (
          <p className="text-xs text-muted-foreground leading-relaxed">{update.body}</p>
        )}

        {installing && (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: pct != null ? `${pct}%` : '100%' }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {pct != null ? `${pct}%` : 'Downloading…'}
            </p>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border flex-shrink-0">
        {!installing && (
          <>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              Later
            </button>
            <button
              onClick={handleInstall}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Install & Restart
            </button>
          </>
        )}
      </div>
    </ModalSheet>
  );
}
