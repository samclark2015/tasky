import { useState } from 'react';
import type { ProviderCalendar, ProviderMetadata } from '@/providers/types';
import { ColorPicker, PRESET_COLORS } from '@/components/ui/color-picker';
import { Link, Calendar } from 'lucide-react';

export interface SourceConfigResult {
  mode: 'tasks' | 'events';
  name: string;
  color: string;
}

interface SourceConfigFormProps {
  source: ProviderCalendar;
  metadata: ProviderMetadata;
  onLink: (result: SourceConfigResult) => Promise<void>;
  onCancel: () => void;
}

export function SourceConfigForm({ source, metadata, onLink, onCancel }: SourceConfigFormProps) {
  const defaultName = source.displayName ?? source.id.split('/').filter(Boolean).pop() ?? metadata.sourceNoun;
  const defaultColor = source.color ?? PRESET_COLORS[0];

  const [mode, setMode] = useState<'tasks' | 'events'>(
    metadata.supportsEvents ? 'tasks' : 'tasks'
  );
  const [name, setName] = useState(defaultName);
  const [color, setColor] = useState(defaultColor);
  const [saving, setSaving] = useState(false);

  async function handleLink() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onLink({ mode, name: name.trim(), color });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 pt-2 pl-4 border-l-2 border-primary/30">
      {/* Mode toggle — only shown when provider supports events */}
      {metadata.supportsEvents && (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode('tasks')}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
              mode === 'tasks'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
            }`}
          >
            <Link className="h-3 w-3" />
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setMode('events')}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
              mode === 'events'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
            }`}
          >
            <Calendar className="h-3 w-3" />
            Events only
          </button>
        </div>
      )}

      {mode === 'tasks' && (
        <>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">List name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="List name"
              className="w-full text-sm border border-input rounded-md px-2.5 py-1.5 bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Color</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </>
      )}

      {mode === 'events' && (
        <p className="text-xs text-muted-foreground">
          This source will appear in calendar view only — no task list will be created.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleLink}
          disabled={saving || (mode === 'tasks' && !name.trim())}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Linking…' : 'Link'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground px-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
