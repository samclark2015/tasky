import { useState, useEffect, useRef } from 'react';
import type { Task } from '@core/types';
import { useTaskStore, useListStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import { cn } from '@/lib/utils';
import { X, Calendar, Tag, AlignLeft, Clock, Flag, List } from 'lucide-react';
import { TagInput } from '@/components/task/tag-input';

interface TaskModalProps {
  /** If provided, editing an existing task. If null, creating new. */
  task?: Task | null;
  /** Default values when creating */
  defaults?: { listId?: string; dueDate?: string; parentId?: string };
  onClose: () => void;
}

const PRIORITY_OPTIONS: { value: Task['priority']; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-muted-foreground' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'high', label: 'High', color: 'text-destructive' },
];


export function TaskModal({ task, defaults, onClose }: TaskModalProps) {
  const { createTask, updateTask } = useTaskStore();
  const { lists } = useListStore();
  const { adapter } = useApp();

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate?.split('T')[0] ?? defaults?.dueDate ?? '');
  const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'medium');
  const [listId, setListId] = useState(task?.listId ?? defaults?.listId ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [timeEstimate, setTimeEstimate] = useState(
    task?.timeEstimate ? String(Math.round(task.timeEstimate / 60)) : ''
  );
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [saving, setSaving] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  async function handleSave() {
    if (!title.trim() || !adapter) return;
    setSaving(true);
    try {
      const dueDateISO = dueDate ? new Date(dueDate + 'T00:00:00').toISOString() : null;
      const estimateMinutes = timeEstimate ? parseInt(timeEstimate) * 60 : null;

      if (task) {
        await updateTask(adapter, task.id, {
          title: title.trim(),
          description,
          dueDate: dueDateISO,
          priority,
          listId: listId || null,
          notes,
          tags,
          timeEstimate: estimateMinutes,
        });
      } else {
        await createTask(adapter, {
          title: title.trim(),
          description,
          dueDate: dueDateISO,
          priority,
          listId: listId || null,
          notes,
          tags,
          timeEstimate: estimateMinutes,
          parentId: defaults?.parentId ?? null,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="font-semibold text-sm text-muted-foreground">
            {task ? 'Edit Task' : 'New Task'}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
          {/* title */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full text-base font-medium bg-transparent outline-none placeholder:text-muted-foreground/60 border-b border-border pb-2"
          />

          {/* description */}
          <div className="flex gap-2">
            <AlignLeft className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={2}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* due date */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 text-sm bg-transparent outline-none text-foreground [color-scheme:dark] dark:[color-scheme:dark] min-w-0"
              />
            </div>

            {/* time estimate */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                type="number"
                value={timeEstimate}
                onChange={(e) => setTimeEstimate(e.target.value)}
                placeholder="Est. (min)"
                min="0"
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground w-full"
              />
            </div>
          </div>

          {/* priority */}
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex gap-1.5">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    priority === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* list */}
          {lists.length > 0 && (
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className="flex-1 text-sm bg-transparent outline-none text-foreground"
              >
                <option value="">No list (Inbox)</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* tags */}
          <div className="flex items-start gap-2">
            <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
            <TagInput tags={tags} onChange={setTags} className="flex-1" />
          </div>

          {/* notes */}
          <div className="flex gap-2">
            <AlignLeft className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              rows={3}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground resize-none"
            />
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">⌘↵ to save</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : task ? 'Save' : 'Add Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
