import { useState } from 'react';
import type { ProviderMap } from '@/types/types';
import type { ProviderMetadata } from '@/providers/types';
import type { DatabaseAdapter } from '@/db/repository';
import { useSyncStore } from '@/stores';

interface SourceSettingsInlineProps {
  map: ProviderMap;
  fields: ProviderMetadata['mapFields'];
  adapter: DatabaseAdapter;
}

export function SourceSettingsInline({ map, fields, adapter }: SourceSettingsInlineProps) {
  const { updateMap } = useSyncStore();
  const [values, setValues] = useState<Record<string, unknown>>({ ...map.settings });

  async function saveField(key: string, value: unknown) {
    const next = { ...values, [key]: value };
    setValues(next);
    await updateMap(adapter, map.id, { settings: next });
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
